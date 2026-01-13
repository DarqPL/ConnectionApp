package iuh.fit.ConnectionAppBackend.domain.entity.message;

import lombok.*;
import org.springframework.data.mongodb.core.mapping.Field;

@Getter
@Builder
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class SenderInfo {
    private Long id;

    @Field("display_name")
    private String displayName;

    @Field("avatar_url")
    private String avatarUrl;
}
