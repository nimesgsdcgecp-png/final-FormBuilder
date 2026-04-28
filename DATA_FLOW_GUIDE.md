# 🔄 Data Flow & Request Lifecycle Guide

This document provides a complete, step-by-step trace of how data flows through the FormBuilder3 system. It explains the journey of an HTTP request starting from a user interacting with the frontend, moving through the Spring Boot backend, hitting the PostgreSQL database, and returning back to the user.

---

## 1. 🏗️ Form Creation & Updates (The Builder)

When a user drags, drops, and configures fields in the web application.

### The Flow:
1. **Frontend State (Zustand):** As the user edits the canvas, modifies properties, or changes field rules, everything stays entirely in the client-side `useFormStore.ts` memory tree.
2. **Save Request (`PUT /api/v1/forms/{id}`):** When the user clicks "Save":
   - The React UI converts the massive active form tree (fields, validations, rules) into a structured JSON string map. 
   - HTTP PUT is dispatched containing the title, description, and the serialized JSON string of the schema tree.
3. **Backend Reception (`FormController.java`):** 
   - Authenticates the session.
   - Maps the Request body to a DTO.
4. **Database Storage (`FormService.java`):**
   - The backend retrieves the existing `FORMS` and `FORM_VERSIONS` records.
   - It identifies the `is_active` version. Since the form is still in a draft state (not published), it simply overwrites the `fields_json` and `rules_json` arrays in the `FORM_VERSIONS` table.
   - It **does not** generate any dynamic physical table at this stage.

---

## 2. 🚀 Form Publishing & Dynamic Table Assembly

The moment a draft becomes a live, public-facing URL capable of collecting responses.

### The Flow:
1. **Trigger (`POST /api/v1/forms/{id}/publish`):** The user clicks "Publish".
2. **Backend Validation:**
   - Evaluates if the form has a duplicate column alias.
   - Scans field properties to ensure compatibility with PostgreSQL limitations.
3. **DDL Generation (`DynamicTableService.java`):**
   - A unique physical table name is determined: e.g., `sub_form_11_v1` (Form 11, Version 1).
   - The `DynamicTableService` iterates through the JSON fields and generates a raw physical SQL statement:
     ```sql
     CREATE TABLE IF NOT EXISTS "sub_form_11_v1" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "first_name" VARCHAR(255),
        "age" NUMERIC,
        "total_cost" NUMERIC -- Calculated Field
     );
     ```
4. **Execution:** The SQL statement is executed directly against the PostgreSQL engine.
5. **Finalization:** The `FORM_VERSIONS` row is marked `is_published = true`. A public URL share token is generated to expose the form runner interface.

---

## 3. 📝 Live Form Submission (Rule Engine & Validation)

When an end-user attempts to fill out a published form.

### The Flow:
1. **Client-Side Live Evaluation:**
   - As the user types their "Age", the frontend evaluates the Rule Engine JSON. If `Age > 18`, a React hook instantly dynamically mounts the `Driver's License` field input (UI reflection).
   - Expected calculated fields (`Price` x `Tax`) are solved via JS expressions locally, so the user sees a real-time Total.
2. **Submit Request (`POST /api/v1/runtime/submit`):**
   - The React application flattens all inputs into a singular key-value map (`{ "age": 22, "drivers_license": "A123", "total_cost": 45.00 }`).
3. **Backend Soft Validation (`SubmissionService.java`):**
   - Looks up the active `FormVersion` via share token.
   - The backend checks fields against required limits. 
   - **Conflict Handling:** If a field is `Required` but defined as `ReadOnly / Hidden` (meaning a user couldn't fill it out legitimately), the backend natively bypasses the requirement fail restriction or auto-injects the `Default_Value` server-side to guarantee form submit execution.
4. **Backend Hard Validation (The Rule Engine check):**
   - Prevents cheating or injection by running the exact same rule calculations locally in Java. If someone bypasses React and submits an HTTP `POST` missing the `Driver's License` even though `Age > 18` is true, the server-side validator blocks the transaction.
5. **Physical Database Insertion (`DynamicTableService.insertData`):**
   - Values are verified against PostgreSQL Types constraint limits.
   - Generates a parameterized SQL statement (`INSERT INTO "sub_form_11_v1" VALUES (?, ?)`).
   - Writes the record. 
6. **Response:** 200 OK + Success UI redirect.

---

## 4. 🔀 Workflow Lifecycle Trigger

How the system routes the new submission for business reviews.

### The Flow:
1. **Initial State:** When Step 3 inserts the database row, it forcefully defaults the `submission_status` column to `SUBMITTED`.
2. **Event Trigger (`WorkflowExecutionService.java`):** 
   - As an asynchronous side effect of a form payload firing, the system queries the `WORKFLOW` JSON mapped to that parent form.
   - Identifies the first "Node" mapped after `START`.
3. **State Transition:** 
   - If the first node is `Manager Review`, the system internally updates `submission_status` to `PENDING_MANAGER`.
   - Sends an email/app notification (placeholder) to users carrying the attached Role ID context (e.g., all `ROLE_MANAGER`).
   - Logs an action to `AuditLog` mapping: `System triggered step: Pending Manager`.
4. **Human Action:** 
   - Manager logs into grid, clicks `Approve`. 
   - Sends `POST /api/v1/workflow/action` with payload `Approved`.
   - DB transitions record to `APPROVED` or routes sideways to `PENDING_DIRECTOR`.

---

## 5. 🔍 Fetching & Manipulating Submissions (Admin View)

How the data comes back out dynamically to administrators viewing the datagrids.

### The Flow:
1. **Data Retrieval (`GET /api/v1/forms/{id}/responses`):**
   - Because form fields differ wildly across tables, the `SubmissionService` first reads the `FormVersion` schema.
   - It runs `SELECT * FROM "sub_form_11_v1"` using Spring JDBC.
2. **Schema Mapping (Crucial step):**
   - The raw DB response is purely tabular (just column names).
   - The backend maps the DB column headers back to the `field.label` and `field.options` out of the JSON schema (e.g., it transforms the column name `gender` back to "Select Your Gender").
   - Transmits a unified JSON list of rows out to the caller.
3. **Frontend Processing:**
   - `page.tsx` within the Form Responses area uses Ag-Grid to seamlessly populate the columns from the JSON matrix.
   - If the Administrator edits a typo in a response and clicks save, `PUT /api/v1/runtime/drafts/{submissionId}` generates an `UPDATE "sub_form_11_v1" SET field_val = ? WHERE id = ?`.
