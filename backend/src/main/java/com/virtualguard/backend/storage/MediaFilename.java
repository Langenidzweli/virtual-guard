package com.virtualguard.backend.storage;

/** Extract a filename from service metadata originating on Windows or Unix. */
public final class MediaFilename {
    private MediaFilename() {}

    public static String fromPath(String path) {
        if (path == null || path.isBlank()) throw new IllegalArgumentException("Media path is required");
        String normalized = path.replace('\\', '/');
        String filename = normalized.substring(normalized.lastIndexOf('/') + 1);
        if (filename.isBlank() || filename.equals(".") || filename.equals("..") || filename.contains(":"))
            throw new IllegalArgumentException("Invalid media filename");
        return filename;
    }
}
