package iuh.fit.ConnectionAppBackend.domain.entity.mongodb;

import iuh.fit.ConnectionAppBackend.domain.entity.mongodb.embedded.SenderInfo;
import iuh.fit.ConnectionAppBackend.domain.entity.mongodb.embedded.Attachment;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.config.EnableMongoAuditing;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Document(collection = "messages")
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@EnableMongoAuditing
public class Message {

    @org.springframework.data.annotation.Id
    private String id;

    @Field("conversation_id")
    private Long conversationId;

    private SenderInfo senderInfo;

    private String content;

    @Builder.Default
    private List<Attachment> attachments = new ArrayList<>();

    @LastModifiedDate
    private LocalDateTime updateAt;

    @CreatedDate
    private LocalDateTime createdAt;

    @Field("parent_id")
    private Long parentId;

    @Field("is_deleted")
    @Builder.Default
    private boolean isDeleted = false;

    // Custom setters for fields with special naming
    public void setIsDeleted(boolean isDeleted) {
        this.isDeleted = isDeleted;
    }

    public void setUpdateAt(LocalDateTime updateAt) {
        this.updateAt = updateAt;
    }

    public void setSenderInfo(SenderInfo senderInfo) {
        this.senderInfo = senderInfo;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public void setConversationId(Long conversationId) {
        this.conversationId = conversationId;
    }

    public void setAttachments(List<Attachment> attachments) {
        this.attachments = attachments;
    }

    public void setParentId(Long parentId) {
        this.parentId = parentId;
    }
}
