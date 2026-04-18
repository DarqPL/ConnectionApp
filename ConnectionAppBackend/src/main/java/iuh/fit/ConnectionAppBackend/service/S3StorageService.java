package iuh.fit.ConnectionAppBackend.service;

import iuh.fit.ConnectionAppBackend.config.S3Properties;
import iuh.fit.ConnectionAppBackend.domain.dto.ImageObjectResponse;
import iuh.fit.ConnectionAppBackend.exception.ImageNotFoundException;
import iuh.fit.ConnectionAppBackend.exception.ImageValidationException;
import iuh.fit.ConnectionAppBackend.exception.StorageException;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.util.unit.DataSize;
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
import java.util.concurrent.ThreadLocalRandom;
import java.util.UUID;

@Service
public class S3StorageService {

    private static final int RANDOM_SUFFIX_LENGTH = 6;
    private static final int RANDOM_SUFFIX_BOUND = 1_000_000;

    @Value("${app.upload.max-file-size:2MB}")
    private String maxFileSizeLabel;

    private long maxFileSizeBytes;

    @Autowired
    private S3Client s3Client;

    @Autowired
    private S3Properties s3Properties;

    @PostConstruct
    void initUploadLimit() {
        maxFileSizeBytes = DataSize.parse(maxFileSizeLabel).toBytes();
    }

    public ImageObjectResponse uploadImage(MultipartFile file) {
        return uploadImage(file, null);
    }

    public ImageObjectResponse uploadImage(MultipartFile file, String folder) {
        validateFile(file);
        String objectKey = buildNewObjectKey(file.getOriginalFilename(), folder);
        return putImage(file, objectKey);
    }

    public ImageObjectResponse replaceImage(String objectKey, MultipartFile file) {
        if (!StringUtils.hasText(objectKey)) {
            throw new ImageValidationException("IMG_KEY_REQUIRED", "Object key is required");
        }

        String normalizedKey = normalizeKey(objectKey);
        validateFile(file);
        assertObjectExists(normalizedKey);

        return putImage(file, normalizedKey);
    }

    public void deleteImage(String objectKey) {
        if (!StringUtils.hasText(objectKey)) {
            throw new ImageValidationException("IMG_KEY_REQUIRED", "Object key is required");
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
            throw new StorageException("IMG_S3_DELETE_FAILED", "Failed to delete image from S3", ex);
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
            throw new ImageNotFoundException("IMG_NOT_FOUND", "Image not found for key: " + objectKey);
        } catch (S3Exception ex) {
            if (ex.statusCode() == 404) {
                throw new ImageNotFoundException("IMG_NOT_FOUND", "Image not found for key: " + objectKey);
            }
            throw new StorageException("IMG_S3_QUERY_FAILED", "Failed to query image from S3", ex);
        }
    }

    private ImageObjectResponse putImage(MultipartFile file, String objectKey) {
        try {
            byte[] payload = file.getBytes();
            String contentType = StringUtils.hasText(file.getContentType())
                    ? file.getContentType()
                    : "application/octet-stream";

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
            throw new StorageException("IMG_PAYLOAD_READ_FAILED", "Failed to read image payload", ex);
        } catch (S3Exception ex) {
            throw new StorageException("IMG_S3_UPLOAD_FAILED", "Failed to upload image to S3", ex);
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
        String randomSuffix = String.format(
            "%0" + RANDOM_SUFFIX_LENGTH + "d",
            ThreadLocalRandom.current().nextInt(RANDOM_SUFFIX_BOUND)
        );
        String fileName = UUID.randomUUID() + "-" + randomSuffix + extension;

        String prefix = trimSlashes(s3Properties.getKeyPrefix());
        String folderPrefix = trimSlashes(folder);

        if (StringUtils.hasText(folderPrefix)) {
            return StringUtils.hasText(prefix)
                    ? prefix + "/" + folderPrefix + "/" + fileName
                    : folderPrefix + "/" + fileName;
        }

        return StringUtils.hasText(prefix) ? prefix + "/" + fileName : fileName;
    }

    private void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ImageValidationException("IMG_FILE_REQUIRED", "File is required");
        }

        if (file.getSize() > maxFileSizeBytes) {
            throw new ImageValidationException(
                    "IMG_SIZE_EXCEEDED",
                    "File size must not exceed " + maxFileSizeLabel
            );
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

    private String requireBucket() {
        if (!StringUtils.hasText(s3Properties.getBucket())) {
            throw new ImageValidationException("IMG_BUCKET_NOT_CONFIGURED", "S3 bucket is not configured");
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
