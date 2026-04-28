package com.sttl.formbuilder2.controller;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;
import com.sttl.formbuilder2.model.entity.AppUser;
import com.sttl.formbuilder2.repository.UserRepository;
import com.sttl.formbuilder2.service.UserService;
import com.sttl.formbuilder2.service.AuditService;
import org.springframework.security.core.session.SessionRegistry;
import org.springframework.security.core.session.SessionInformation;
import com.sttl.formbuilder2.model.entity.PasswordResetToken;
import com.sttl.formbuilder2.repository.PasswordResetTokenRepository;
import com.sttl.formbuilder2.service.EmailNotificationService;
import org.springframework.beans.factory.annotation.Value;
import java.util.UUID;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Collection;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import com.sttl.formbuilder2.util.ApiConstants;

@RestController
@RequestMapping(ApiConstants.AUTH_BASE)
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final UserService userService;
    private final AuditService auditService;
    private final SessionRegistry sessionRegistry;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final EmailNotificationService emailNotificationService;

    @Value("${app.frontend.url:http://localhost:3000}")
    private String frontendUrl;

    public AuthController(AuthenticationManager authenticationManager, 
                          UserRepository userRepository,
                          PasswordEncoder passwordEncoder,
                          UserService userService,
                          AuditService auditService,
                          SessionRegistry sessionRegistry,
                          PasswordResetTokenRepository passwordResetTokenRepository,
                          EmailNotificationService emailNotificationService) {
        this.authenticationManager = authenticationManager;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.userService = userService;
        this.auditService = auditService;
        this.sessionRegistry = sessionRegistry;
        this.passwordResetTokenRepository = passwordResetTokenRepository;
        this.emailNotificationService = emailNotificationService;
    }

    @PostMapping(ApiConstants.AUTH_LOGIN)
    public ResponseEntity<?> login(@RequestBody Map<String, String> credentials, HttpServletRequest request) {
        try {
            String username = credentials.get("username");
            String password = credentials.get("password");

            // 1. Perform Authentication
            UsernamePasswordAuthenticationToken authRequest = new UsernamePasswordAuthenticationToken(username,
                    password);
            Authentication authentication = authenticationManager.authenticate(authRequest);

            // 2. Establish Security Context
            SecurityContext securityContext = SecurityContextHolder.createEmptyContext();
            securityContext.setAuthentication(authentication);
            SecurityContextHolder.setContext(securityContext);

            // 3. Save Security Context to Http Session (crucial for JSESSIONID cookie generation)
            HttpSession session = request.getSession(true);
            session.setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY, securityContext);

            // 4. Manually Handle Session Concurrency Registry
            // This ensures that Spring Security knows about this manual login
            // and can enforce the maximum sessions (1) limit.
            Object principal = authentication.getPrincipal();
            List<SessionInformation> sessions = sessionRegistry.getAllSessions(principal, false);
            for (SessionInformation existingSession : sessions) {
                existingSession.expireNow();
            }
            sessionRegistry.registerNewSession(session.getId(), principal);

            // 5. Get user details for response
            // Identifier could be username or email, but authentication principal usually has the unique identity
            String identifier = authentication.getName();
            AppUser user = userRepository.findByUsername(identifier)
                    .or(() -> userRepository.findByEmail(identifier))
                    .orElseThrow(() -> new RuntimeException("User not found"));
            
            // Extract roles from user
            List<String> roles = user.getUserFormRoles().stream()
                    .map(ufr -> {
                        String roleName = ufr.getRole().getName();
                        return roleName.startsWith("ROLE_") ? roleName : "ROLE_" + roleName;
                    })
                    .collect(Collectors.toList());

            auditService.log("LOGIN", username, "USER", null, "User logged in successfully");
            
            // Return spec-compliant response with userId and roles
            return ResponseEntity.ok(Map.of(
                "userId", user.getId().toString(),
                "username", username,
                "roles", roles
            ));

        } catch (AuthenticationException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Invalid username or password"));
        }
    }

    @PostMapping(ApiConstants.AUTH_LOGOUT)
    public ResponseEntity<?> logout(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null) {
            String username = SecurityContextHolder.getContext().getAuthentication() != null ? 
                             SecurityContextHolder.getContext().getAuthentication().getName() : "unknown";
            auditService.log("LOGOUT", username, "USER", null, "User logged out");
            session.invalidate();
        }
        SecurityContextHolder.clearContext();
        return ResponseEntity.ok(Map.of("message", "Logout successful"));
    }

    @PostMapping(ApiConstants.AUTH_REGISTER)
    public ResponseEntity<?> register(@RequestBody Map<String, String> payload) {
        String username = payload.get("username");
        String password = payload.get("password");

        if (username == null || username.isBlank() || password == null || password.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Username and password are required"));
        }

        if (userRepository.findByUsername(username).isPresent()) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", "Username already exists"));
        }

        String email = payload.get("email");
        if (email != null && !email.isBlank() && userRepository.findByEmail(email).isPresent()) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", "Email already registered"));
        }

        AppUser newUser = new AppUser();
        newUser.setUsername(username);
        newUser.setPasswordHash(passwordEncoder.encode(password));
        newUser.setEmail(email);
        newUser.setFirstName(payload.get("firstName"));
        newUser.setLastName(payload.get("lastName"));

        newUser = userRepository.save(newUser);
        
        // Assign default role
        userService.assignDefaultRole(newUser);

        auditService.log("REGISTER", username, "USER", newUser.getId().toString(), "New user registered");

        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("message", "User registered successfully"));
    }

    @GetMapping(ApiConstants.AUTH_ME)
    public ResponseEntity<?> getCurrentUser(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        AppUser user = userRepository.findByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));

        // Fetch fresh authorities from DB to avoid session staleness
        Set<SimpleGrantedAuthority> permissions = user.getPermissions().stream()
                .map(SimpleGrantedAuthority::new)
                .collect(Collectors.toSet());
        
        Set<SimpleGrantedAuthority> roles = user.getUserFormRoles().stream()
                .map(ufr -> {
                    String roleName = ufr.getRole().getName();
                    return new SimpleGrantedAuthority(roleName.startsWith("ROLE_") ? roleName : "ROLE_" + roleName);
                })
                .collect(Collectors.toSet());

        Collection<SimpleGrantedAuthority> authorities = Stream.concat(permissions.stream(), roles.stream())
                .collect(Collectors.toSet());

        return ResponseEntity.ok(Map.of(
                "id", user.getId(),
                "username", user.getUsername(),
                "email", user.getEmail() != null ? user.getEmail() : "",
                "firstName", user.getFirstName() != null ? user.getFirstName() : "",
                "lastName", user.getLastName() != null ? user.getLastName() : "",
                "roles", authorities));
    }

    @GetMapping(ApiConstants.AUTH_PERMISSIONS)
    public ResponseEntity<?> getUserPermissions(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return ResponseEntity.ok(userService.getUserPermissions(authentication.getName()));
    }

    @PostMapping(ApiConstants.AUTH_FORGOT_PASSWORD)
    @Transactional
    public ResponseEntity<?> forgotPassword(@RequestBody Map<String, String> payload) {
        String usernameOrEmail = payload.get("email");
        if (usernameOrEmail == null || usernameOrEmail.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Email/Username is required"));
        }

        // 1. Try finding by email first
        AppUser user = userRepository.findByEmail(usernameOrEmail).orElse(null);
        
        // 2. Fallback to username
        if (user == null) {
            user = userRepository.findByUsername(usernameOrEmail).orElse(null);
        }

        if (user != null && user.getEmail() != null) {
            // Check Rate Limit
            if (user.getLastResetAttempt() != null && 
                user.getLastResetAttempt().isAfter(LocalDateTime.now().minusHours(1))) {
                
                if (user.getResetAttempts() != null && user.getResetAttempts() >= 3) {
                    return ResponseEntity.status(429).body(Map.of(
                        "message", "Too many reset attempts. Please try again after one hour."
                    ));
                }
                user.setResetAttempts(user.getResetAttempts() + 1);
            } else {
                // Reset limit after 1 hour or first attempt
                user.setResetAttempts(1);
            }
            
            user.setLastResetAttempt(LocalDateTime.now());
            userRepository.save(user);

            // Delete old tokens for user
            passwordResetTokenRepository.deleteByUser(user);

            // Create new token
            PasswordResetToken resetToken = new PasswordResetToken();
            resetToken.setToken(UUID.randomUUID().toString());
            resetToken.setUser(user);
            resetToken.setExpiryDate(LocalDateTime.now().plusHours(2));
            passwordResetTokenRepository.save(resetToken);

            String resetLink = frontendUrl + "/reset-password?token=" + resetToken.getToken();
            String displayName = (user.getFirstName() != null && !user.getFirstName().isEmpty()) 
                                 ? user.getFirstName() : user.getUsername();

            String emailContent = 
                "<html>" +
                "<body style=\"font-family: 'Inter', Arial, sans-serif; background-color: #f8fafc; color: #1e293b; line-height: 1.6; margin: 0; padding: 40px;\">" +
                "  <div style=\"max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);\">" +
                "    <div style=\"background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 32px; text-align: center;\">" +
                "      <h1 style=\"color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.025em;\">FormBuilder Security</h1>" +
                "    </div>" +
                "    <div style=\"padding: 40px;\">" +
                "      <p style=\"font-size: 18px; margin-bottom: 24px;\">Hello <strong>" + displayName + "</strong>,</p>" +
                "      <p style=\"margin-bottom: 32px;\">We received a request to reset your password. If you didn't make this request, you can safely ignore this email.</p>" +
                "      <div style=\"text-align: center; margin-bottom: 32px;\">" +
                "        <a href=\"" + resetLink + "\" style=\"display: inline-block; background-color: #4f46e5; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;\">Reset My Password</a>" +
                "      </div>" +
                "      <p style=\"font-size: 14px; color: #64748b; margin-top: 32px;\">Or copy and paste this link into your browser:</p>" +
                "      <p style=\"font-size: 14px; color: #4f46e5; word-break: break-all;\"><a href=\"" + resetLink + "\" style=\"color: #4f46e5;\">" + resetLink + "</a></p>" +
                "      <hr style=\"border: 0; border-top: 1px solid #e2e8f0; margin: 32px 0;\">" +
                "      <p style=\"font-size: 12px; color: #94a3b8; text-align: center;\"><strong>Security Note:</strong> This link will expire in 2 hours for your protection.</p>" +
                "    </div>" +
                "  </div>" +
                "  <div style=\"text-align: center; margin-top: 24px; font-size: 12px; color: #94a3b8;\">" +
                "    &copy; 2026 FormBuilder Platform. All rights reserved." +
                "  </div>" +
                "</body>" +
                "</html>";
            
            emailNotificationService.sendEmailAsync(user.getEmail(), "Password Reset Request", emailContent);
            
            return ResponseEntity.ok(Map.of(
                "message", "If that email exists, a reset link has been sent.",
                "maskedEmail", maskEmail(user.getEmail())
            ));
        }

        // Always return generic success to prevent email enumeration
        return ResponseEntity.ok(Map.of("message", "If that email exists, a reset link has been sent."));
    }

    private String maskEmail(String email) {
        if (email == null || !email.contains("@")) return "***@***.***";
        int atIndex = email.indexOf("@");
        String prefix = email.substring(0, atIndex);
        String domain = email.substring(atIndex);
        
        if (prefix.length() <= 2) return prefix + "***" + domain;
        return prefix.charAt(0) + "***" + prefix.charAt(prefix.length() - 1) + domain;
    }

    @PostMapping(ApiConstants.AUTH_RESET_PASSWORD)
    @Transactional
    public ResponseEntity<?> resetPassword(@RequestBody Map<String, String> payload) {
        String token = payload.get("token");
        String newPassword = payload.get("password");

        if (token == null || newPassword == null || newPassword.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Token and new password are required"));
        }

        var optToken = passwordResetTokenRepository.findByToken(token);
        if (optToken.isEmpty() || optToken.get().getExpiryDate().isBefore(LocalDateTime.now())) {
            if (optToken.isPresent()) passwordResetTokenRepository.delete(optToken.get());
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid or expired token"));
        }

        PasswordResetToken resetToken = optToken.get();
        AppUser user = resetToken.getUser();
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user.setResetAttempts(0);
        user.setLastResetAttempt(null);
        userRepository.save(user);

        passwordResetTokenRepository.delete(resetToken);
        auditService.log("PASSWORD_RESET", user.getUsername(), "USER", user.getId().toString(), "Password reset successfully via token");

        return ResponseEntity.ok(Map.of("message", "Password reset successfully. You can now login."));
    }
}
