package com.virtualguard.backend.dto;

import com.virtualguard.backend.enums.GuardStatus;
import lombok.Data;

import java.time.LocalDate;
import java.util.UUID;

@Data
public class GuardResponseDto {
    private UUID id;
    private String name;
    private String email;
    private String phone;
    private String badgeNumber;
    private GuardStatus status;
    private LocalDate dateJoined;
}