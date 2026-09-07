package com.virtualguard.backend.config;

import com.virtualguard.backend.entity.Camera;
import com.virtualguard.backend.entity.User;
import com.virtualguard.backend.enums.CameraStatus;
import com.virtualguard.backend.enums.Role;
import com.virtualguard.backend.repository.CameraRepository;
import com.virtualguard.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.beans.factory.annotation.Value;

import java.util.List;

@Component
@RequiredArgsConstructor
@Profile("!test")
public class DatabaseInitializer implements CommandLineRunner {

    private final CameraRepository cameraRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.bootstrap.users-enabled:false}")
    private boolean bootstrapUsersEnabled;

    @Value("${app.bootstrap.password:}")
    private String bootstrapPassword;

    @Override
    public void run(String... args) {
        initializeCameras();
        if (bootstrapUsersEnabled) {
            if (bootstrapPassword == null || bootstrapPassword.isBlank()) {
                throw new IllegalStateException("BOOTSTRAP_PASSWORD is required when bootstrap users are enabled");
            }
            initializeUsers();
        }
    }

    private void initializeCameras() {
        if (cameraRepository.count() == 0) {
            List<Camera> defaultCameras = List.of(
                createCamera("cam-storage", "Storage", 47.5, 10.0, true),
                createCamera("cam-aisle-a", "Aisle A", 29.3, 26.2, true),
                createCamera("cam-aisle-b", "Aisle B", 65.0, 26.2, false),
                createCamera("cam-checkout", "Checkout", 21.7, 85.7, true),
                createCamera("cam-entrance", "Entrance", 70.0, 86.9, true)
            );
            cameraRepository.saveAll(defaultCameras);
        }
    }

    private void initializeUsers() {
        createUserIfMissing("admin@virtualguard.com", "Admin User", Role.ADMIN);
        createUserIfMissing("guard@virtualguard.com", "Jordan Reyes", Role.SECURITY_GUARD);
    }

    private void createUserIfMissing(String email, String name, Role role) {
        if (userRepository.findByEmail(email).isEmpty()) {
            User user = new User();
            user.setEmail(email);
            user.setPassword(passwordEncoder.encode(bootstrapPassword));
            user.setName(name);
            user.setRole(role);
            userRepository.save(user);
        }
    }

    private Camera createCamera(String id, String label, double x, double y, boolean monitored) {
        Camera cam = new Camera();
        cam.setId(id);
        cam.setLabel(label);
        cam.setX(x);
        cam.setY(y);
        cam.setMonitored(monitored);
        cam.setStatus(CameraStatus.IDLE);
        return cam;
    }
}
