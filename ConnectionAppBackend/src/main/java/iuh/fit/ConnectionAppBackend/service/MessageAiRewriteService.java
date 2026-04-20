package iuh.fit.ConnectionAppBackend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import iuh.fit.ConnectionAppBackend.domain.common.ConversationType;
import iuh.fit.ConnectionAppBackend.domain.dto.AiRewriteRequest;
import iuh.fit.ConnectionAppBackend.domain.dto.AiRewriteResponse;
import iuh.fit.ConnectionAppBackend.domain.entity.mongodb.Message;
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
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class MessageAiRewriteService {

    public enum RewriteAction {
        TRANSLATE,
        SUGGEST_REPLY,
        REWRITE_STYLE
    }

    private static final Logger logger = LoggerFactory.getLogger(MessageAiRewriteService.class);

    @Value("${app.ai.rewrite.enabled:true}")
    private boolean rewriteEnabled;

    @Value("${app.ai.rewrite.api-key:${app.ai.safety.api-key:}}")
    private String apiKey;

    @Value("${app.ai.rewrite.model:${app.ai.safety.model:gemini-2.0-flash}}")
    private String model;

    @Value("${app.ai.rewrite.fallback-model:gemini-2.0-flash}")
    private String fallbackModel;

    @Value("${app.ai.rewrite.base-url:${app.ai.safety.base-url:https://generativelanguage.googleapis.com}}")
    private String baseUrl;

    @Value("${app.ai.rewrite.timeout-ms:12000}")
    private long timeoutMs;

    @Value("${app.ai.rewrite.max-context-messages:20}")
    private int maxContextMessages;

    @Value("${app.ai.rewrite.max-retries:1}")
    private int maxRetries;

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public MessageAiRewriteService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(8)).build();
    }

    public int getMaxContextMessages() {
        return Math.max(1, maxContextMessages);
    }

    public AiRewriteResponse rewriteDraft(AiRewriteRequest request,
                                          List<Message> recentMessages,
                                          ConversationType conversationType) {
        if (!rewriteEnabled) {
            throw new BadRequestException("AI Rewrite hiện đang tắt");
        }

        if (!StringUtils.hasText(apiKey)) {
            throw new BadRequestException("AI Rewrite chưa được cấu hình");
        }

        RewriteAction action = resolveAction(request.getAction());
        String draft = request.getDraftContent() == null ? "" : request.getDraftContent().trim();
        if (action != RewriteAction.SUGGEST_REPLY && !StringUtils.hasText(draft)) {
            throw new BadRequestException("Vui lòng nhập nội dung trước khi dùng AI Rewrite");
        }
        String contextBlock = buildContextBlock(recentMessages);

        return switch (action) {
            case TRANSLATE -> rewriteTranslate(request, draft, contextBlock);
            case SUGGEST_REPLY -> rewriteSuggestReply(request, draft, contextBlock, conversationType);
            case REWRITE_STYLE -> rewritePoliteAndConcise(request, draft, contextBlock);
        };
    }

    private AiRewriteResponse rewriteTranslate(AiRewriteRequest request, String draft, String contextBlock) {
        String targetLanguage = normalizeTargetLanguage(request.getTargetLanguage());
        String prompt = """
                You are an assistant for chat message rewriting.
                Task: translate the user's drafted text into target language exactly.
                Target language: %s
                Keep meaning accurate and natural for chat. Keep emoji if any.
                Return ONLY JSON object: {"text":"..."}

                Conversation context (latest first, optional):
                %s

                User draft:
                %s
                """.formatted(targetLanguage, contextBlock, draft);

        JsonNode payload = requestGeminiJson(prompt);
        String rewrittenText = payload.path("text").asText("").trim();
        if (!StringUtils.hasText(rewrittenText)) {
            throw new BadRequestException("AI Rewrite trả về dữ liệu không hợp lệ");
        }

        return AiRewriteResponse.builder()
                .conversationId(request.getConversationId())
                .action(RewriteAction.TRANSLATE.name())
                .rewrittenText(rewrittenText)
                .suggestions(List.of())
                .targetLanguage(targetLanguage)
                .build();
    }

    private AiRewriteResponse rewriteSuggestReply(AiRewriteRequest request,
                                                  String draft,
                                                  String contextBlock,
                                                  ConversationType conversationType) {
        String conversationLabel = conversationType == ConversationType.GROUP ? "group" : "private";
        String draftIntention = StringUtils.hasText(draft) ? draft : "(none provided)";

        String prompt = """
                You are an assistant that suggests chat replies.
            Generate exactly 3 distinct reply options based on the recent conversation.
            If user draft intention is provided, use it as an extra hint.
                Keep each suggestion concise, practical, and ready to send.
                Return ONLY JSON object: {"suggestions":["...","...","..."]}

                Conversation type: %s
                Recent messages (latest first):
                %s

                User draft intention (optional):
                %s
                """.formatted(conversationLabel, contextBlock, draftIntention);

        JsonNode payload = requestGeminiJson(prompt);
        JsonNode suggestionsNode = payload.path("suggestions");
        if (!suggestionsNode.isArray()) {
            throw new BadRequestException("AI gợi ý trả lời không hợp lệ");
        }

        List<String> suggestions = new ArrayList<>();
        for (JsonNode item : suggestionsNode) {
            String value = item.asText("").trim();
            if (StringUtils.hasText(value)) {
                suggestions.add(value);
            }
            if (suggestions.size() >= 3) {
                break;
            }
        }

        if (suggestions.isEmpty()) {
            throw new BadRequestException("AI chưa tạo được gợi ý trả lời");
        }

        while (suggestions.size() < 3) {
            suggestions.add(suggestions.get(suggestions.size() - 1));
        }

        return AiRewriteResponse.builder()
                .conversationId(request.getConversationId())
                .action(RewriteAction.SUGGEST_REPLY.name())
                .rewrittenText(null)
                .suggestions(suggestions)
                .targetLanguage(null)
                .build();
    }

    private AiRewriteResponse rewritePoliteAndConcise(AiRewriteRequest request, String draft, String contextBlock) {
        String prompt = """
                You are an assistant for rewriting chat messages.
                Rewrite the user draft to be more polite and concise while preserving the original intent.
                Keep tone natural for messaging and avoid being too formal.
                Return ONLY JSON object: {"text":"..."}

                Conversation context (latest first, optional):
                %s

                User draft:
                %s
                """.formatted(contextBlock, draft);

        JsonNode payload = requestGeminiJson(prompt);
        String rewrittenText = payload.path("text").asText("").trim();
        if (!StringUtils.hasText(rewrittenText)) {
            throw new BadRequestException("AI Rewrite trả về dữ liệu không hợp lệ");
        }

        return AiRewriteResponse.builder()
                .conversationId(request.getConversationId())
                .action(RewriteAction.REWRITE_STYLE.name())
                .rewrittenText(rewrittenText)
                .suggestions(List.of())
                .targetLanguage(null)
                .build();
    }

    private JsonNode requestGeminiJson(String prompt) {
        try {
            Map<String, Object> requestBody = new LinkedHashMap<>();
            requestBody.put("contents", List.of(Map.of(
                    "role", "user",
                    "parts", List.of(Map.of("text", prompt))
            )));
            requestBody.put("generationConfig", Map.of(
                    "responseMimeType", "application/json",
                    "temperature", 0.2
            ));

            List<String> modelsToTry = resolveRewriteModels();
            String requestJson = objectMapper.writeValueAsString(requestBody);

            for (String candidateModel : modelsToTry) {
                for (int attempt = 0; attempt <= Math.max(0, maxRetries); attempt++) {
                    long startedAt = System.currentTimeMillis();
                    HttpResponse<String> response = callGemini(requestJson, candidateModel);
                    long latency = System.currentTimeMillis() - startedAt;
                    int statusCode = response.statusCode();

                    if (statusCode >= 200 && statusCode < 300) {
                        JsonNode responseJson = objectMapper.readTree(response.body());
                        String modelText = responseJson.path("candidates").path(0)
                                .path("content")
                                .path("parts").path(0)
                                .path("text")
                                .asText("");

                        if (!StringUtils.hasText(modelText)) {
                            throw new BadRequestException("AI Rewrite trả về dữ liệu không hợp lệ");
                        }

                        String jsonPayload = extractJson(modelText);
                        return objectMapper.readTree(jsonPayload);
                    }

                    String body = response.body() == null ? "" : response.body();
                    String shortBody = body.length() > 600 ? body.substring(0, 600) + "..." : body;
                    logger.warn("[AiRewrite] Gemini failed status={} model={} attempt={} latencyMs={} body={}",
                            statusCode,
                            candidateModel,
                            attempt + 1,
                            latency,
                            shortBody);

                    if (statusCode == 401 || statusCode == 403) {
                        throw new BadRequestException("Gemini API key không hợp lệ hoặc chưa được cấp quyền");
                    }

                    if (!isRetryableStatus(statusCode) || attempt >= Math.max(0, maxRetries)) {
                        break;
                    }
                }
            }

            throw new BadRequestException("AI Rewrite tạm thời không khả dụng, vui lòng thử lại sau");
        } catch (BadRequestException ex) {
            throw ex;
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new BadRequestException("Không thể xử lý AI Rewrite lúc này", ex);
        } catch (IOException ex) {
            throw new BadRequestException("Không thể xử lý AI Rewrite lúc này", ex);
        }
    }

    private HttpResponse<String> callGemini(String requestJson, String targetModel) throws IOException, InterruptedException {
        String endpoint = trimTrailingSlash(baseUrl)
                + "/v1beta/models/"
                + URLEncoder.encode(targetModel, StandardCharsets.UTF_8)
                + ":generateContent?key="
                + URLEncoder.encode(apiKey, StandardCharsets.UTF_8);

        HttpRequest request = HttpRequest.newBuilder(URI.create(endpoint))
                .header("Content-Type", "application/json")
                .timeout(Duration.ofMillis(Math.max(2000, timeoutMs)))
                .POST(HttpRequest.BodyPublishers.ofString(requestJson))
                .build();

        return httpClient.send(request, HttpResponse.BodyHandlers.ofString());
    }

    private List<String> resolveRewriteModels() {
        LinkedHashSet<String> models = new LinkedHashSet<>();

        if (StringUtils.hasText(model)) {
            models.add(model.trim());
        }
        if (StringUtils.hasText(fallbackModel)) {
            models.add(fallbackModel.trim());
        }

        if (models.isEmpty()) {
            models.add("gemini-2.0-flash");
        }

        return new ArrayList<>(models);
    }

    private boolean isRetryableStatus(int statusCode) {
        return statusCode == 404
                || statusCode == 408
                || statusCode == 429
                || statusCode == 500
                || statusCode == 502
                || statusCode == 503
                || statusCode == 504;
    }

    private RewriteAction resolveAction(String rawAction) {
        if (!StringUtils.hasText(rawAction)) {
            throw new BadRequestException("Action AI Rewrite là bắt buộc");
        }

        try {
            return RewriteAction.valueOf(rawAction.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new BadRequestException("Action AI Rewrite không hỗ trợ: " + rawAction);
        }
    }

    private String normalizeTargetLanguage(String rawTargetLanguage) {
        if (!StringUtils.hasText(rawTargetLanguage)) {
            throw new BadRequestException("Ngôn ngữ đích là bắt buộc cho chức năng dịch");
        }

        String normalized = rawTargetLanguage.trim().toUpperCase(Locale.ROOT);
        if (!"EN".equals(normalized) && !"VI".equals(normalized)) {
            throw new BadRequestException("Hiện tại chỉ hỗ trợ dịch EN hoặc VI");
        }

        return normalized;
    }

    private String buildContextBlock(List<Message> recentMessages) {
        if (recentMessages == null || recentMessages.isEmpty()) {
            return "(no context)";
        }

        List<String> rows = recentMessages.stream()
                .filter(message -> message.getRecalledAt() == null)
                .filter(message -> !message.isDeleted())
                .map(Message::getContent)
                .filter(StringUtils::hasText)
                .map(String::trim)
                .limit(getMaxContextMessages())
                .toList();

        if (rows.isEmpty()) {
            return "(no context)";
        }

        return String.join("\n", rows);
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
}
