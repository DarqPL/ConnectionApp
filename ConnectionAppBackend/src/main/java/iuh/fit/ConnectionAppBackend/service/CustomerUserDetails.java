package iuh.fit.ConnectionAppBackend.service;

import iuh.fit.ConnectionAppBackend.domain.common.UserStatus;
import iuh.fit.ConnectionAppBackend.domain.entity.sql.User;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.List;
import java.time.LocalDateTime;


public class CustomerUserDetails implements UserDetails {
    private User user;

    public CustomerUserDetails(User user) {
        this.user = user;
    }

    public User getUser() {
        return user;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name()));
    }

    @Override
    public String getPassword() {
        return user.getHashPassword();
    }

    @Override
    public String getUsername() {
        return user.getUsername();
    }

    @Override
    public boolean isAccountNonExpired() {
       return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        if (user.getStatus() == UserStatus.LOCKED) {
            return false;
        }

        return user.getLockUntil() == null || !user.getLockUntil().isAfter(LocalDateTime.now());
    }

    @Override
    public boolean isEnabled() {
        return user.getStatus() != UserStatus.DELETED;
    }

}
