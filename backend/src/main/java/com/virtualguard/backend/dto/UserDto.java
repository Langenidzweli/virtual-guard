package com.virtualguard.backend.dto;

import com.virtualguard.backend.enums.Role;
import lombok.Data;

import java.util.UUID;

@Data
public class UserDto {
    private UUID id;
    private String email;
    private String name;
    private Role role;
}