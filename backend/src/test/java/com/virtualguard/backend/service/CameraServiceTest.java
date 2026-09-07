package com.virtualguard.backend.service;

import com.virtualguard.backend.dto.CameraRequest;
import com.virtualguard.backend.entity.Camera;
import com.virtualguard.backend.enums.CameraStatus;
import com.virtualguard.backend.repository.CameraRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CameraServiceTest {

    @Mock
    private CameraRepository cameraRepository;

    private CameraService cameraService;

    @BeforeEach
    void setUp() {
        cameraService = new CameraService(cameraRepository);
    }

    @Test
    void createsCameraWithSafeInitialStatus() {
        CameraRequest request = new CameraRequest("cam-new", "New Aisle", 25, 40, true, "store-1", null);
        when(cameraRepository.existsById("cam-new")).thenReturn(false);
        when(cameraRepository.save(org.mockito.ArgumentMatchers.any(Camera.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        cameraService.create(request);

        ArgumentCaptor<Camera> captor = ArgumentCaptor.forClass(Camera.class);
        verify(cameraRepository).save(captor.capture());
        assertEquals(CameraStatus.IDLE, captor.getValue().getStatus());
        assertEquals("New Aisle", captor.getValue().getLabel());
    }

    @Test
    void preventsCameraIdChangeDuringUpdate() {
        CameraRequest request = new CameraRequest("different-id", "Aisle", 25, 40, true, null, null);
        assertThrows(IllegalArgumentException.class, () -> cameraService.update("cam-original", request));
    }

    @Test
    void updatePreservesOperationalStatus() {
        Camera camera = new Camera();
        camera.setId("cam-1");
        camera.setStatus(CameraStatus.ALERT);
        when(cameraRepository.findById("cam-1")).thenReturn(Optional.of(camera));
        when(cameraRepository.save(camera)).thenReturn(camera);

        cameraService.update("cam-1", new CameraRequest("cam-1", "Checkout", 10, 20, false, null, null));

        assertEquals(CameraStatus.ALERT, camera.getStatus());
        assertEquals("Checkout", camera.getLabel());
    }
}
