package iuh.fit.ConnectionAppBackend.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.StringUtils;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;

import java.net.URI;

@Configuration
@EnableConfigurationProperties(S3Properties.class)
public class S3ClientConfig {

    @Bean
    public S3Client s3Client(S3Properties s3Properties) {
        software.amazon.awssdk.services.s3.S3ClientBuilder builder = S3Client.builder()
                .region(Region.of(s3Properties.getRegion()));

        if (StringUtils.hasText(s3Properties.getAccessKey()) && StringUtils.hasText(s3Properties.getSecretKey())) {
            builder.credentialsProvider(
                    StaticCredentialsProvider.create(
                            AwsBasicCredentials.create(s3Properties.getAccessKey(), s3Properties.getSecretKey())
                    )
            );
        }

        if (StringUtils.hasText(s3Properties.getEndpoint())) {
            builder.endpointOverride(URI.create(s3Properties.getEndpoint()));
            builder.serviceConfiguration(
                    S3Configuration.builder()
                            .pathStyleAccessEnabled(true)
                            .build()
            );
        }

        return builder.build();
    }
}
