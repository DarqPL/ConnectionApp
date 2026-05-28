package iuh.fit.ConnectionAppBackend.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;
import org.springframework.data.mongodb.config.EnableMongoAuditing;
import org.springframework.data.mongodb.core.convert.MongoCustomConversions;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.Arrays;

@Configuration
@EnableMongoAuditing
public class MongoConfig {

    private static final ZoneId SERVER_TZ = ZoneId.of("Asia/Singapore");

    /**
     * Converts old naive datetime strings (without Z) to Instant.
     * Assumes old timestamps were in Singapore time (EC2 deployment timezone).
     */
    @Bean
    public MongoCustomConversions mongoCustomConversions() {
        return new MongoCustomConversions(Arrays.asList(
            new StringToInstantConverter(),
            new LocalDateTimeToInstantConverter()
        ));
    }

    static class StringToInstantConverter implements Converter<String, Instant> {
        @Override
        public Instant convert(String source) {
            try {
                // New data: proper ISO-8601 with Z suffix
                return Instant.parse(source);
            } catch (DateTimeParseException e) {
                // Old data: naive string without timezone — interpret as Singapore time
                LocalDateTime ldt = LocalDateTime.parse(source);
                return ldt.atZone(SERVER_TZ).toInstant();
            }
        }
    }

    static class LocalDateTimeToInstantConverter implements Converter<LocalDateTime, Instant> {
        @Override
        public Instant convert(LocalDateTime source) {
            // Fallback for any remaining LocalDateTime values stored by Spring Data
            return source.atZone(SERVER_TZ).toInstant();
        }
    }
}
