package iuh.fit.ConnectionAppBackend.domain.entity.mongodb.embedded;

import lombok.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Poll {
    private String question;
    @Builder.Default
    private List<PollOption> options = new ArrayList<>();
    @Builder.Default
    private boolean multiChoice = false;
    @Builder.Default
    private boolean allowAddOptions = false;
    @Builder.Default
    private boolean isAnonymous = false;
    @Builder.Default
    private boolean closed = false;
    private LocalDateTime expiredAt;
}
