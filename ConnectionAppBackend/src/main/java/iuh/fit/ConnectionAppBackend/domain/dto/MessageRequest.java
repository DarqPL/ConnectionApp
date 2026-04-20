package iuh.fit.ConnectionAppBackend.domain.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class MessageRequest {
    private Long conversationId;
    private String content;
    private String parentId;
    private List<AttachmentRequest> attachments;
    private PollRequest poll;
}
