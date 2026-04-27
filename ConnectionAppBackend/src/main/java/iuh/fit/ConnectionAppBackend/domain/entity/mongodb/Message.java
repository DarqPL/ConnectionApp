package iuh.fit.ConnectionAppBackend.domain.entity.mongodb;

import iuh.fit.ConnectionAppBackend.domain.entity.mongodb.embedded.SenderInfo;
import iuh.fit.ConnectionAppBackend.domain.entity.mongodb.embedded.Attachment;
import iuh.fit.ConnectionAppBackend.domain.entity.mongodb.embedded.MessageReaction;
import iuh.fit.ConnectionAppBackend.domain.entity.mongodb.embedded.Poll;
import iuh.fit.ConnectionAppBackend.domain.entity.mongodb.embedded.ReminderInfo;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.config.EnableMongoAuditing;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@CompoundIndexes({
    @CompoundIndex(name = "conversation_deleted_created_idx", def = "{'conversation_id': 1, 'is_deleted': 1, 'createdAt': -1}"),
    @CompoundIndex(name = "reminder_notified_time_idx", def = "{'reminder.notified': 1, 'reminder.reminderTime': 1}")
})
@Document(collection = "messages")
@Getter
@Setter
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

    private Poll poll;

    private ReminderInfo reminder;

    @Builder.Default
    private List<Attachment> attachments = new ArrayList<>();

    @Builder.Default
    private List<MessageReaction> reactions = new ArrayList<>();

    @LastModifiedDate
    private LocalDateTime updateAt;

    @CreatedDate
    private LocalDateTime createdAt;

    @Field("parent_id")
    private String parentId;

    @Field("recalled_at")
    private LocalDateTime recalledAt;

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

    public void setReactions(List<MessageReaction> reactions) {
        this.reactions = reactions;
    }

    public void setParentId(String parentId) {
        this.parentId = parentId;
    }

    public void setRecalledAt(LocalDateTime recalledAt) {
        this.recalledAt = recalledAt;
    }

    public void setPoll(Poll poll) {
        this.poll = poll;
    }

    public void setReminder(ReminderInfo reminder) {
        this.reminder = reminder;
    }
}
