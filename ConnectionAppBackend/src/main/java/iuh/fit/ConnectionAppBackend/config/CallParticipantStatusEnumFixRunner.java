package iuh.fit.ConnectionAppBackend.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class CallParticipantStatusEnumFixRunner implements ApplicationRunner {

    private static final Logger logger = LoggerFactory.getLogger(CallParticipantStatusEnumFixRunner.class);

    private final JdbcTemplate jdbcTemplate;

    public CallParticipantStatusEnumFixRunner(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(ApplicationArguments args) {
        try {
            ensureWaitingEnumValue();
        } catch (Exception ex) {
            logger.warn("Failed to auto-fix call_participants status ENUM: {}", ex.getMessage());
        }
    }

    private void ensureWaitingEnumValue() {
        List<String> enumValues = jdbcTemplate.queryForList(
                """
                SELECT COLUMN_TYPE
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'call_participants'
                  AND COLUMN_NAME = 'status'
                """,
                String.class
        );

        if (enumValues.isEmpty()) {
            return;
        }

        String columnType = enumValues.get(0);
        if (columnType.contains("WAITING")) {
            return;
        }

        jdbcTemplate.execute(
                "ALTER TABLE call_participants MODIFY COLUMN status " +
                "ENUM('DECLINED','JOINED','LEFT','MISSED','RINGING','WAITING') NOT NULL"
        );
        logger.info("Added WAITING to call_participants.status ENUM");
    }
}
