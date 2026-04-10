package iuh.fit.ConnectionAppBackend.domain.entity.mongodb.embedded;

import lombok.*;
import org.springframework.data.mongodb.core.mapping.Field;

@Getter
@Builder
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class SenderInfo {
    @Field("sender_id")
    private Long senderId;

    @Field("display_name")
    private String displayName;

    @Field("avatar_url")
    private String avatarUrl;
}
