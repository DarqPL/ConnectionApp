package iuh.fit.ConnectionAppBackend.domain.entity.mongodb.embedded;

import lombok.*;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PollOption {
    private String id;
    private String text;
    @Builder.Default
    private List<Long> voterIds = new ArrayList<>();
}
