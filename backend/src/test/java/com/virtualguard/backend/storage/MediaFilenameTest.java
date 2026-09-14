package com.virtualguard.backend.storage;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import static org.junit.jupiter.api.Assertions.*;

class MediaFilenameTest {
    @ParameterizedTest
    @ValueSource(strings = {"clip.mp4", "/uploads/clip.mp4", "C:\\uploads\\clip.mp4",
            "\\\\server\\share\\clip.mp4", "C:\\uploads/mixed\\clip.mp4"})
    void extractsFilenameRegardlessOfHostOperatingSystem(String path) {
        assertEquals("clip.mp4", MediaFilename.fromPath(path));
    }

    @ParameterizedTest
    @ValueSource(strings = {"", " ", "/uploads/", "C:\\uploads\\", ".", "..", "C:clip.mp4"})
    void rejectsMissingOrInvalidFilename(String path) {
        assertThrows(IllegalArgumentException.class, () -> MediaFilename.fromPath(path));
    }
}
