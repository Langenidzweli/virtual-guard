package com.virtualguard.backend.service;

import com.virtualguard.backend.dto.*;
import com.virtualguard.backend.entity.*;
import com.virtualguard.backend.enums.*;
import com.virtualguard.backend.repository.*;
import com.virtualguard.backend.security.JwtTokenProvider;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import java.sql.DriverManager;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;

/** Opt-in PostgreSQL tests; every run uses a new, isolated schema. */
@SpringBootTest(properties = {"spring.jpa.hibernate.ddl-auto=create", "app.jobs.recovery-interval-ms=3600000"})
@ActiveProfiles("test")
@org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
@EnabledIfEnvironmentVariable(named = "AUDIT_DB_URL", matches = ".+")
class AuditDatabaseTest {
    static final String SCHEMA = "vg_audit_" + UUID.randomUUID().toString().replace("-", "");
    @DynamicPropertySource static void database(DynamicPropertyRegistry properties) throws Exception {
        try (var c = connection(); var s = c.createStatement()) { s.execute("CREATE SCHEMA " + SCHEMA); }
        properties.add("spring.datasource.url", () -> System.getenv("AUDIT_DB_URL") + "?currentSchema=" + SCHEMA);
        properties.add("spring.datasource.username", () -> System.getenv("AUDIT_DB_USER"));
        properties.add("spring.datasource.password", () -> System.getenv("AUDIT_DB_PASSWORD"));
    }
    static java.sql.Connection connection() throws Exception {
        return DriverManager.getConnection(System.getenv("AUDIT_DB_URL"), System.getenv("AUDIT_DB_USER"), System.getenv("AUDIT_DB_PASSWORD"));
    }
    @AfterAll static void cleanup() throws Exception {
        try (var c = connection(); var s = c.createStatement()) { s.execute("DROP SCHEMA " + SCHEMA + " CASCADE"); }
    }
    @Autowired JobLifecycle lifecycle;
    @Autowired ProcessingJobRepository jobs;
    @Autowired CameraRepository cameras;
    @Autowired IncidentRepository incidents;
    @Autowired IncidentService incidentService;
    @Autowired GuardService guardService;
    @Autowired JwtTokenProvider tokens;
    @Autowired org.springframework.security.authentication.AuthenticationManager authentication;
    @Autowired org.springframework.test.web.servlet.MockMvc http;

