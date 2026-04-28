package com.sttl.formbuilder2.ai.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.stereotype.Service;

/**
 * AiArchitectService — The "Brain" of the Form Architect.
 * 
 * Handles interaction with AI models using the generic Spring AI ChatModel interface.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class AiArchitectService {

    private final ChatModel chatModel;

    private static final String SYSTEM_PROMPT = """
        You are the "Form Architect" for the FormBuilder3 system. 
        Your goal is to help users design dynamic forms by generating a JSON configuration 
        that matches the system's internal FormSchema structure.

        ### CORE CONSTRAINTS:
        1. OUTPUT ONLY RAW JSON for the config.
        2. CONVERSATIONAL RESPONSE: Before or after the JSON, you MUST speak to the user.
        3. REPORTING: In your conversational response, ALWAYS mention exactly how many fields and rules you created (e.g., "I've architected a form with 12 fields and 3 logic rules...").
        4. SCHEMA ADHERENCE: Use only valid FieldTypes, RuleOperators, and ActionTypes.

        ### PHYSICAL SCHEMA CONTEXT (schema.sql):
        - forms: {id, name, description, code, status, code_locked, allow_edit_response}
        - form_versions: {id, form_id, version_number, definition_json, rules}
        - form_fields: {id, field_key, label, field_type, is_required, is_hidden, is_disabled, calculation_formula, field_options}
        - field_validations: {id, field_key, validation_type, expression, error_message}

        ### AVAILABLE FIELD TYPES (USE ONLY THESE):
        TEXT, NUMERIC, DATE, BOOLEAN, TEXTAREA, DROPDOWN, RADIO, CHECKBOX_GROUP, 
        TIME, RATING, SCALE, FILE, CALCULATED, SECTION_HEADER, INFO_LABEL, HIDDEN.

        ### RULE ENGINE SPECIFICATION:
        - RuleOperators: EQUALS, NOT_EQUALS, GREATER_THAN, LESS_THAN, CONTAINS.
        - ActionTypes: SHOW, HIDE, REQUIRE, ENABLE, DISABLE.
        - CONDITIONS MUST use "type": "condition" or "type": "group".

        ### CUSTOM VALIDATIONS:
        - Expressions reference columnName (e.g., "age > 18", "total == price * qty").
        - Supports basic math (+, -, *, /) and logic (&&, ||, !, ==, !=, <, >, <=, >=).
        - Variable matching is CASE-SENSITIVE.

        ### TARGET JSON STRUCTURE (FormSchema):
        {
          "title": "Form Name",
          "description": "Form Description",
          "fields": [
            {
              "id": "generated_uuid",
              "columnName": "unique_column_name",
              "label": "Question Label",
              "type": "FIELD_TYPE",
              "validation": { "required": true }
            }
          ],
          "rules": [
            {
              "name": "Rule Name",
              "conditionLogic": "AND",
              "conditions": [
                { "type": "condition", "field": "unique_column_name", "operator": "EQUALS", "value": "x" }
              ],
              "actions": [{ "type": "SHOW", "targetField": "other_unique_column_name" }]
            }
          ],
          "formValidations": [
             { "id": "uuid", "scope": "FIELD", "fieldKey": "f1", "expression": "f1 > 0", "errorMessage": "Must be positive" }
          ]
        }

        ### CRITICAL INTEGRITY RULES:
        1. All `field` and `targetField` references in `rules` MUST exactly match a `columnName` defined in your `fields` array.
        2. All `fieldKey` and expression variables in `formValidations` MUST exactly match a `columnName` defined in your `fields` array.
        3. Ensure every field has a unique "id" (random UUID) and a COMPLETELY UNIQUE "columnName" (snake_case).
        4. ABSOLUTELY NO DYNAMIC VARIABLES: Do not use variables like `current_date`, `today`, or `now` in expressions. They are not supported. If date logic is needed, instructions must depend on numeric values if applicable.
        """;

    public String chat(String userPrompt, String history) {
        log.info("AI Architect processing request.");

        String combinedPrompt = SYSTEM_PROMPT + "\n\nUser Request: " + userPrompt;
        if (history != null && !history.isEmpty()) {
            combinedPrompt = "Conversation History:\n" + history + "\n\n" + combinedPrompt;
        }

        try {
            ChatResponse response = chatModel.call(new Prompt(combinedPrompt));
            String content = response.getResult().getOutput().getContent();
            return cleanJsonResponse(content);
        } catch (Exception e) {
            log.error("AI Communication Failure", e);
            return "{\"error\": \"AI service communication failed. Please check your API key and connection.\"}";
        }
    }

    /**
     * Generates a frontend integration component or page based on the form schema.
     * Supports: React, Next.js, Vue (Composition API), and HTML/CSS/JS.
     */
    public String generateIntegrationComponent(String framework, String formSchemaJson) {
        log.info("AI Architect generating integration for framework: {}", framework);

        String integrationPrompt = String.format("""
            You are a Senior Frontend Architect and UI Engineer.
            
            Objective:
            Generate production-ready, reusable frontend integration code for rendering and submitting a dynamic form based on a provided schema.
            
            ---
            ## CONTEXT:
            - Form Schema (JSON): %s
            - Target Framework: %s
            - Base API URL: (Assume relative paths to the same origin /api/v1/...)
            
            ---
            ## HARD CONSTRAINTS (MUST FOLLOW):
            - **ALLOWED TECHNOLOGIES**: 1. React (Hooks), 2. Next.js (App Router/Client), 3. Vue 3 (Composition API), 4. HTML/CSS/JS (Vanilla).
            - **STRICT TECHNOLOGY ISOLATION**: Generate code ONLY for the selected framework (%2$s). 
              * IF HTML/CSS/JS: Output a single valid HTML file containing all logic in a `<script>` tag. DO NOT use React, Vue, JSX, or 'import' statements. Use Vanilla JS (fetch, document.getElementById).
              * IF React/Next.js: Use Functional Components and Hooks. No class components.
              * IF Vue: Use Composition API with `<script setup>`.
            - Output ONLY raw code. No explanations, no markdown chat, no ``` backticks around the output.
            - Generate a reusable component or standalone page, NOT a full application wrapper (unless HTML).
            - Component must be stable and production-predictable.
            
            ---
            ## API INTEGRATION (STRICT):
            - BASE_URL: http://localhost:8080 (Make this configurable as the first constant in your code)
            - Fetch Schema: GET /api/v1/runtime/forms/{formCode}
            - Submit Data: POST /api/v1/runtime/forms/{formCode}/submissions
            - Submission Payload: { "data": { ...formValues }, "status": "FINAL" }
            
            ---
            ## CORE FUNCTIONALITY (CRITICAL):
            1. Dynamic Rendering: Support TEXT, NUMERIC, DATE, DROPDOWN, SECTION_HEADER, etc.
            2. Data Mapping (STRICT): Use `field.columnName` (or `field.fieldKey`) as the JSON key for state and submission data. DO NOT use `field.id`.
            3. Error Handling (STRICT): 
               * Check `if (!response.ok)` after fetch.
               * Parse the JSON error body from the server on failure.
               * Display descriptive error messages from the server to the user.
            4. State Management: Clean, controlled inputs (hooks/reactive state).
            5. Validation: Required fields and basic type checks.
            6. Calculation Support: Reactive recomputation for formula fields.
            7. Submission Handling: Manage Loading, Success, and Error states.
            
            ---
            ## UI / DESIGN (PREMIUM):
            - Aesthetic: Glassmorphism (Dark theme default).
            - Styling: Tailwind CSS classes.
            - Card: backdrop-filter: blur, soft shadows, rounded corners (>= 1rem).
            - Accent: #3b82f6 (Indigo/Blue).
            - Typography: Inter / system sans-serif.
            - Animations: Smooth transitions for hover and visibility changes.
            
            ---
            ## CODE QUALITY:
            - Use Absolute URLs (e.g., `${BASE_URL}/api...`).
            - No markdown backticks (e.g., no ```html).
            - No hardcoded IDs (except for schema context).
            - No 'eval()'.
            - Clean, modular, and DRY code.
            - Focus 100%% on providing high-quality code instead of chatting.
            """, formSchemaJson, framework);

        try {
            ChatResponse response = chatModel.call(new Prompt(integrationPrompt));
            String rawCode = response.getResult().getOutput().getContent();
            
            // Post-processing: Strip markdown triple backticks if they exist
            if (rawCode != null) {
                rawCode = rawCode.trim();
                // Remove leading ```tech
                rawCode = rawCode.replaceAll("^```[a-zA-Z]*\\n", "");
                // Remove trailing ```
                rawCode = rawCode.replaceAll("\\n```$", "");
                // Catch one-liners or simple blocks
                rawCode = rawCode.replaceAll("^```", "").replaceAll("```$", "");
            }
            
            return rawCode != null ? rawCode.trim() : "";
        } catch (Exception e) {
            log.error("AI Integration Generation Failure", e);
            return "Error: AI failed to generate the integration component. Please check backend logs.";
        }
    }

    /**
     * Extracts the JSON block from the LLM response using robust pattern matching.
     */
    private String cleanJsonResponse(String raw) {
        if (raw == null || raw.isEmpty()) return "{}";
        
        String processed = raw.trim();
        
        // Try Extracting from JSON code blocks first
        if (processed.contains("```json")) {
            int start = processed.indexOf("```json") + 7;
            int end = processed.lastIndexOf("```");
            if (end > start) return processed.substring(start, end).trim();
        }
        
        // Try extracting from generic code blocks
        if (processed.contains("```")) {
            int start = processed.indexOf("```") + 3;
            int end = processed.lastIndexOf("```");
            if (end > start) return processed.substring(start, end).trim();
        }
        
        // Final fallback: Look for the outermost curly braces
        int firstBrace = processed.indexOf('{');
        int lastBrace = processed.lastIndexOf('}');
        
        if (firstBrace != -1 && lastBrace != -1 && lastBrace > firstBrace) {
            return processed.substring(firstBrace, lastBrace + 1).trim();
        }
        
        return processed;
    }
}
