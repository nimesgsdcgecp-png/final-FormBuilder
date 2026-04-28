package com.sttl.formbuilder2.model.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "password_reset_tokens")
@Getter
@Setter
public class PasswordResetToken {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true)
    private String token;

    @OneToOne(targetEntity = AppUser.class, fetch = FetchType.EAGER)
    @JoinColumn(nullable = false, name = "user_id")
    private AppUser user;

    @Column(name = "expiry_date", nullable = false)
    private LocalDateTime expiryDate;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;
}
