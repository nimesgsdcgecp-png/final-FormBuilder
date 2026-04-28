package com.sttl.formbuilder2.repository;

import com.sttl.formbuilder2.model.entity.AppUser;
import com.sttl.formbuilder2.model.entity.PasswordResetToken;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, UUID> {
    Optional<PasswordResetToken> findByToken(String token);
    void deleteByUser(AppUser user);
    void deleteByToken(String token);
}
