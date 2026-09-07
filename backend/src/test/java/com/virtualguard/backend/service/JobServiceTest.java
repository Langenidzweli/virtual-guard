package com.virtualguard.backend.service;

import com.virtualguard.backend.entity.ProcessingJob;
import com.virtualguard.backend.enums.JobStatus;
import com.virtualguard.backend.repository.CameraRepository;
import com.virtualguard.backend.repository.ProcessingJobRepository;
import com.virtualguard.backend.storage.FileStorageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.client.RestClient;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class JobServiceTest {

    @Mock ProcessingJobRepository jobRepository;
    @Mock CameraRepository cameraRepository;
    @Mock FileStorageService fileStorageService;
    @Mock IncidentService incidentService;
    @Mock RestClient.Builder restClientBuilder;

    private JobService jobService;

    @BeforeEach
    void setUp() {
        jobService = new JobService(jobRepository, cameraRepository, fileStorageService, incidentService, restClientBuilder);
    }

    @Test
    void failedProgressMarksJobFailedInsteadOfProcessing() {
        ProcessingJob job = job(JobStatus.PROCESSING);
        when(jobRepository.findById(job.getId())).thenReturn(Optional.of(job));

        jobService.updateProgress(job.getId(), "failed", 0);

        assertEquals(JobStatus.FAILED, job.getStatus());
        assertEquals("failed", job.getCurrentStage());
        assertEquals(0, job.getProgressPercent());
        verify(jobRepository).save(job);
    }

    @Test
    void lateProgressCannotRegressCompletedJob() {
        ProcessingJob job = job(JobStatus.COMPLETED);
        job.setProgressPercent(100);
        when(jobRepository.findById(job.getId())).thenReturn(Optional.of(job));

        jobService.updateProgress(job.getId(), "vision-analysis", 45);

        assertEquals(JobStatus.COMPLETED, job.getStatus());
        assertEquals(100, job.getProgressPercent());
        verify(jobRepository, never()).save(job);
    }

    @Test
    void completedJobCannotBeStartedAgain() {
        ProcessingJob job = job(JobStatus.COMPLETED);
        when(jobRepository.findById(job.getId())).thenReturn(Optional.of(job));

        assertThrows(IllegalStateException.class, () -> jobService.startJob(job.getId()));
        verify(jobRepository, never()).save(job);
    }

    @Test
    void startJobDoesNotSendCallerControlledCallbackUrls() {
        ProcessingJob job = job(JobStatus.QUEUED);
        job.setVideoFilePath("camera-video.mp4");
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        JobService service = new JobService(
                jobRepository, cameraRepository, fileStorageService, incidentService, builder);
        ReflectionTestUtils.setField(service, "fastApiBaseUrl", "http://ai.internal:8000");
        ReflectionTestUtils.setField(service, "apiKey", "internal-key");
        when(jobRepository.findById(job.getId())).thenReturn(Optional.of(job));
        when(fileStorageService.resolvePath("camera-video.mp4")).thenReturn("C:\\uploads\\camera-video.mp4");
        server.expect(requestTo("http://ai.internal:8000/analyze"))
                .andExpect(header("X-API-Key", "internal-key"))
                .andExpect(content().json("""
                        {"job_id":"%s","video_path":"C:\\\\uploads\\\\camera-video.mp4"}
                        """.formatted(job.getId()), true))
                .andRespond(withSuccess());

        service.startJob(job.getId());

        server.verify();
        assertEquals(JobStatus.PROCESSING, job.getStatus());
    }

    private ProcessingJob job(JobStatus status) {
        ProcessingJob job = new ProcessingJob();
        job.setId(UUID.randomUUID());
        job.setStatus(status);
        return job;
    }
}
