package iuh.fit.ConnectionAppBackend.domain.dto;

import java.time.LocalDateTime;
import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MessageResponse {
    private String id;
    private Long conversationId;
    private SenderInfoResponse senderInfo;
    private String content;
    private List<AttachmentResponse> attachments;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private String parentId;
    private boolean isDeleted;
    private LocalDateTime recalledAt;
    private ReplyInfoResponse replyInfo;
    private PollResponse poll;
    private ReminderResponse reminder;
    private List<MessageReactionResponse> reactions;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class SenderInfoResponse {
        private Long senderId;
        private String displayName;
        private String avatarUrl;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class AttachmentResponse {
        private String fileUrl;
        private String type;
        private String originalFileName;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ReplyInfoResponse {
        private String parentId;
        private String parentContent;
        private String parentSenderName;
        private List<AttachmentResponse> parentAttachments;
        private boolean parentRecalled;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class MessageReactionResponse {
        private Long userId;
        private String reactionCode;
        private LocalDateTime reactedAt;
    }
}
