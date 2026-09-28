package com.virtualguard.backend.security;

import com.virtualguard.backend.entity.User;
import java.util.List;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

public class AccountPrincipal extends org.springframework.security.core.userdetails.User {
    private final long authVersion;
    private final boolean mustChangePassword;
    public AccountPrincipal(User user, boolean enabled) {
        super(user.getEmail(), user.getPassword(), enabled, true, true, true,
                List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name())));
        authVersion = user.getAuthVersion();
        mustChangePassword = user.isMustChangePassword();
    }
    public long getAuthVersion() { return authVersion; }
    public boolean isMustChangePassword() { return mustChangePassword; }
}
