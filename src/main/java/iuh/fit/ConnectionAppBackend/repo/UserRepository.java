package iuh.fit.ConnectionAppBackend.repo;

import iuh.fit.ConnectionAppBackend.domain.entity.sql.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User,Long> {
    Optional<User> findByUsername(String username);

    boolean existsByUsername(String username);
}
