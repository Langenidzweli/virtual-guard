package com.virtualguard.backend.security;

import com.virtualguard.backend.entity.User;
import com.virtualguard.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.Collections;

@Service
@RequiredArgsConstructor
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;
    private final com.virtualguard.backend.repository.GuardRepository guardRepository;

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + email));

        var profile = guardRepository.findByUserId(user.getId())
                .or(() -> guardRepository.findByEmail(user.getEmail()));
        boolean enabled = profile.map(guard -> guard.getStatus() == com.virtualguard.backend.enums.GuardStatus.ACTIVE).orElse(true);
        return new AccountPrincipal(user, enabled);
    }
}
