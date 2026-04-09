package iuh.fit.ConnectionAppBackend.controller;

import iuh.fit.ConnectionAppBackend.domain.dto.ImageObjectResponse;
import iuh.fit.ConnectionAppBackend.service.S3StorageService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
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

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ImageObjectResponse> uploadImage(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "folder", required = false) String folder) {

        ImageObjectResponse uploaded = s3StorageService.uploadImage(file, folder);
        return ResponseEntity.status(HttpStatus.CREATED).body(uploaded);
    }

    @PutMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ImageObjectResponse> replaceImage(
            @RequestParam("key") String key,
            @RequestParam("file") MultipartFile file) {

        ImageObjectResponse updated = s3StorageService.replaceImage(key, file);
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping
    public ResponseEntity<Void> deleteImage(@RequestParam("key") String key) {
        s3StorageService.deleteImage(key);
        return ResponseEntity.noContent().build();
    }
}