    ProcessingJob queued(boolean monitored) {
        var camera = new Camera(); camera.setId(UUID.randomUUID().toString()); camera.setLabel("Storage");
        camera.setMonitored(monitored); camera.setStatus(CameraStatus.NORMAL); camera.setX(17); camera.setY(63);
        cameras.saveAndFlush(camera);
        var job = new ProcessingJob(); job.setCamera(camera); job.setVideoFilePath("clip.mp4"); job.setStatus(JobStatus.QUEUED);
        return jobs.saveAndFlush(job);
    }
    List<Boolean> race(Callable<Boolean> action) throws Exception {
        var executor = Executors.newFixedThreadPool(2); var ready = new CountDownLatch(2); var go = new CountDownLatch(1);
        Callable<Boolean> concurrent = () -> { ready.countDown(); go.await(); return action.call(); };
        try {
            var a = executor.submit(concurrent); var b = executor.submit(concurrent);
            assertTrue(ready.await(5, TimeUnit.SECONDS)); go.countDown();
            return List.of(a.get(15, TimeUnit.SECONDS), b.get(15, TimeUnit.SECONDS));
        } finally { executor.shutdownNow(); }
    }
    @Test void concurrentStartsClaimExactlyOneAttempt() throws Exception {
        var job = queued(true);
        assertEquals(1, race(() -> lifecycle.claim(job.getId()) != null).stream().filter(Boolean::booleanValue).count());
        assertEquals(1, jobs.findById(job.getId()).orElseThrow().getAttemptCount());
    }
    @Test void staleLeaseCanRetryAndOldCallbacksCannotChangeNewAttempt() {
        var job = queued(true); var first = lifecycle.claim(job.getId());
        lifecycle.progress(job.getId(), first.attemptId(), "vision", 50, null);
        lifecycle.progress(job.getId(), first.attemptId(), "heartbeat", 0, null);
        assertEquals(50, jobs.findById(job.getId()).orElseThrow().getProgressPercent());
        lifecycle.expire(job.getId(), LocalDateTime.now().plusSeconds(1), LocalDateTime.now().minusHours(2));
        assertEquals(JobStatus.FAILED, jobs.findById(job.getId()).orElseThrow().getStatus());
        var second = lifecycle.claim(job.getId());
        assertNotEquals(first.attemptId(), second.attemptId());
        assertThrows(IllegalStateException.class, () -> lifecycle.progress(job.getId(), first.attemptId(), "failed", 0, "old failure"));
        assertEquals(JobStatus.PROCESSING, jobs.findById(job.getId()).orElseThrow().getStatus());
        assertEquals(2, jobs.findById(job.getId()).orElseThrow().getAttemptCount());
    }
    @Test void duplicateCallbacksAndConflictingReviewsAreSerializedAndNotesPersist() throws Exception {
        var job = queued(true); var claim = lifecycle.claim(job.getId());
        var result = new AiCallbackRequest("shoplifting", .9, 85.0, List.of(), Map.of(), "clip.mp4", "completed");
        race(() -> { lifecycle.complete(job.getId(), claim.attemptId(), result); return true; });
        var matches = incidents.findAll().stream().filter(i -> i.getJob().getId().equals(job.getId())).toList();
        assertEquals(1, matches.size()); var id = matches.get(0).getId();
        var reviews = race(() -> { try { incidentService.reviewIncident(id, ReviewStatus.CONFIRMED, Thread.currentThread().getName()); return true; }
            catch (IllegalStateException conflict) { return false; } });
        assertEquals(1, reviews.stream().filter(Boolean::booleanValue).count());
        var note = new NoteRequest(UUID.randomUUID(), "Preserve this evidence");
        race(() -> { incidentService.addNote(id, note, "guard@example.com"); return true; });
        var saved = incidentService.getIncident(id).notes();
        assertEquals(1, saved.size()); assertEquals("guard@example.com", saved.get(0).author());
        assertNotNull(saved.get(0).createdAt()); assertEquals(note.text(), saved.get(0).text());
    }
    @Test void disabledCameraCannotStart() {
        var job = queued(false); assertThrows(IllegalStateException.class, () -> lifecycle.claim(job.getId()));
        assertEquals(JobStatus.QUEUED, jobs.findById(job.getId()).orElseThrow().getStatus());
        assertEquals(17, cameras.findById(job.getCamera().getId()).orElseThrow().getX());
    }
    @Test void dispatchFailureCommitsAndCanBeRetried() {
        var job = queued(true);
        var builder = org.springframework.web.client.RestClient.builder();
        var server = org.springframework.test.web.client.MockRestServiceServer.bindTo(builder).build();
        var storage = org.mockito.Mockito.mock(com.virtualguard.backend.storage.FileStorageService.class);
        org.mockito.Mockito.when(storage.resolvePath("clip.mp4")).thenReturn("/uploads/clip.mp4");
        var service = new JobService(jobs, cameras, storage, lifecycle, builder);
        org.springframework.test.util.ReflectionTestUtils.setField(service, "fastApiBaseUrl", "http://ai:8000");
        org.springframework.test.util.ReflectionTestUtils.setField(service, "apiKey", "test-key");
        server.expect(org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo("http://ai:8000/analyze"))
            .andRespond(org.springframework.test.web.client.response.MockRestResponseCreators.withServerError());
        assertThrows(IllegalStateException.class, () -> service.startJob(job.getId()));
        var failed = jobs.findById(job.getId()).orElseThrow();
        assertEquals(JobStatus.FAILED, failed.getStatus());
        assertTrue(failed.getFailureReason().contains("Retry"));
        assertNotNull(lifecycle.claim(job.getId()));
        server.verify();
    }
    @Test void deactivationRevokesExistingAccessRefreshAndMediaEvenAfterReactivation() throws Exception {
        var request = new GuardRequestDto(); request.setName("Audit Guard"); request.setEmail(UUID.randomUUID()+"@example.com");
        request.setPhone("0123456789"); request.setBadgeNumber(UUID.randomUUID().toString()); request.setPassword("Audit-test-password-123");
        var guard = guardService.createGuard(request);
        assertTrue(authentication.authenticate(new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword())).isAuthenticated());
        var access = tokens.generateAccessToken(guard.getId(), request.getEmail(), "SECURITY_GUARD");
        var refresh = tokens.generateRefreshToken(guard.getId(), request.getEmail());
        var media = tokens.mediaTicket(request.getEmail(), "clip.mp4");
        assertTrue(tokens.getAuthentication(access).isAuthenticated());
        http.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/cameras")
            .header("Authorization", "Bearer " + access)).andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isOk());
        assertTrue(tokens.canReadMedia(media, "clip.mp4")); assertFalse(tokens.canReadMedia(media, "other.mp4"));
        guardService.updateGuardStatus(guard.getId(), GuardStatus.DEACTIVATED);
        assertThrows(org.springframework.security.authentication.DisabledException.class, () -> authentication.authenticate(new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword())));
        assertThrows(org.springframework.security.core.AuthenticationException.class, () -> tokens.getAuthentication(access));
        assertThrows(org.springframework.security.core.AuthenticationException.class, () -> tokens.getAuthentication(refresh));
        assertFalse(tokens.canReadMedia(media, "clip.mp4"));
        http.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/cameras")
            .header("Authorization", "Bearer " + access)).andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isUnauthorized());
        http.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/auth/refresh")
            .contentType("application/json").content("{\"refreshToken\":\"" + refresh + "\"}"))
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isUnauthorized());
        guardService.updateGuardStatus(guard.getId(), GuardStatus.ACTIVE);
        assertThrows(org.springframework.security.core.AuthenticationException.class, () -> tokens.getAuthentication(access));
        assertTrue(tokens.getAuthentication(tokens.generateAccessToken(guard.getId(), request.getEmail(), "SECURITY_GUARD")).isAuthenticated());
    }
}
