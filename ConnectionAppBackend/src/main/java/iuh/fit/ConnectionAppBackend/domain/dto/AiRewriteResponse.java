package iuh.fit.ConnectionAppBackend.domain.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AiRewriteResponse {
    private Long conversationId;
    private String action;
    private String rewrittenText;
    private List<String> suggestions;
    private String targetLanguage;
}
