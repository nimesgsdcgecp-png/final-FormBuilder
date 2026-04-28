package com.sttl.formbuilder2.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;

@Configuration
@EnableWebSecurity
@org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity
public class SecurityConfig {

    private final CustomUserDetailsService userDetailsService;

    public SecurityConfig(CustomUserDetailsService userDetailsService) {
        this.userDetailsService = userDetailsService;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                // 1. Disable CSRF since Next.js fetch() handles its own state, but keep it
                // standard if needed.
                // For a pure API backend consumed by a decoupled Next.js frontend, CSRF is
                // often disabled
                // in favor of SameSite=Lax on the sessionId cookie (default in modern
                // browsers).
                .csrf(csrf -> csrf.disable())

                // 2. Enable CORS with credentials (important for JSESSIONID cookie)
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))

                // 3. Configure rules
                .authorizeHttpRequests(auth -> auth
                        // 1. Allow Swagger / OpenAPI completely (Highest Priority)
                        .requestMatchers(org.springframework.security.web.util.matcher.AntPathRequestMatcher.antMatcher("/v3/api-docs/**")).permitAll()
                        .requestMatchers(org.springframework.security.web.util.matcher.AntPathRequestMatcher.antMatcher("/swagger-ui/**")).permitAll()
                        .requestMatchers(org.springframework.security.web.util.matcher.AntPathRequestMatcher.antMatcher("/swagger-ui.html")).permitAll()

                        // 2. PUBLIC FORM ENDPOINTS
                        .requestMatchers(org.springframework.security.web.util.matcher.AntPathRequestMatcher.antMatcher("/api/v1/forms/public/**")).permitAll()
                        .requestMatchers(org.springframework.security.web.util.matcher.AntPathRequestMatcher.antMatcher("/api/v1/runtime/**")).permitAll()
                        .requestMatchers(org.springframework.security.web.util.matcher.AntPathRequestMatcher.antMatcher("/api/v1/forms/*/columns/*/values")).permitAll()
                        .requestMatchers(org.springframework.security.web.util.matcher.AntPathRequestMatcher.antMatcher("/api/v1/upload")).permitAll()
                        .requestMatchers(org.springframework.security.web.util.matcher.AntPathRequestMatcher.antMatcher("/api/v1/files/**")).permitAll()
                        .requestMatchers(org.springframework.security.web.util.matcher.AntPathRequestMatcher.antMatcher("/api/v1/forms/*")).permitAll()

                        // 3. Auth Endpoints
                        .requestMatchers(org.springframework.security.web.util.matcher.AntPathRequestMatcher.antMatcher(HttpMethod.POST, "/api/v1/auth/login")).permitAll()
                        .requestMatchers(org.springframework.security.web.util.matcher.AntPathRequestMatcher.antMatcher(HttpMethod.POST, "/api/v1/auth/register")).permitAll()
                        .requestMatchers(org.springframework.security.web.util.matcher.AntPathRequestMatcher.antMatcher(HttpMethod.POST, "/api/v1/auth/forgot-password")).permitAll()
                        .requestMatchers(org.springframework.security.web.util.matcher.AntPathRequestMatcher.antMatcher(HttpMethod.POST, "/api/v1/auth/reset-password")).permitAll()
                        .requestMatchers(org.springframework.security.web.util.matcher.AntPathRequestMatcher.antMatcher(HttpMethod.POST, "/api/v1/auth/logout")).permitAll()
                        .requestMatchers(org.springframework.security.web.util.matcher.AntPathRequestMatcher.antMatcher(HttpMethod.GET, "/api/v1/config/features")).permitAll()

                        // Allow AI Architect API
                        .requestMatchers(org.springframework.security.web.util.matcher.AntPathRequestMatcher.antMatcher("/api/v1/ai/**")).permitAll()
                        .requestMatchers(org.springframework.security.web.util.matcher.AntPathRequestMatcher.antMatcher("/api/ai/**")).permitAll()

                        // Require auth for everything else
                        .anyRequest().authenticated())

                // 4. Use stateful sessions (this is what enables JSESSIONID cookies)
                .sessionManagement(session -> session
                        .sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED)
                        .maximumSessions(1)
                        .maxSessionsPreventsLogin(false)
                        .sessionRegistry(sessionRegistry()))

                // 5. Handle unauthorized access by returning 401 instead of a redirect to a
                // Spring login page
                .exceptionHandling(exceptions -> exceptions
                        .authenticationEntryPoint((request, response, authException) -> {
                            response.sendError(401, "Unauthorized");
                        }));

        return http.build();
    }

    @Bean
    public AuthenticationManager authenticationManager() {
        DaoAuthenticationProvider authProvider = new DaoAuthenticationProvider(userDetailsService);
        authProvider.setPasswordEncoder(passwordEncoder());
        return new ProviderManager(authProvider);
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();

        // 🛡️ Private Config (Admin Dashboard)
        CorsConfiguration privateConfig = new CorsConfiguration();
        privateConfig.setAllowedOrigins(Arrays.asList("http://localhost:3000"));
        privateConfig.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
        privateConfig.setAllowedHeaders(Arrays.asList("Authorization", "Content-Type", "Accept"));
        privateConfig.setAllowCredentials(true);

        // 🌍 Public Config (External Integrations / AI Generated Forms)
        // Only allows access to the runtime and public documentation endpoints
        CorsConfiguration publicConfig = new CorsConfiguration();
        publicConfig.setAllowedOriginPatterns(Arrays.asList("*")); // Allow any website (Citizen Integration)
        publicConfig.setAllowedMethods(Arrays.asList("GET", "POST", "OPTIONS"));
        publicConfig.setAllowedHeaders(Arrays.asList("Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"));
        publicConfig.setAllowCredentials(true); // Permit credentials for local dashboard and trusted integrations

        // Apply specialized configs to relevant paths
        source.registerCorsConfiguration("/api/v1/runtime/**", publicConfig);
        source.registerCorsConfiguration("/api/v1/forms/public/**", publicConfig);
        
        // Everything else uses the strict private config
        source.registerCorsConfiguration("/**", privateConfig);
        return source;
    }

    @Bean
    public org.springframework.security.web.session.HttpSessionEventPublisher httpSessionEventPublisher() {
        return new org.springframework.security.web.session.HttpSessionEventPublisher();
    }

    @Bean
    public org.springframework.security.core.session.SessionRegistry sessionRegistry() {
        return new org.springframework.security.core.session.SessionRegistryImpl();
    }
}
