package iuh.fit.ConnectionAppBackend.domain.entity.mongodb.embedded;

import iuh.fit.ConnectionAppBackend.domain.common.AttachmentType;
import jakarta.validation.constraints.NotBlank;
import lombok.*;
import org.springframework.data.mongodb.core.mapping.Field;

@Getter
@Builder
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Attachment {
    @Field("file_url")
    @NotBlank(message = "File URL không được để trống")
    private String fileUrl;

    @Field("file_type")
    private AttachmentType type;

    @Field("original_file_name")
    private String originalFileName;
}
