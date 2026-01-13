package iuh.fit.ConnectionAppBackend.domain.entity.message;

import iuh.fit.ConnectionAppBackend.domain.common.MessageType;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Document(collation = "messages")
@Setter
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Message {

    @Id
    private String id;

    @Field("conversation_id")
    private Long conversationId;


    private SenderInfo senderInfo;

    private String content;

    // attachments: [{file_url, file_type}, ...]
    @Builder.Default
    private List<Attachment> attachments = new ArrayList<>();

    @LastModifiedDate
    private LocalDateTime updateAt;

    @CreatedDate
    private LocalDateTime createdAt;

    @Field("parent_id")
    private Long parantId;

    @Enumerated(EnumType.STRING)
    private MessageType messageType;

    @Field("is_deleted")
    @Builder.Default
    private boolean isDeleted = false;

}
