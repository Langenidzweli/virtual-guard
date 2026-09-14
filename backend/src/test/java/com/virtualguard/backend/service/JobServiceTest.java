package com.virtualguard.backend.service;
import com.virtualguard.backend.repository.*;
import com.virtualguard.backend.storage.FileStorageService;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.test.util.ReflectionTestUtils;
import java.util.UUID;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;
class JobServiceTest {
 @Test void dispatchFailureIsRecordedForTheClaimedAttempt() {
  var lifecycle = mock(JobLifecycle.class); var storage = mock(FileStorageService.class);
  var builder = RestClient.builder(); var server = MockRestServiceServer.bindTo(builder).build();
  var service = new JobService(mock(ProcessingJobRepository.class), mock(CameraRepository.class), storage, lifecycle, builder);
  ReflectionTestUtils.setField(service, "fastApiBaseUrl", "http://ai:8000");
  ReflectionTestUtils.setField(service, "apiKey", "test-key");
  var id = UUID.randomUUID(); var attempt = UUID.randomUUID();
  when(lifecycle.claim(id)).thenReturn(new JobLifecycle.Claim(id, attempt, "clip.mp4"));
  when(storage.resolvePath("clip.mp4")).thenReturn("/uploads/clip.mp4");
  server.expect(requestTo("http://ai:8000/analyze")).andExpect(header("X-API-Key", "test-key"))
   .andExpect(content().json("{\"job_id\":\""+id+"\",\"attempt_id\":\""+attempt+"\",\"video_path\":\"/uploads/clip.mp4\"}", true)).andRespond(withServerError());
  assertThrows(IllegalStateException.class, () -> service.startJob(id));
  verify(lifecycle).fail(eq(id), eq(attempt), contains("Retry")); server.verify();
 }
 @Test void duplicateStartDoesNotDispatch() {
  var lifecycle = mock(JobLifecycle.class); var builder = mock(RestClient.Builder.class);
  var service = new JobService(mock(ProcessingJobRepository.class), mock(CameraRepository.class), mock(FileStorageService.class), lifecycle, builder);
  service.startJob(UUID.randomUUID()); verifyNoInteractions(builder);
 }
}