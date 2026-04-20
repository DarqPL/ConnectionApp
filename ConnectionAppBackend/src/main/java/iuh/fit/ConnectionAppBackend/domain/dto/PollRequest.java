package iuh.fit.ConnectionAppBackend.domain.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PollRequest {
    private String question;
    private List<PollOptionRequest> options;
    private boolean multiChoice;
    private boolean allowAddOptions;
    private boolean isAnonymous;
    private LocalDateTime expiredAt;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class PollOptionRequest {
        private String text;
    }
}
