package iuh.fit.ConnectionAppBackend.config;

import iuh.fit.ConnectionAppBackend.domain.common.Role;
import iuh.fit.ConnectionAppBackend.domain.common.UserStatus;
import iuh.fit.ConnectionAppBackend.domain.entity.sql.User;
import iuh.fit.ConnectionAppBackend.repo.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
public class DataInitializer implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.admin.username:admin}")
    private String adminUsername;

    @Value("${app.admin.password:Admin@123456}")
    private String adminPassword;

    @Value("${app.admin.email:admin@appchat.local}")
    private String adminEmail;

    @Value("${app.admin.display-name:Administrator}")
    private String adminDisplayName;

    public DataInitializer(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(String... args) {
        seedAdminUser();
    }

    private void seedAdminUser() {
        if (userRepository.existsByUsername(adminUsername)) {
            log.info("Admin user '{}' already exists, skipping seed.", adminUsername);
            return;
        }

        User admin = User.builder()
                .username(adminUsername)
                .hashPassword(passwordEncoder.encode(adminPassword))
                .email(adminEmail)
                .displayName(adminDisplayName)
                .role(Role.ADMIN)
                .status(UserStatus.ONLINE)
                .tokenVersion(0)
                .webTokenVersion(0)
                .mobileTokenVersion(0)
                .build();

        userRepository.save(admin);
        log.info("Admin user '{}' created successfully.", adminUsername);
    }
}
