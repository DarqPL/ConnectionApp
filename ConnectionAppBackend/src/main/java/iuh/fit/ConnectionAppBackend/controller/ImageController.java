package iuh.fit.ConnectionAppBackend.controller;

import iuh.fit.ConnectionAppBackend.domain.dto.ImageObjectResponse;
import iuh.fit.ConnectionAppBackend.service.S3StorageService;
import iuh.fit.ConnectionAppBackend.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/images")
public class ImageController {

    @Autowired
    private S3StorageService s3StorageService;

    @Autowired
    private UserService userService;

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ImageObjectResponse> uploadImage(
            Authentication authentication,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "folder", required = false) String folder) {

        Long userId = userService.getUserByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();

        String resolvedFolder = folder != null ? folder : "users/" + userId;
        ImageObjectResponse uploaded = s3StorageService.uploadImage(file, resolvedFolder);
        return ResponseEntity.status(HttpStatus.CREATED).body(uploaded);
    }

    @PutMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ImageObjectResponse> replaceImage(
            Authentication authentication,
            @RequestParam("key") String key,
            @RequestParam("file") MultipartFile file) {

        Long userId = userService.getUserByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();

        s3StorageService.assertImageOwnership(key, userId);

        ImageObjectResponse updated = s3StorageService.replaceImage(key, file);
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping
    public ResponseEntity<Void> deleteImage(
            Authentication authentication,
            @RequestParam("key") String key) {

        Long userId = userService.getUserByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();

        s3StorageService.assertImageOwnership(key, userId);

        s3StorageService.deleteImage(key);
        return ResponseEntity.noContent().build();
    }
}
