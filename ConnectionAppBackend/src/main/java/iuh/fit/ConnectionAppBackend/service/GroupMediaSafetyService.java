package iuh.fit.ConnectionAppBackend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import iuh.fit.ConnectionAppBackend.domain.common.AttachmentType;
import iuh.fit.ConnectionAppBackend.domain.common.ConversationType;
import iuh.fit.ConnectionAppBackend.domain.entity.mongodb.embedded.Attachment;
import iuh.fit.ConnectionAppBackend.exception.BadRequestException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

@Service
public class GroupMediaSafetyService {

    public record SafetyVerdict(boolean blocked, double confidence, String reason) {
    }

    public enum ConversationScope {
        GROUP,
        PRIVATE,
        BOTH
    }

    private static final Logger logger = LoggerFactory.getLogger(GroupMediaSafetyService.class);

    @Value("${app.ai.safety.enabled:true}")
    private boolean enabled;

    @Value("${app.ai.safety.api-key:}")
    private String apiKey;

    @Value("${app.ai.safety.model:gemini-2.0-flash}")
    private String model;

    @Value("${app.ai.safety.base-url:https://generativelanguage.googleapis.com}")
    private String baseUrl;

    @Value("${app.ai.safety.timeout-ms:12000}")
    private long timeoutMs;

    @Value("${app.ai.safety.high-confidence-threshold:0.85}")
    private double highConfidenceThreshold;

