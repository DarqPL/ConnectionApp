package iuh.fit.ConnectionAppBackend.service;

import iuh.fit.ConnectionAppBackend.config.S3Properties;
import iuh.fit.ConnectionAppBackend.domain.dto.ImageObjectResponse;
import iuh.fit.ConnectionAppBackend.exception.BadRequestException;
import iuh.fit.ConnectionAppBackend.exception.ResourceNotFoundException;
import iuh.fit.ConnectionAppBackend.exception.StorageException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;

import java.io.IOException;
import java.net.URI;
import java.util.Set;
import java.util.UUID;

@Service
public class S3StorageService {

    private static final long MAX_IMAGE_SIZE_BYTES = 5L * 1024L * 1024L;
    private static final Set<String> ALLOWED_IMAGE_EXTENSIONS = Set.of(
            "jpg", "jpeg", "png", "gif", "webp", "bmp", "tif", "tiff", "svg"
    );

    @Autowired
    private S3Client s3Client;

    @Autowired
    private S3Properties s3Properties;

    public ImageObjectResponse uploadImage(MultipartFile file) {
        return uploadImage(file, null);
    }

    public ImageObjectResponse uploadImage(MultipartFile file, String folder) {
        validateImage(file);
        String objectKey = buildNewObjectKey(file.getOriginalFilename(), folder);
        return putImage(file, objectKey);
    }

    public ImageObjectResponse replaceImage(String objectKey, MultipartFile file) {
        if (!StringUtils.hasText(objectKey)) {
            throw new BadRequestException("Object key is required");
        }

        String normalizedKey = normalizeKey(objectKey);
        validateImage(file);
        assertObjectExists(normalizedKey);

        return putImage(file, normalizedKey);
    }

    public void deleteImage(String objectKey) {
        if (!StringUtils.hasText(objectKey)) {
            throw new BadRequestException("Object key is required");
        }

        String normalizedKey = normalizeKey(objectKey);
        assertObjectExists(normalizedKey);

        try {
            s3Client.deleteObject(
                    DeleteObjectRequest.builder()
                            .bucket(requireBucket())
                            .key(normalizedKey)
                            .build()
            );
        } catch (S3Exception ex) {
            throw new StorageException("Failed to delete image from S3", ex);
        }
    }

    public String extractObjectKeyFromUrl(String imageUrl) {
        if (!StringUtils.hasText(imageUrl)) {
            return null;
        }

        String normalizedPublicBase = trimTrailingSlash(s3Properties.getPublicBaseUrl());
        if (StringUtils.hasText(normalizedPublicBase) && imageUrl.startsWith(normalizedPublicBase + "/")) {
            return imageUrl.substring((normalizedPublicBase + "/").length());
        }

        try {
            URI uri = URI.create(imageUrl);
            String path = uri.getPath();
            if (!StringUtils.hasText(path)) {
                return null;
            }

            String normalizedPath = path.startsWith("/") ? path.substring(1) : path;
            String bucket = requireBucket();

            if (normalizedPath.startsWith(bucket + "/")) {
                return normalizedPath.substring((bucket + "/").length());
            }

            String host = uri.getHost();
            if (StringUtils.hasText(host) && host.startsWith(bucket + ".")) {
                return normalizedPath;
            }
            return null;
        } catch (Exception ignored) {
            return null;
        }
    }

    private void assertObjectExists(String objectKey) {
        try {
            s3Client.headObject(
                    HeadObjectRequest.builder()
                            .bucket(requireBucket())
                            .key(objectKey)
                            .build()
            );
        } catch (NoSuchKeyException ex) {
            throw new ResourceNotFoundException("Image not found for key: " + objectKey);
        } catch (S3Exception ex) {
            if (ex.statusCode() == 404) {
                throw new ResourceNotFoundException("Image not found for key: " + objectKey);
            }
            throw new StorageException("Failed to query image from S3", ex);
        }
    }

