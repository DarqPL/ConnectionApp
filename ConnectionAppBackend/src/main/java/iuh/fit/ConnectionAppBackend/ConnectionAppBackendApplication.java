package iuh.fit.ConnectionAppBackend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class ConnectionAppBackendApplication {

	public static void main(String[] args) {
		SpringApplication.run(ConnectionAppBackendApplication.class, args);
	}

}