    @Value("${app.ai.safety.conversation-scope:GROUP}")
    private String conversationScope;

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public GroupMediaSafetyService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(8)).build();
    }

    public SafetyVerdict scanGroupMedia(List<Attachment> attachments) {
        if (!enabled) {
            return new SafetyVerdict(false, 0D, "Safety filter disabled");
        }

        List<Attachment> mediaAttachments = attachments.stream()
                .filter(Objects::nonNull)
                .filter(this::isScannableMedia)
                .toList();

        if (mediaAttachments.isEmpty()) {
            return new SafetyVerdict(false, 0D, "No media attachment to scan");
        }

        if (!StringUtils.hasText(apiKey)) {
            throw new BadRequestException("Safety filter chưa được cấu hình");
        }

        for (Attachment attachment : mediaAttachments) {
            SafetyVerdict verdict = scanSingleAttachment(attachment);
            if (verdict.blocked()) {
                return verdict;
            }
        }

        return new SafetyVerdict(false, 0D, "Media passed policy checks");
    }

    public boolean shouldScanConversation(ConversationType conversationType) {
        if (!enabled || conversationType == null) {
            return false;
        }

        ConversationScope scope = resolveConversationScope();
        return switch (scope) {
            case GROUP -> conversationType == ConversationType.GROUP;
            case PRIVATE -> conversationType == ConversationType.PRIVATE;
            case BOTH -> conversationType == ConversationType.GROUP || conversationType == ConversationType.PRIVATE;
        };
    }

    private SafetyVerdict scanSingleAttachment(Attachment attachment) {
        long startedAt = System.currentTimeMillis();
        try {
            byte[] mediaBytes = downloadMedia(attachment.getFileUrl());
            String mimeType = resolveMimeType(attachment, attachment.getFileUrl());
            SafetyVerdict verdict = requestGeminiVerdict(mediaBytes, mimeType);
            long latency = System.currentTimeMillis() - startedAt;

            logger.info(
                    "[SafetyFilter] scanned attachment type={} blocked={} confidence={} latencyMs={}",
                    attachment.getType(),
                    verdict.blocked(),
                    verdict.confidence(),
                    latency
            );

            return verdict;
        } catch (BadRequestException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new BadRequestException("Không thể quét nội dung media. Vui lòng thử lại.");
        }
    }

    private SafetyVerdict requestGeminiVerdict(byte[] mediaBytes, String mimeType) throws IOException, InterruptedException {
        String encoded = Base64.getEncoder().encodeToString(mediaBytes);

        Map<String, Object> inlineData = Map.of(
            "mimeType", mimeType,
            "data", encoded
        );

        String prompt = """
                You are a strict media safety checker for a chat application.
                Determine whether this media violates policy (adult sexual content, explicit nudity, child sexual content,
                graphic violence, self-harm encouragement, or other severe unsafe sexual content).
                Reply ONLY with JSON object:
                {"violation": true|false, "confidence": 0.0-1.0, "reason": "short reason"}
                """;

        Map<String, Object> requestBody = new LinkedHashMap<>();
        requestBody.put("contents", List.of(Map.of(
                "role", "user",
                "parts", List.of(
                        Map.of("text", prompt),
                Map.of("inlineData", inlineData)
                )
        )));
        requestBody.put("generationConfig", Map.of(
                "responseMimeType", "application/json",
                "temperature", 0
        ));

        String endpoint = trimTrailingSlash(baseUrl)
                + "/v1beta/models/"
                + URLEncoder.encode(model, StandardCharsets.UTF_8)
                + ":generateContent?key="
                + URLEncoder.encode(apiKey, StandardCharsets.UTF_8);

        HttpRequest request = HttpRequest.newBuilder(URI.create(endpoint))
                .header("Content-Type", "application/json")
                .timeout(Duration.ofMillis(Math.max(2000, timeoutMs)))
                .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(requestBody)))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            String body = response.body() == null ? "" : response.body();
            String shortBody = body.length() > 800 ? body.substring(0, 800) + "..." : body;

            logger.warn(
                    "[SafetyFilter] Gemini request failed status={} model={} body={}",
                    response.statusCode(),
                    model,
                    shortBody
            );

            if (response.statusCode() == 401 || response.statusCode() == 403) {
                throw new BadRequestException("Gemini API key không hợp lệ hoặc chưa được cấp quyền");
            }

            throw new BadRequestException("Safety filter tạm thời không khả dụng");
        }

        JsonNode responseJson = objectMapper.readTree(response.body());
        String modelText = responseJson.path("candidates").path(0)
                .path("content")
                .path("parts").path(0)
                .path("text")
                .asText("");

        if (!StringUtils.hasText(modelText)) {
            throw new BadRequestException("Safety filter trả về dữ liệu không hợp lệ");
        }

        String jsonPayload = extractJson(modelText);
        JsonNode verdictNode = objectMapper.readTree(jsonPayload);

        boolean violation = verdictNode.path("violation").asBoolean(false);
        double confidence = verdictNode.path("confidence").asDouble(0D);
        String reason = verdictNode.path("reason").asText("Media violates policy");

        boolean blocked = violation && confidence >= highConfidenceThreshold;
        return new SafetyVerdict(blocked, confidence, reason);
    }

    private byte[] downloadMedia(String fileUrl) throws IOException, InterruptedException {
        if (!StringUtils.hasText(fileUrl)) {
            throw new BadRequestException("Attachment URL is required for safety scan");
        }

        HttpRequest request = HttpRequest.newBuilder(URI.create(fileUrl.trim()))
                .GET()
                .timeout(Duration.ofMillis(Math.max(2000, timeoutMs)))
                .build();

        HttpResponse<byte[]> response = httpClient.send(request, HttpResponse.BodyHandlers.ofByteArray());
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new BadRequestException("Không tải được media để quét nội dung");
        }

        return response.body();
    }

    private boolean isScannableMedia(Attachment attachment) {
        AttachmentType type = attachment.getType();
        return type == AttachmentType.IMAGE || type == AttachmentType.VIDEO;
    }

    private String resolveMimeType(Attachment attachment, String fileUrl) {
        if (attachment.getType() == AttachmentType.IMAGE) {
            return guessImageMime(fileUrl);
        }

        String lower = fileUrl == null ? "" : fileUrl.toLowerCase(Locale.ROOT);
        if (lower.endsWith(".mov")) {
            return "video/quicktime";
        }
        if (lower.endsWith(".webm")) {
            return "video/webm";
        }
        return "video/mp4";
    }

    private String guessImageMime(String fileUrl) {
        String lower = fileUrl == null ? "" : fileUrl.toLowerCase(Locale.ROOT);
        if (lower.endsWith(".png")) {
            return "image/png";
        }
        if (lower.endsWith(".webp")) {
            return "image/webp";
        }
        if (lower.endsWith(".gif")) {
            return "image/gif";
        }
        if (lower.endsWith(".bmp")) {
            return "image/bmp";
        }
        return "image/jpeg";
    }

    private String extractJson(String rawText) {
        String text = rawText.trim();
        if (text.startsWith("```") && text.endsWith("```")) {
            text = text.replaceFirst("^```(?:json)?", "").replaceFirst("```$", "").trim();
        }

        int start = text.indexOf('{');
        int end = text.lastIndexOf('}');
        if (start >= 0 && end > start) {
            return text.substring(start, end + 1);
        }

        return text;
    }

    private String trimTrailingSlash(String value) {
        if (!StringUtils.hasText(value)) {
            return "";
        }
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }

    private ConversationScope resolveConversationScope() {
        if (!StringUtils.hasText(conversationScope)) {
            return ConversationScope.GROUP;
        }

        try {
            return ConversationScope.valueOf(conversationScope.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            logger.warn("[SafetyFilter] Invalid conversation scope '{}', fallback to GROUP", conversationScope);
            return ConversationScope.GROUP;
        }
    }
}
