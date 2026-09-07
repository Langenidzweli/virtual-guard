package com.virtualguard.backend.storage;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Locale;
import java.util.Set;

@Service
public class FileStorageService {

    private static final Set<String> ALLOWED_EXTENSIONS = Set.of(".mp4", ".mov", ".avi", ".mkv", ".webm");

    @Value("${spring.file.storage.location:./uploads}")
    private String uploadDir;

    @PostConstruct
    public void init() throws IOException {
        Path uploadPath = storageRoot();
        if (!Files.exists(uploadPath)) {
            Files.createDirectories(uploadPath);
        }
    }

    public String storeFile(MultipartFile file) {
        Path temporaryPath = null;
        try {
            if (file.isEmpty()) {
                throw new IllegalArgumentException("File is empty");
            }

            String originalFilename = file.getOriginalFilename();
            String filename = null;
            if (originalFilename != null) {
                String normalizedSeparators = originalFilename.replace('\\', '/');
                filename = normalizedSeparators.substring(normalizedSeparators.lastIndexOf('/') + 1);
            }
            if (filename == null || filename.isEmpty()) {
                throw new IllegalArgumentException("Filename is null or empty");
            }

            filename = filename.replaceAll("[^A-Za-z0-9._-]", "_");
            if (filename.isBlank()) {
                throw new IllegalArgumentException("Filename contains no supported characters");
            }
            if (filename.length() > 200) {
                throw new IllegalArgumentException("Filename is too long");
            }

            String lowercaseFilename = filename.toLowerCase(Locale.ROOT);
            if (ALLOWED_EXTENSIONS.stream().noneMatch(lowercaseFilename::endsWith)) {
                throw new IllegalArgumentException("Unsupported video type. Allowed: MP4, MOV, AVI, MKV, WEBM");
            }

            Path storageRoot = storageRoot();
            Path filePath = storageRoot.resolve(filename).normalize();
            if (!filePath.startsWith(storageRoot)) {
                throw new IllegalArgumentException("Invalid filename");
            }

            if (Files.exists(filePath)) {
                String nameWithoutExt = filename;
                String extension = "";
                if (filename.contains(".")) {
                    int dotIndex = filename.lastIndexOf(".");
                    extension = filename.substring(dotIndex);
                    nameWithoutExt = filename.substring(0, dotIndex);
                }
                int counter = 1;
                while (Files.exists(filePath)) {
                    String newFilename = nameWithoutExt + "_" + counter + extension;
                    filePath = storageRoot.resolve(newFilename).normalize();
                    counter++;
                }
            }

            temporaryPath = Files.createTempFile(storageRoot, ".upload-", ".tmp");
            try (var inputStream = file.getInputStream()) {
                Files.copy(inputStream, temporaryPath, StandardCopyOption.REPLACE_EXISTING);
            }
            try {
                Files.move(temporaryPath, filePath, StandardCopyOption.ATOMIC_MOVE);
            } catch (java.nio.file.AtomicMoveNotSupportedException exception) {
                Files.move(temporaryPath, filePath);
            }
            return filePath.getFileName().toString();
        } catch (IOException e) {
            if (temporaryPath != null) {
                try {
                    Files.deleteIfExists(temporaryPath);
                } catch (IOException cleanupException) {
                    e.addSuppressed(cleanupException);
                }
            }
            throw new RuntimeException("Failed to store file: " + e.getMessage(), e);
        }
    }

    public String resolvePath(String filename) {
        if (filename == null || filename.isBlank()) {
            throw new IllegalArgumentException("Filename is required");
        }

        Path storageRoot = storageRoot();
        Path resolvedPath = storageRoot.resolve(filename).normalize();
        if (!resolvedPath.startsWith(storageRoot) || !resolvedPath.getFileName().toString().equals(filename)) {
            throw new IllegalArgumentException("Invalid filename");
        }
        return resolvedPath.toString();
    }

    private Path storageRoot() {
        return Paths.get(uploadDir).toAbsolutePath().normalize();
    }
}
