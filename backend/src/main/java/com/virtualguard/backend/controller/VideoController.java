package com.virtualguard.backend.controller;

import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpRange;
import org.springframework.core.io.InputStreamResource;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestHeader;
import com.virtualguard.backend.storage.FileStorageService;
import com.virtualguard.backend.security.JwtTokenProvider;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import java.nio.file.Files;
import java.nio.file.Paths;

@RestController
@RequestMapping("/api/video")
public class VideoController {

    private final FileStorageService fileStorageService;
    private final JwtTokenProvider tokenProvider;

    public VideoController(FileStorageService fileStorageService, JwtTokenProvider tokenProvider) {
        this.fileStorageService = fileStorageService;
        this.tokenProvider = tokenProvider;
    }

    @GetMapping("/{filename}")
    public ResponseEntity<?> getVideo(
            @PathVariable String filename,
            @RequestParam(required = false) String token,
            @RequestHeader HttpHeaders headers) {
        try {
            if (token == null || !tokenProvider.isAccessToken(token)) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
            }
            if (filename.contains("..") || filename.contains("/") || filename.contains("\\")) {
                return ResponseEntity.badRequest().build();
            }

            File file = Paths.get(fileStorageService.resolvePath(filename)).toFile();

            if (!file.exists()) {
                return ResponseEntity.notFound().build();
            }

            String contentType = getContentType(filename);
            Resource resource = new FileSystemResource(file);

            List<HttpRange> ranges = headers.getRange();
            if (!ranges.isEmpty()) {
                HttpRange range = ranges.get(0);
                long contentLength = resource.contentLength();
                long start = range.getRangeStart(contentLength);
                long end = range.getRangeEnd(contentLength);
                long length = end - start + 1;
                InputStream inputStream = Files.newInputStream(file.toPath());
                long skipped = inputStream.skip(start);
                while (skipped < start) {
                    long additional = inputStream.skip(start - skipped);
                    if (additional == 0) {
                        inputStream.close();
                        return ResponseEntity.status(HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE).build();
                    }
                    skipped += additional;
                }
                Resource region = new InputStreamResource(new LimitedInputStream(inputStream, length));
                return ResponseEntity.status(HttpStatus.PARTIAL_CONTENT)
                        .contentType(MediaType.parseMediaType(contentType))
                        .contentLength(length)
                        .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + file.getName() + "\"")
                        .header(HttpHeaders.ACCEPT_RANGES, "bytes")
                        .header(HttpHeaders.CONTENT_RANGE, "bytes " + start + "-" + end + "/" + contentLength)
                        .body(region);
            }

            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(contentType))
                    .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + file.getName() + "\"")
                    .header(HttpHeaders.ACCEPT_RANGES, "bytes")
                    .body(resource);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    private String getContentType(String filename) {
        if (filename.endsWith(".mp4"))
            return "video/mp4";
        if (filename.endsWith(".webm"))
            return "video/webm";
        if (filename.endsWith(".ogg"))
            return "video/ogg";
        if (filename.endsWith(".mov"))
            return "video/quicktime";
        if (filename.endsWith(".avi"))
            return "video/x-msvideo";
        if (filename.endsWith(".mkv"))
            return "video/x-matroska";
        return "video/mp4";
    }

    private static final class LimitedInputStream extends InputStream {
        private final InputStream delegate;
        private long remaining;

        private LimitedInputStream(InputStream delegate, long remaining) {
            this.delegate = delegate;
            this.remaining = remaining;
        }

        @Override
        public int read() throws IOException {
            if (remaining == 0) return -1;
            int value = delegate.read();
            if (value >= 0) remaining--;
            return value;
        }

        @Override
        public int read(byte[] buffer, int offset, int length) throws IOException {
            if (remaining == 0) return -1;
            int read = delegate.read(buffer, offset, (int) Math.min(length, remaining));
            if (read > 0) remaining -= read;
            return read;
        }

        @Override
        public void close() throws IOException {
            delegate.close();
        }
    }
}
