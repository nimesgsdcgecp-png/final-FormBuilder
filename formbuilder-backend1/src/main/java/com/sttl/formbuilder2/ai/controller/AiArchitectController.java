package com.sttl.formbuilder2.ai.controller;

import com.sttl.formbuilder2.ai.service.AiArchitectService;
import com.sttl.formbuilder2.util.ApiConstants;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * AiArchitectController — Dedicated API Controller for AI features.
 * 
 * Separated from core business controllers by the '.ai' package prefix.
 */
@RestController
@RequestMapping(ApiConstants.AI_BASE)
@RequiredArgsConstructor
@Slf4j
public class AiArchitectController {

    private final AiArchitectService aiArchitectService;

    @PostMapping(ApiConstants.AI_CHAT)
    public ResponseEntity<String> chat(@RequestBody ChatRequest request) {
        log.info("AI Chat request received in specialized AI package.");
        
        try {
            String response = aiArchitectService.chat(request.getPrompt(), request.getHistory());
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("AI Controller Failure", e);
            return ResponseEntity.internalServerError().body("Error processing AI request.");
        }
    }

    @PostMapping(ApiConstants.AI_GENERATE_INTEGRATION)
    public ResponseEntity<String> generateIntegration(@RequestBody IntegrationRequest request) {
        log.info("AI Integration generation request received for framework: {}", request.getFramework());
        
        try {
            String component = aiArchitectService.generateIntegrationComponent(request.getFramework(), request.getSchema());
            return ResponseEntity.ok(component);
        } catch (Exception e) {
            log.error("AI Controller Integration Failure", e);
            return ResponseEntity.internalServerError().body("Error generating integration code.");
        }
    }

    @Data
    public static class ChatRequest {
        private String prompt;
        private String history;
    }

    @Data
    public static class IntegrationRequest {
        private String framework;
        private String schema;
    }
}
