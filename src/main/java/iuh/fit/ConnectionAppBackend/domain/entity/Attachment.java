package iuh.fit.ConnectionAppBackend.domain.entity;

import lombok.*;
import org.springframework.data.mongodb.core.mapping.Field;

@Getter
@Builder
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Attachment {
    @Field("file_url")
    private String fileUrl;

    @Field("file_type")
    private AttachmentType type;
}
