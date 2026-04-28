package com.sttl.formbuilder2.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/config")
public class ConfigController {

    @Value("${feature.ai.enabled:false}")
    private boolean aiArchitectEnabled;

    @Value("${feature.workflow.enabled:true}")
    private boolean workflowEnabled;

    @Value("${feature.rules.enabled:true}")
    private boolean rulesEnabled;

    @GetMapping("/features")
    public ResponseEntity<Map<String, Object>> getFeatures() {
        return ResponseEntity.ok(Map.of(
            "aiArchitectEnabled", aiArchitectEnabled,
            "workflowEnabled", workflowEnabled,
            "rulesEnabled", rulesEnabled
        ));
    }
}
