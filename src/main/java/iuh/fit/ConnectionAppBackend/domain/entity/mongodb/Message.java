package iuh.fit.ConnectionAppBackend.domain.entity.mongodb;

import iuh.fit.ConnectionAppBackend.domain.entity.mongodb.embedded.SenderInfo;
import iuh.fit.ConnectionAppBackend.domain.entity.mongodb.embedded.Attachment;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Document(collection = "messages")
@Setter
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
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
}
