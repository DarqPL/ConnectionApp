package iuh.fit.ConnectionAppBackend.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class RefreshTokenSchemaFixRunner implements ApplicationRunner {

    private static final Logger logger = LoggerFactory.getLogger(RefreshTokenSchemaFixRunner.class);

    private final JdbcTemplate jdbcTemplate;

    public RefreshTokenSchemaFixRunner(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(ApplicationArguments args) {
        try {
            ensureUserIdIndexExists();
            dropUniqueUserIdIndexes();
        } catch (Exception ex) {
            logger.warn("Failed to auto-fix refesh_tokens schema: {}", ex.getMessage());
        }
    }

    private void ensureUserIdIndexExists() {
        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_refesh_tokens_user_id ON refesh_tokens(user_id)");
    }

    private void dropUniqueUserIdIndexes() {
        List<String> uniqueUserIdIndexes = jdbcTemplate.queryForList(
                """
                SELECT DISTINCT INDEX_NAME
                FROM INFORMATION_SCHEMA.STATISTICS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'refesh_tokens'
                  AND COLUMN_NAME = 'user_id'
                  AND NON_UNIQUE = 0
                """,
                String.class
        );

        for (String indexName : uniqueUserIdIndexes) {
            jdbcTemplate.execute("ALTER TABLE refesh_tokens DROP INDEX `" + indexName + "`");
            logger.info("Dropped legacy unique index '{}' on refesh_tokens.user_id", indexName);
        }
    }
}
