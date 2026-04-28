package com.sttl.formbuilder2.repository;

import java.util.UUID;
import com.sttl.formbuilder2.model.entity.AppUser;
import org.springframework.data.jpa.repository.JpaRepository;

import org.springframework.data.jpa.repository.EntityGraph;
import java.util.Optional;

public interface UserRepository extends JpaRepository<AppUser, UUID> {
    
    @EntityGraph(attributePaths = {"userFormRoles", "userFormRoles.role", "userFormRoles.role.permissions"})
    Optional<AppUser> findByUsername(String username);

    @EntityGraph(attributePaths = {"userFormRoles", "userFormRoles.role", "userFormRoles.role.permissions"})
    Optional<AppUser> findByEmail(String email);
}
