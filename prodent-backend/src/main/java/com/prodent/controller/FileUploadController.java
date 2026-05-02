package com.prodent.controller;

import com.prodent.exception.BadRequestException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/v1/admin/uploads")
@RequiredArgsConstructor
public class FileUploadController {

    @Value("${app.storage.local-path:./uploads}")
    private String storageRoot;

    @Value("${app.storage.max-file-size:10485760}")
    private long maxFileSize;

    private static final Set<String> ALLOWED_FOLDERS = Set.of("promotions", "blog", "clinics", "doctors");
    private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of(
            "image/jpeg", "image/png", "image/webp", "image/gif"
    );
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of("jpg", "jpeg", "png", "webp", "gif");

    @PostMapping(value = "/{folder}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('ADMIN') or hasRole('SUPER_ADMIN')")
    public ResponseEntity<Map<String, String>> uploadImage(@PathVariable String folder,
                                                           @RequestPart("file") MultipartFile file) throws IOException {
        if (!ALLOWED_FOLDERS.contains(folder)) {
            throw new BadRequestException("Folder not allowed: " + folder);
        }
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("File is empty");
        }
        if (file.getSize() > maxFileSize) {
            throw new BadRequestException("File too large (max " + (maxFileSize / 1024 / 1024) + " MB)");
        }
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_CONTENT_TYPES.contains(contentType.toLowerCase(Locale.ROOT))) {
            throw new BadRequestException("Unsupported content type: " + contentType);
        }

        String originalName = file.getOriginalFilename() == null ? "image" : file.getOriginalFilename();
        String ext = extractExtension(originalName, contentType);

        Path folderPath = Paths.get(storageRoot, folder).toAbsolutePath().normalize();
        Files.createDirectories(folderPath);

        String filename = UUID.randomUUID() + "." + ext;
        Path target = folderPath.resolve(filename).normalize();
        if (!target.startsWith(folderPath)) {
            throw new BadRequestException("Invalid filename");
        }

        try (var in = file.getInputStream()) {
            Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
        }

        String publicUrl = "/uploads/" + folder + "/" + filename;
        log.info("Uploaded {} ({} bytes) -> {}", originalName, file.getSize(), publicUrl);
        return ResponseEntity.ok(Map.of(
                "url", publicUrl,
                "filename", filename,
                "size", String.valueOf(file.getSize())
        ));
    }

    private String extractExtension(String filename, String contentType) {
        int dot = filename.lastIndexOf('.');
        if (dot >= 0 && dot < filename.length() - 1) {
            String ext = filename.substring(dot + 1).toLowerCase(Locale.ROOT);
            if (ALLOWED_EXTENSIONS.contains(ext)) {
                return ext.equals("jpeg") ? "jpg" : ext;
            }
        }
        // Fallback to content-type
        return switch (contentType.toLowerCase(Locale.ROOT)) {
            case "image/png" -> "png";
            case "image/webp" -> "webp";
            case "image/gif" -> "gif";
            default -> "jpg";
        };
    }
}