    private ImageObjectResponse putImage(MultipartFile file, String objectKey) {
        try {
            byte[] payload = file.getBytes();
            String contentType = file.getContentType();

            PutObjectRequest request = PutObjectRequest.builder()
                    .bucket(requireBucket())
                    .key(objectKey)
                    .contentType(contentType)
                    .contentLength((long) payload.length)
                    .build();

            s3Client.putObject(request, RequestBody.fromBytes(payload));

            return ImageObjectResponse.builder()
                    .objectKey(objectKey)
                    .imageUrl(buildObjectUrl(objectKey))
                    .contentType(contentType)
                    .size(file.getSize())
                    .build();
        } catch (IOException ex) {
            throw new StorageException("Failed to read image payload", ex);
        } catch (S3Exception ex) {
            throw new StorageException("Failed to upload image to S3", ex);
        }
    }

    private String buildObjectUrl(String objectKey) {
        String normalizedPublicBase = trimTrailingSlash(s3Properties.getPublicBaseUrl());
        if (StringUtils.hasText(normalizedPublicBase)) {
            return normalizedPublicBase + "/" + objectKey;
        }

        if (StringUtils.hasText(s3Properties.getEndpoint())) {
            return trimTrailingSlash(s3Properties.getEndpoint()) + "/" + requireBucket() + "/" + objectKey;
        }

        return "https://" + requireBucket() + ".s3." + s3Properties.getRegion() + ".amazonaws.com/" + objectKey;
    }

    private String buildNewObjectKey(String originalFilename, String folder) {
        String extension = extractExtension(originalFilename);
        String fileName = UUID.randomUUID() + extension;

        String prefix = trimSlashes(s3Properties.getKeyPrefix());
        String folderPrefix = trimSlashes(folder);

        if (StringUtils.hasText(folderPrefix)) {
            return StringUtils.hasText(prefix)
                    ? prefix + "/" + folderPrefix + "/" + fileName
                    : folderPrefix + "/" + fileName;
        }

        return StringUtils.hasText(prefix) ? prefix + "/" + fileName : fileName;
    }

    private void validateImage(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Image file is required");
        }

        if (file.getSize() > MAX_IMAGE_SIZE_BYTES) {
            throw new BadRequestException("Image size must not exceed 5MB");
        }

        String contentType = file.getContentType();
        if (!StringUtils.hasText(contentType) || !contentType.startsWith("image/")) {
            throw new BadRequestException("Only image files are allowed");
        }

        String extension = extractExtensionWithoutDot(file.getOriginalFilename());
        if (!StringUtils.hasText(extension) || !ALLOWED_IMAGE_EXTENSIONS.contains(extension)) {
            throw new BadRequestException("Only image extensions are allowed: jpg, jpeg, png, gif, webp, bmp, tif, tiff, svg");
        }
    }

    private String normalizeKey(String objectKey) {
        return objectKey.startsWith("/") ? objectKey.substring(1) : objectKey;
    }

    private String extractExtension(String originalFilename) {
        if (!StringUtils.hasText(originalFilename) || !originalFilename.contains(".")) {
            return "";
        }
        return originalFilename.substring(originalFilename.lastIndexOf('.')).toLowerCase();
    }

    private String extractExtensionWithoutDot(String originalFilename) {
        String extensionWithDot = extractExtension(originalFilename);
        if (!StringUtils.hasText(extensionWithDot)) {
            return "";
        }
        return extensionWithDot.substring(1);
    }

    private String requireBucket() {
        if (!StringUtils.hasText(s3Properties.getBucket())) {
            throw new BadRequestException("S3 bucket is not configured");
        }
        return s3Properties.getBucket();
    }

    private String trimTrailingSlash(String value) {
        if (!StringUtils.hasText(value)) {
            return value;
        }
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }

    private String trimSlashes(String value) {
        if (!StringUtils.hasText(value)) {
            return value;
        }

        int start = 0;
        int end = value.length();

        while (start < end && value.charAt(start) == '/') {
            start++;
        }
        while (end > start && value.charAt(end - 1) == '/') {
            end--;
        }
        return value.substring(start, end);
    }
}
