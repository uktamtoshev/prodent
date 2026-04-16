package com.prodent.security.service;

import com.prodent.entity.User;
import com.prodent.entity.UserRole;
import com.prodent.repository.UserRepository;
import com.prodent.repository.UserRoleRepository;
import com.prodent.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class UserDetailsServiceImpl implements UserDetailsService {

    private final UserRepository userRepository;
    private final UserRoleRepository userRoleRepository;

    @Override
    @Transactional(readOnly = true)
    public UserDetails loadUserByUsername(String usernameOrPhone) throws UsernameNotFoundException {
        User user = userRepository.findByEmailOrPhone(usernameOrPhone, usernameOrPhone)
                .orElseThrow(() -> new UsernameNotFoundException(
                        "User not found with email or phone: " + usernameOrPhone));

        List<UserRole> roles = userRoleRepository.findByUserId(user.getId());
        return new CustomUserDetails(user, roles);
    }

    @Transactional(readOnly = true)
    public CustomUserDetails loadUserById(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UsernameNotFoundException("User not found with id: " + userId));

        List<UserRole> roles = userRoleRepository.findByUserId(user.getId());
        return new CustomUserDetails(user, roles);
    }
}
