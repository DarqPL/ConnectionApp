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
public class PollResponse {
    private String question;
    private List<PollOptionResponse> options;
    private boolean multiChoice;
    private boolean allowAddOptions;
    private boolean isAnonymous;
    private boolean closed;
    private LocalDateTime expiredAt;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class PollOptionResponse {
        private String id;
        private String text;
        private List<Long> voterIds;
    }
}
