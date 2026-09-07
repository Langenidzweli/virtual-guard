package com.virtualguard.backend.storage;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class FileStorageServiceTest {

    @TempDir
    Path uploadDir;

    private FileStorageService service;

    @BeforeEach
    void setUp() throws Exception {
        service = new FileStorageService();
        ReflectionTestUtils.setField(service, "uploadDir", uploadDir.toString());
        service.init();
    }

    @Test
    void storesDuplicateFilesWithoutOverwriting() {
        MockMultipartFile first = new MockMultipartFile("file", "clip.mp4", "video/mp4", new byte[]{1});
        MockMultipartFile second = new MockMultipartFile("file", "clip.mp4", "video/mp4", new byte[]{2});

        assertEquals("clip.mp4", service.storeFile(first));
        assertEquals("clip_1.mp4", service.storeFile(second));
        assertTrue(Files.exists(uploadDir.resolve("clip.mp4")));
        assertTrue(Files.exists(uploadDir.resolve("clip_1.mp4")));
        assertEquals(0, countTemporaryUploads());
    }

    @Test
    void rejectsUnsupportedFileExtensions() {
        MockMultipartFile file = new MockMultipartFile("file", "notes.txt", "text/plain", new byte[]{1});

        assertThrows(RuntimeException.class, () -> service.storeFile(file));
    }

    @Test
    void normalizesUnsafeFilenameCharactersBeforeStorage() {
        MockMultipartFile file = new MockMultipartFile(
                "file", "camera \"north\".mp4", "video/mp4", new byte[]{1});

        String storedName = service.storeFile(file);

        assertEquals("camera__north_.mp4", storedName);
        assertTrue(Files.exists(uploadDir.resolve(storedName)));
    }

    @Test
    void removesTemporaryFileWhenUploadCopyFails() throws Exception {
        MultipartFile file = mock(MultipartFile.class);
        when(file.isEmpty()).thenReturn(false);
        when(file.getOriginalFilename()).thenReturn("clip.mp4");
        when(file.getInputStream()).thenThrow(new java.io.IOException("interrupted upload"));

        assertThrows(RuntimeException.class, () -> service.storeFile(file));
        assertEquals(0, countTemporaryUploads());
        assertTrue(Files.notExists(uploadDir.resolve("clip.mp4")));
    }

    @Test
    void resolvePathRejectsTraversalAndNestedPaths() {
        assertThrows(IllegalArgumentException.class, () -> service.resolvePath("../secret.mp4"));
        assertThrows(IllegalArgumentException.class, () -> service.resolvePath("folder/clip.mp4"));
        assertThrows(IllegalArgumentException.class, () -> service.resolvePath("folder\\clip.mp4"));
    }

    private long countTemporaryUploads() {
        try (var files = Files.list(uploadDir)) {
            return files.filter(path -> path.getFileName().toString().startsWith(".upload-")).count();
        } catch (Exception exception) {
            throw new AssertionError(exception);
        }
    }
}
