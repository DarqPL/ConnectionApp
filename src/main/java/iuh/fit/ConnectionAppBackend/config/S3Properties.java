package iuh.fit.ConnectionAppBackend.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "app.s3")
public class S3Properties {
    private String region = "ap-southeast-1";
    private String bucket;
    private String accessKey;
    private String secretKey;
    private String endpoint;
    private String publicBaseUrl;
    private String keyPrefix = "images";
}
