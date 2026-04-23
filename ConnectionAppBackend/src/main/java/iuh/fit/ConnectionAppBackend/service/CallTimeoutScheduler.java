package iuh.fit.ConnectionAppBackend.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class CallTimeoutScheduler {

    private final CallService callService;

    @Scheduled(fixedDelayString = "${app.call.timeout-scan-ms:5000}")
    public void processCallTimeouts() {
        int processed = callService.processRingingTimeouts();
        if (processed > 0) {
            log.info("Call timeout sweep completed, processed {} call(s)", processed);
        }
    }
}
