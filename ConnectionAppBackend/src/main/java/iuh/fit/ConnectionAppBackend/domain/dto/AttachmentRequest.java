package iuh.fit.ConnectionAppBackend.domain.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AttachmentRequest {
    private String fileUrl;
    private String type;
    private String originalFileName;
}