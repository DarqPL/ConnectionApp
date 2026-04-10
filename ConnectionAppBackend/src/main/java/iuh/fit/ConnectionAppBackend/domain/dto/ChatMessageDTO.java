package iuh.fit.ConnectionAppBackend.domain.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ChatMessageDTO {
    private Long conversationId;
    private String content;
    private String type; // CHAT, JOIN
}
