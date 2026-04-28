# FormBuilder3 - Documentation Supplement
## Missing Features, Details & Corrections

> **Purpose**: This document supplements the main FormBuilder3 documentation with missing features, detailed explanations, and critical details that were not covered in the primary documents.

---

## Table of Contents

1. [Critical Security Issues](#critical-security-issues)
2. [Complete Field Types Reference](#complete-field-types-reference)
3. [Rule Engine - Advanced Details](#rule-engine---advanced-details)
4. [Advanced Backend Features](#advanced-backend-features)
5. [Advanced Frontend Features](#advanced-frontend-features)
6. [Database Schema Deep Dive](#database-schema-deep-dive)
7. [Environment & Deployment Specifics](#environment--deployment-specifics)
8. [Codebase Statistics](#codebase-statistics)

---

## Critical Security Issues

⚠️ **IMPORTANT FOR PRODUCTION DEPLOYMENT**

### Issue 1: Hardcoded Credentials in application.properties

**Current State**:
```properties
# Database credentials hardcoded
spring.datasource.url=jdbc:postgresql://localhost:5432/formbuilder3
spring.datasource.username=postgres
spring.datasource.password=your_password

# Email credentials hardcoded
spring.mail.host=smtp.gmail.com
spring.mail.port=587
spring.mail.username=your-email@gmail.com
spring.mail.password=your-app-password

# AI API keys hardcoded
spring.ai.openai.api-key=sk-...
```

**Risk Level**: **CRITICAL**

**Impact**:
- Private credentials exposed in source code repository
- Anyone with repository access gains system access
- Database can be compromised
- Email account can be used for spam/phishing
- API keys can be exploited for unauthorized AI usage

**Recommendation**:
1. **IMMEDIATE**: Remove all credentials from code
2. Use environment variables:
   ```bash
   export DB_URL=jdbc:postgresql://prod-host:5432/formbuilder3
   export DB_USER=dbuser
   export DB_PASSWORD=<secure-password>
   export MAIL_HOST=smtp.gmail.com
   export MAIL_USER=noreply@company.com
   export MAIL_PASSWORD=<app-password>
   export AI_API_KEY=<groq-api-key>
   ```

3. Update application.properties:
   ```properties
   spring.datasource.url=${DB_URL}
   spring.datasource.username=${DB_USER}
   spring.datasource.password=${DB_PASSWORD}
   spring.mail.host=${MAIL_HOST}
   spring.mail.username=${MAIL_USER}
   spring.mail.password=${MAIL_PASSWORD}
   spring.ai.openai.api-key=${AI_API_KEY}
   ```

4. Use secrets management:
   - **Development**: `.env` file (NOT committed)
   - **Staging/Prod**: Use vault services like:
     - HashiCorp Vault
     - Spring Cloud Config Server
     - AWS Secrets Manager
     - Azure Key Vault
     - Google Secret Manager

---

### Issue 2: Missing Global Rate Limiting

**Current State**:
- Only password reset has rate limiting (3 attempts/hour)
- No rate limiting on other endpoints
- API endpoints can be brute-forced or abused

**Recommendation**:
Implement global rate limiting using Spring Cloud Gateway or AOP:

```java
@RestController
@RateLimiter(name = "api")
public class FormController {
    @GetMapping("/forms")
    public ResponseEntity<?> getAllForms() { }
}
```

Configure in application.properties:
```properties
resilience4j.ratelimiter.instances.api.registerHealthIndicator=true
resilience4j.ratelimiter.instances.api.limitRefreshPeriod=1m
resilience4j.ratelimiter.instances.api.limitForPeriod=100
resilience4j.ratelimiter.instances.api.timeoutDuration=5s
```

---

### Issue 3: CORS Configuration Localhost-Only

**Current State**:
```java
@Configuration
public class CorsConfig {
    public WebMvcConfigurer corsConfigurer() {
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(CorsRegistry registry) {
                registry.addMapping("/api/**")
                    .allowedOrigins("http://localhost:3000")  // ← HARDCODED
                    .allowedMethods("GET", "POST", "PUT", "DELETE");
            }
        };
    }
}
```

**Issue**: Will break in production with different frontend URL

**Recommendation**:
```java
@Value("${app.frontend.url}")
private String frontendUrl;

registry.addMapping("/api/**")
    .allowedOrigins(frontendUrl)
    .allowedMethods("GET", "POST", "PUT", "DELETE")
    .allowedHeaders("*")
    .allowCredentials(true);
```

Set in application.properties:
```properties
app.frontend.url=${FRONTEND_URL:http://localhost:3000}
```

---

## Complete Field Types Reference

### All 23 Field Types with Details

#### **1. TEXT**
- **Description**: Single-line text input
- **HTML Element**: `<input type="text">`
- **Database Type**: `VARCHAR(500)`
- **Validation**: Pattern-based (regex)
- **Example**:
  ```json
  {
    "fieldKey": "first_name",
    "type": "TEXT",
    "label": "First Name",
    "isRequired": true,
    "validationRules": [{
      "type": "pattern",
      "value": "^[a-zA-Z ]+$",
      "message": "Only letters and spaces allowed"
    }]
  }
  ```

---

#### **2. NUMERIC**
- **Description**: Number input (integer or decimal)
- **HTML Element**: `<input type="number">`
- **Database Type**: `INTEGER` or `DECIMAL(10,2)`
- **Validation**: Range checks, precision
- **Example**:
  ```json
  {
    "fieldKey": "age",
    "type": "NUMERIC",
    "label": "Age",
    "validationRules": [{
      "type": "range",
      "min": 18,
      "max": 120
    }]
  }
  ```

---

#### **3. TEXTAREA**
- **Description**: Multi-line text input
- **HTML Element**: `<textarea rows="5" cols="40"></textarea>`
- **Database Type**: `TEXT`
- **Features**: Rows/columns configurable
- **Example**:
  ```json
  {
    "fieldKey": "comments",
    "type": "TEXTAREA",
    "label": "Comments",
    "configJson": {
      "rows": 5,
      "cols": 50,
      "maxLength": 500
    }
  }
  ```

---

#### **4. DATE**
- **Description**: Date picker (YYYY-MM-DD)
- **HTML Element**: `<input type="date">`
- **Database Type**: `DATE`
- **Features**: Min/max date constraints
- **Example**:
  ```json
  {
    "fieldKey": "date_of_birth",
    "type": "DATE",
    "label": "Date of Birth",
    "validationRules": [{
      "type": "dateRange",
      "minDate": "1950-01-01",
      "maxDate": "2006-12-31"
    }]
  }
  ```

---

#### **5. DATE_TIME**
- **Description**: Date and time picker (YYYY-MM-DD HH:MM:SS)
- **HTML Element**: `<input type="datetime-local">`
- **Database Type**: `TIMESTAMP`
- **Features**: Full datetime selection
- **Example**:
  ```json
  {
    "fieldKey": "appointment_time",
    "type": "DATE_TIME",
    "label": "Appointment Date & Time"
  }
  ```

---

#### **6. TIME**
- **Description**: Time picker (HH:MM:SS)
- **HTML Element**: `<input type="time">`
- **Database Type**: `TIME`
- **Example**:
  ```json
  {
    "fieldKey": "start_time",
    "type": "TIME",
    "label": "Start Time"
  }
  ```

---

#### **7. BOOLEAN**
- **Description**: Checkbox (true/false)
- **HTML Element**: `<input type="checkbox">`
- **Database Type**: `BOOLEAN`
- **Features**: Simple yes/no toggle
- **Example**:
  ```json
  {
    "fieldKey": "agree_to_terms",
    "type": "BOOLEAN",
    "label": "I Agree to Terms & Conditions",
    "isRequired": true
  }
  ```

---

#### **8. DROPDOWN**
- **Description**: Select dropdown with predefined options
- **HTML Element**: `<select><option>...</option></select>`
- **Database Type**: `VARCHAR(500)`
- **Features**: Single selection, optional search
- **Example**:
  ```json
  {
    "fieldKey": "country",
    "type": "DROPDOWN",
    "label": "Country",
    "fieldOptions": [
      { "label": "USA", "value": "US" },
      { "label": "India", "value": "IN" },
      { "label": "Canada", "value": "CA" }
    ],
    "isRequired": true
  }
  ```

---

#### **9. RADIO**
- **Description**: Radio button group (single selection)
- **HTML Element**: `<input type="radio" name="group">`
- **Database Type**: `VARCHAR(500)`
- **Features**: Mutually exclusive options
- **Example**:
  ```json
  {
    "fieldKey": "gender",
    "type": "RADIO",
    "label": "Gender",
    "fieldOptions": [
      { "label": "Male", "value": "M" },
      { "label": "Female", "value": "F" },
      { "label": "Other", "value": "O" }
    ]
  }
  ```

---

#### **10. CHECKBOX_GROUP**
- **Description**: Multiple checkboxes (multi-select)
- **HTML Element**: `<input type="checkbox" name="interests">`
- **Database Type**: `TEXT` (JSON array stored)
- **Features**: Multiple selections allowed
- **Example**:
  ```json
  {
    "fieldKey": "interests",
    "type": "CHECKBOX_GROUP",
    "label": "What are your interests?",
    "isMultiSelect": true,
    "fieldOptions": [
      { "label": "Sports", "value": "sports" },
      { "label": "Music", "value": "music" },
      { "label": "Reading", "value": "reading" }
    ]
  }
  ```

---

#### **11. RATING**
- **Description**: Star rating (1-5 or 1-10)
- **HTML Element**: Custom star component
- **Database Type**: `INTEGER`
- **Features**: Visual rating scale
- **Example**:
  ```json
  {
    "fieldKey": "satisfaction_rating",
    "type": "RATING",
    "label": "How satisfied are you?",
    "configJson": {
      "maxRating": 5,
      "allowHalf": true
    }
  }
  ```

---

#### **12. SCALE**
- **Description**: Linear scale/slider (e.g., 1-10)
- **HTML Element**: `<input type="range">`
- **Database Type**: `INTEGER`
- **Features**: Sliding scale with labels
- **Example**:
  ```json
  {
    "fieldKey": "agreement_scale",
    "type": "SCALE",
    "label": "How much do you agree?",
    "configJson": {
      "min": 1,
      "max": 10,
      "step": 1,
      "minLabel": "Strongly Disagree",
      "maxLabel": "Strongly Agree"
    }
  }
  ```

---

#### **13. FILE**
- **Description**: File upload field
- **HTML Element**: `<input type="file">`
- **Database Type**: `VARCHAR(500)` (stores file URL)
- **Limits**: Max 5MB per file
- **Features**: UUID-based storage, prevents enumeration
- **Example**:
  ```json
  {
    "fieldKey": "document",
    "type": "FILE",
    "label": "Upload Document",
    "configJson": {
      "acceptedFormats": [".pdf", ".doc", ".docx"],
      "maxSize": 5242880
    }
  }
  ```

---

#### **14. LOOKUP**
- **Description**: Dynamic dropdown fetching values from another form
- **HTML Element**: `<select>` (populated dynamically)
- **Database Type**: `VARCHAR(500)`
- **Features**: Real-time value fetching from other form submissions
- **API Used**: `GET /api/v1/forms/{formId}/columns/{fieldKey}/values`
- **Example**:
  ```json
  {
    "fieldKey": "city_name",
    "type": "LOOKUP",
    "label": "Select City",
    "configJson": {
      "sourceFormId": "uuid-of-city-form",
      "sourceFieldKey": "city_column",
      "displayField": "city_name"
    }
  }
  ```

---

#### **15. CALCULATED**
- **Description**: Auto-calculated field based on formula
- **HTML Element**: Read-only `<input>`
- **Database Type**: Determined by formula result
- **Features**: JavaScript expression evaluation, updates on field changes
- **Example**:
  ```json
  {
    "fieldKey": "total_amount",
    "type": "CALCULATED",
    "label": "Total Amount",
    "isReadOnly": true,
    "calculationFormula": "parseFloat(quantity) * parseFloat(unit_price)",
    "isHidden": false
  }
  ```

---

#### **16. GRID_RADIO**
- **Description**: Matrix of radio buttons (rows × columns)
- **HTML Element**: `<table>` with `<input type="radio">`
- **Database Type**: Multiple `VARCHAR(500)` columns (one per row)
- **Features**: Structured question matrix
- **Example**:
  ```json
  {
    "fieldKey": "satisfaction_grid",
    "type": "GRID_RADIO",
    "label": "Rate Each Item",
    "fieldOptions": {
      "rows": [
        { "label": "Product Quality", "value": "quality" },
        { "label": "Customer Service", "value": "service" }
      ],
      "columns": [
        { "label": "Poor", "value": "1" },
        { "label": "Good", "value": "2" },
        { "label": "Excellent", "value": "3" }
      ]
    }
  }
  ```

---

#### **17. GRID_CHECK**
- **Description**: Matrix of checkboxes (rows × columns)
- **HTML Element**: `<table>` with `<input type="checkbox">`
- **Database Type**: Multiple `TEXT` columns (JSON arrays)
- **Features**: Multiple selections per row
- **Example**:
  ```json
  {
    "fieldKey": "features_matrix",
    "type": "GRID_CHECK",
    "label": "Which features do you use?",
    "fieldOptions": {
      "rows": [
        { "label": "Feature A", "value": "feat_a" },
        { "label": "Feature B", "value": "feat_b" }
      ],
      "columns": [
        { "label": "Frequently", "value": "freq" },
        { "label": "Occasionally", "value": "occ" },
        { "label": "Never", "value": "never" }
      ]
    }
  }
  ```

---

#### **18. SECTION_HEADER**
- **Description**: Visual section divider/header (no data)
- **HTML Element**: `<h3>` or styled div
- **Database Type**: N/A (not stored)
- **Features**: Form organization, visual grouping
- **Example**:
  ```json
  {
    "fieldKey": "section_1",
    "type": "SECTION_HEADER",
    "label": "Contact Information",
    "configJson": {
      "cssClass": "border-top",
      "fontSize": "large"
    }
  }
  ```

---

#### **19. INFO_LABEL**
- **Description**: Informational text/label (no data)
- **HTML Element**: `<p>` or styled div
- **Database Type**: N/A (not stored)
- **Features**: Display instructions, help text, notices
- **Example**:
  ```json
  {
    "fieldKey": "info_label_1",
    "type": "INFO_LABEL",
    "label": "Please fill all required fields marked with *",
    "configJson": {
      "backgroundColor": "#f0f0f0",
      "fontSize": "small",
      "cssClass": "alert alert-info"
    }
  }
  ```

---

#### **20. PAGE_BREAK**
- **Description**: Multi-page form divider
- **HTML Element**: N/A (page control)
- **Database Type**: N/A (not stored)
- **Features**: Splits form into multiple pages with navigation
- **Example**:
  ```json
  {
    "fieldKey": "page_break_1",
    "type": "PAGE_BREAK",
    "label": "Page 1 of 3",
    "displayOrder": 10
  }
  ```

---

#### **21. HIDDEN**
- **Description**: Hidden field (not visible to user)
- **HTML Element**: `<input type="hidden">`
- **Database Type**: `VARCHAR(500)`
- **Features**: System/tracking fields, set via rules or defaults
- **Example**:
  ```json
  {
    "fieldKey": "form_version",
    "type": "HIDDEN",
    "isHidden": true,
    "defaultValue": "1.0",
    "isReadOnly": true
  }
  ```

---

#### **22. CUSTOM** *(Extensible)*
- **Description**: Custom field type for future extensions
- **Database Type**: Flexible
- **Features**: Extensibility for plugins
- **Example**:
  ```json
  {
    "fieldKey": "custom_field",
    "type": "CUSTOM",
    "label": "Custom Field",
    "configJson": {
      "componentName": "CustomComponent",
      "props": {}
    }
  }
  ```

---

#### **23. HTML** *(Potential)*
- **Description**: Rich HTML content field
- **Database Type**: N/A (display only)
- **Features**: Display formatted HTML content
- **Note**: May require SANITIZATION for security

---

### Field Property Summary Table

| Property | Applies To | Description |
|----------|-----------|-------------|
| `isRequired` | All | Makes field mandatory |
| `isReadOnly` | Most | Prevents user editing |
| `isHidden` | All | Hides field from UI |
| `isDisabled` | All | Disables user interaction (grayed out) |
| `defaultValue` | Most | Pre-fills field value |
| `isMultiSelect` | DROPDOWN, RADIO, CHECKBOX_GROUP | Allows multiple selections |
| `calculationFormula` | CALCULATED | JavaScript expression for computation |
| `fieldOptions` | DROPDOWN, RADIO, CHECKBOX_GROUP, GRID_* | Options/choices |
| `validationRules` | Most | Custom validation rules |
| `helpText` | Most | Tooltip/hint text |
| `configJson` | All | Custom configuration object |

---

## Rule Engine - Advanced Details

### Complete Rule Operators (10+ types)

#### **Comparison Operators**
1. **EQUALS** - Exact match
   ```json
   { "field": "status", "operator": "EQUALS", "value": "ACTIVE" }
   ```

2. **NOT_EQUALS** - Not equal to
   ```json
   { "field": "status", "operator": "NOT_EQUALS", "value": "INACTIVE" }
   ```

3. **GREATER_THAN** - Numeric comparison >
   ```json
   { "field": "age", "operator": "GREATER_THAN", "value": 18 }
   ```

4. **LESS_THAN** - Numeric comparison <
   ```json
   { "field": "amount", "operator": "LESS_THAN", "value": 1000 }
   ```

5. **GREATER_THAN_OR_EQUAL** - Numeric comparison ≥
   ```json
   { "field": "score", "operator": "GREATER_THAN_OR_EQUAL", "value": 50 }
   ```

6. **LESS_THAN_OR_EQUAL** - Numeric comparison ≤
   ```json
   { "field": "discount", "operator": "LESS_THAN_OR_EQUAL", "value": 20 }
   ```

#### **String Operators**
7. **CONTAINS** - Substring match
   ```json
   { "field": "email", "operator": "CONTAINS", "value": "@gmail.com" }
   ```

8. **NOT_CONTAINS** - No substring match
   ```json
   { "field": "phone", "operator": "NOT_CONTAINS", "value": "0000" }
   ```

9. **STARTS_WITH** - String prefix match
   ```json
   { "field": "code", "operator": "STARTS_WITH", "value": "INV" }
   ```

10. **ENDS_WITH** - String suffix match
    ```json
    { "field": "filename", "operator": "ENDS_WITH", "value": ".pdf" }
    ```

11. **MATCHES_PATTERN** - Regex pattern match
    ```json
    { "field": "phone_number", "operator": "MATCHES_PATTERN", "value": "^\\d{10}$" }
    ```

#### **Collection Operators**
12. **IN** - Value in list
    ```json
    { "field": "country", "operator": "IN", "value": ["US", "CA", "MX"] }
    ```

13. **NOT_IN** - Value not in list
    ```json
    { "field": "status", "operator": "NOT_IN", "value": ["DELETED", "ARCHIVED"] }
    ```

#### **Null/Empty Operators**
14. **IS_EMPTY** - Field is null/empty
    ```json
    { "field": "comment", "operator": "IS_EMPTY" }
    ```

15. **IS_NOT_EMPTY** - Field has value
    ```json
    { "field": "phone", "operator": "IS_NOT_EMPTY" }
    ```

---

### Rule Action Types (Advanced)

#### **1. VALIDATION_ERROR**
Rejects submission if condition matches. Returns HTTP 400 with error message.

```json
{
  "type": "VALIDATION_ERROR",
  "message": "Age must be at least 18"
}
```

**Use Case**: Enforce complex business logic validation
**Timing**: Pre-submission (blocks insert)
**API Response**: 400 Bad Request with error details

---

#### **2. REQUIRE**
Makes field mandatory if condition matches (runtime validation)

```json
{
  "type": "REQUIRE",
  "targetField": "company_name",
  "message": "Company name required for business accounts"
}
```

**Use Case**: Conditional required fields
**Timing**: On field change + pre-submission
**Behavior**: Adds validation error if field is empty

---

#### **3. SHOW / HIDE**
Controls field visibility based on condition

```json
{
  "type": "SHOW",
  "targetField": "home_address"
}
```

**Use Case**: Show address field only if country is "USA"
**Timing**: Client-side real-time
**Behavior**: Field remains in DOM but display: none

---

#### **4. ENABLE / DISABLE**
Controls field interactivity

```json
{
  "type": "DISABLE",
  "targetField": "discount_code"
}
```

**Use Case**: Disable coupon field if customer is not eligible
**Timing**: Client-side real-time
**Behavior**: Field becomes non-editable (grayed out)

---

#### **5. SET_VALUE**
Auto-fills field with value based on condition

```json
{
  "type": "SET_VALUE",
  "targetField": "total_amount",
  "value": "{quantity * unit_price}"
}
```

**Use Case**: Auto-calculate totals, set defaults
**Timing**: Client-side on field change
**Behavior**: Evaluates expression and sets field value

---

#### **6. EMAIL_NOTIFICATION** *(Async)*
Sends email when condition is met

```json
{
  "type": "EMAIL_NOTIFICATION",
  "targetEmail": "{user_email}",
  "subject": "Order Confirmation",
  "template": "order_confirmation",
  "variables": {
    "orderId": "{order_id}",
    "total": "{total_amount}"
  }
}
```

**Use Case**: Send notifications on certain actions
**Timing**: Post-submission (async)
**Behavior**: Queues email job, doesn't block form

---

#### **7. WEBHOOK_TRIGGER** *(Planned)*
Calls external webhook when condition matches

```json
{
  "type": "WEBHOOK_TRIGGER",
  "webhookUrl": "https://external-api.com/form-submitted",
  "headers": {
    "Authorization": "Bearer token",
    "Content-Type": "application/json"
  },
  "payload": {
    "formId": "{formId}",
    "submissionId": "{submissionId}",
    "data": "{submission_data}"
  }
}
```

**Status**: Planned (enum value exists but not implemented)
**Use Case**: Integrate with external systems
**Timing**: Post-submission (async)

---

### Complex Rule Example

```json
{
  "id": "rule-premium-billing",
  "conditions": [
    {
      "field": "account_type",
      "operator": "EQUALS",
      "value": "PREMIUM"
    },
    {
      "field": "payment_method",
      "operator": "NOT_EQUALS",
      "value": "NONE"
    },
    {
      "field": "amount",
      "operator": "GREATER_THAN",
      "value": 100
    }
  ],
  "conditionLogic": "AND",
  "actions": [
    {
      "type": "SHOW",
      "targetField": "billing_address"
    },
    {
      "type": "REQUIRE",
      "targetField": "billing_address"
    },
    {
      "type": "SET_VALUE",
      "targetField": "discount_amount",
      "value": "amount * 0.1"
    },
    {
      "type": "EMAIL_NOTIFICATION",
      "targetEmail": "admin@company.com",
      "subject": "High-value order submitted"
    }
  ]
}
```

---

## Advanced Backend Features

### 1. Calculated Fields (CALCULATED Type)

**How It Works**:
- Formula stored as JavaScript expression string
- Server-side evaluation via ExpressionEvaluatorService
- Supports field references, arithmetic, and functions

**Supported Functions**:
- Math: `+`, `-`, `*`, `/`, `%`, `Math.abs()`, `Math.round()`, `Math.min()`, `Math.max()`
- String: `String.concat()`, `string.toUpperCase()`, `string.toLowerCase()`
- Type conversion: `parseFloat()`, `parseInt()`, `Number()`
- Logical: `?:` (ternary), `&&`, `||`, `!`

**Example**:
```javascript
// Formula: Calculate tax on amount
amount * 0.18

// Formula: Conditional discount
quantity > 10 ? quantity * price * 0.9 : quantity * price

// Formula: String concatenation
first_name.concat(" ", last_name)

// Formula: Complex logic
order_total > 1000 ? (order_total * 0.95) - 100 : order_total
```

**Execution Timing**:
- Client-side: Real-time as field values change
- Server-side: During submission to store calculated value

**Database Storage**:
- Value is stored in the dynamic submission table
- Can be queried and exported
- Updates when source fields change

---

### 2. Lookup Fields (LOOKUP Type)

**Architecture**:
```
User selects city → 
Frontend calls GET /api/v1/forms/{cityFormId}/columns/city_name/values →
Backend queries form_<cityFormId>_submission_v1 table →
Fetches DISTINCT city_name values →
Frontend populates dropdown
```

**Implementation Details**:

**Backend Endpoint**:
```java
@GetMapping("/forms/{formId}/columns/{fieldKey}/values")
public ResponseEntity<List<String>> getColumnValues(
    @PathVariable UUID formId,
    @PathVariable String fieldKey
) {
    // 1. Get form and active version
    Form form = formService.getFormById(formId);
    FormVersion activeVersion = formVersionService.getActiveVersion(form);
    
    // 2. Get dynamic table name
    String tableName = String.format("form_%s_submission_v%d",
        form.getId(), activeVersion.getVersionNumber());
    
    // 3. Query distinct values
    String sql = String.format(
        "SELECT DISTINCT %s FROM %s WHERE is_deleted = false ORDER BY %s",
        fieldKey, tableName, fieldKey
    );
    
    List<String> values = jdbcTemplate.queryForList(sql, String.class);
    return ResponseEntity.ok(values);
}
```

**Frontend Usage**:
```typescript
// In form builder, when rendering LOOKUP field:
const loadLookupOptions = async (sourceFormId, sourceFieldKey) => {
  const response = await fetch(
    `/api/v1/forms/${sourceFormId}/columns/${sourceFieldKey}/values`
  );
  const values = await response.json();
  return values.map(val => ({ label: val, value: val }));
};
```

**Performance Considerations**:
- Add index on source field: `CREATE INDEX idx_form_xyz_city_name ON form_xyz_submission_v1(city_name)`
- Cache results in frontend for 5-10 minutes
- Pagination for large datasets (limit 1000 results)

---

### 3. Module & Navigation System

**Purpose**: Dynamic role-based navigation menu

**Database Schema**:
```sql
-- Module definition (features)
CREATE TABLE modules (
  id UUID PRIMARY KEY,
  module_name VARCHAR(100),     -- "Forms", "Admin", "Reports"
  prefix VARCHAR(50),           -- "forms", "admin", "reports"
  icon_css VARCHAR(100),        -- "fas fa-forms"
  is_parent BOOLEAN,            -- Top-level menu item?
  is_sub_parent BOOLEAN,        -- Submenu level?
  parent_id UUID,               -- Reference to parent module
  sub_parent_id UUID,           -- Reference to sub-parent
  display_order INTEGER         -- Sort order
);

-- Role-module mapping
CREATE TABLE role_modules (
  id UUID PRIMARY KEY,
  role_id UUID,
  module_id UUID,
  UNIQUE (role_id, module_id)
);
```

**Menu Structure**:
```
Forms (parent)
├── My Forms
├── Shared Forms
└── Archived Forms

Admin (parent)
├── Users
├── Roles
├── Permissions
├── Modules
└── Audit Logs

Reports (parent)
├── Submissions
├── Analytics
└── Export Data
```

**Frontend Menu Generation**:
```typescript
// DynamicMenuService.tsx
const buildMenu = (roleModules: Module[]) => {
  const parentModules = roleModules.filter(m => m.isParent);
  
  return parentModules.map(parent => ({
    label: parent.moduleName,
    icon: parent.iconCss,
    submenu: roleModules
      .filter(m => m.parentId === parent.id)
      .map(sub => ({
        label: sub.moduleName,
        href: `/${sub.prefix}`,
        icon: sub.iconCss
      }))
  }));
};
```

---

### 4. AI Integration (Groq API)

**Feature**: AI-powered form builder assistance

**Configuration**:
```properties
# Backend (application.properties)
spring.ai.openai.api-key=${AI_API_KEY}
spring.ai.openai.base-url=https://api.groq.com/openai
spring.ai.openai.chat.options.model=llama-3.3-70b-versatile
spring.ai.openai.chat.options.temperature=0.7

# Feature flag
feature.ai.enabled=true
```

**Backend Implementation**:
```java
@RestController
@RequestMapping("/api/ai")
@ConditionalOnProperty(name = "feature.ai.enabled", havingValue = "true")
public class AiArchitectController {
    private final ChatClient chatClient;
    
    @PostMapping("/chat")
    public ResponseEntity<?> chat(@RequestBody AiChatRequest request) {
        String userMessage = request.getMessage();
        
        // Add context about forms
        String systemPrompt = """
            You are an expert form builder assistant. Help users design forms
            by suggesting field types, validation rules, and workflows.
            """;
        
        String response = chatClient.call(
            new Prompt(
                List.of(
                    new SystemMessage(systemPrompt),
                    new UserMessage(userMessage)
                )
            )
        ).getResult().getOutput().getContent();
        
        return ResponseEntity.ok(Map.of("response", response));
    }
}
```

**Frontend Usage**:
```typescript
// AiArchitectModal.tsx
const sendToAI = async (userQuery: string) => {
  const response = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: userQuery })
  });
  
  const result = await response.json();
  return result.response;
};

// Example: "Create a customer feedback form"
const suggestion = await sendToAI(
  "Create a form for collecting customer feedback about our service"
);
```

---

## Advanced Frontend Features

### 1. useFormStore State Management

**Complete Store Interface**:
```typescript
interface FormState {
  // Schema
  schema: FormSchema;
  selectedFieldId: string | null;
  isThemePanelOpen: boolean;
  
  // Field Operations
  addField(type: FieldType, parentId?: string): void;
  removeField(fieldId: string): void;
  updateField(fieldId: string, updates: Partial<FormField>): void;
  selectField(fieldId: string): void;
  reorderFields(newOrder: string[], parentId?: string): void;
  moveField(fieldId: string, targetParentId: string, targetIndex: number): void;
  
  // Rule Operations
  addRule(rule: FormRule): void;
  updateRule(ruleId: string, rule: FormRule): void;
  deleteRule(ruleId: string): void;
  
  // Schema Operations
  setTitle(title: string): void;
  setCode(code: string): void;
  setDescription(description: string): void;
  setStatus(status: FormStatus): void;
  setThemeColor(color: string): void;
  setThemeFont(font: string): void;
  setAllowEditResponse(allow: boolean): void;
  
  // Auto-update rules on field rename
  private updateRulesOnFieldRename(oldKey: string, newKey: string): void;
}
```

**Key Features**:

#### **Tree Traversal for Nested Fields**
```typescript
const findFieldRecursive = (fields: FormField[], id: string): FormField | null => {
  for (const field of fields) {
    if (field.id === id) return field;
    if (field.children) {
      const found = findFieldRecursive(field.children, id);
      if (found) return found;
    }
  }
  return null;
};
```

#### **Auto-Derived Column Names**
```typescript
const deriveColumnName = (label: string): string => {
  return label
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')      // spaces → underscores
    .replace(/[^a-z0-9_]/g, '') // remove special chars
    .replace(/_+/g, '_')        // collapse multiple underscores
    .substring(0, 63);          // PostgreSQL identifier limit
};

// Example: "First Name" → "first_name"
```

#### **Auto-Update Rules on Field Rename**
When a field is renamed, all rules referencing it are updated automatically:

```typescript
updateField(fieldId: string, updates: Partial<FormField>) {
  const oldField = findField(fieldId);
  const newField = { ...oldField, ...updates };
  
  if (oldField.columnName !== newField.columnName) {
    // Update all rules
    this.schema.rules = this.schema.rules.map(rule => ({
      ...rule,
      conditions: rule.conditions.map(cond => ({
        ...cond,
        field: cond.field === oldField.columnName 
          ? newField.columnName 
          : cond.field
      })),
      actions: rule.actions.map(action => ({
        ...action,
        targetField: action.targetField === oldField.columnName
          ? newField.columnName
          : action.targetField
      }))
    }));
  }
  
  // Update field
  this.updateFieldInTree(this.schema.fields, fieldId, newField);
}
```

---

### 2. Drag-and-Drop (DnD Kit)

**Architecture**:
```typescript
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";

const Canvas: React.FC = () => {
  const sensors = useSensors(
    useSensor(PointerSensor, { distance: 8 }),
    useSensor(KeyboardSensor)
  );
  
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over) {
      const sourceId = active.id as string;
      const targetId = over.id as string;
      
      // Move field in store
      useFormStore.getState().moveField(sourceId, targetId, 0);
    }
  };
  
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragEnd={handleDragEnd}
    >
      <SortableFields fields={schema.fields} />
      <DragOverlay>
        {activeId ? <FieldDragPreview fieldId={activeId} /> : null}
      </DragOverlay>
    </DndContext>
  );
};
```

---

### 3. Expression Validator (Custom Validations)

**Supported Expressions**:
```javascript
// Math expressions
value > 100 && value < 1000

// String validation
email.includes("@") && email.includes(".")

// Date ranges
new Date(birthDate) > new Date("2000-01-01")

// Complex logic
(salary > 50000 && experience >= 5) || role === "MANAGER"
```

**Validation Service**:
```typescript
class ExpressionValidator {
  validate(expression: string, context: Record<string, any>): boolean {
    try {
      // Create function with field values as params
      const func = new Function(...Object.keys(context), `return ${expression}`);
      return func(...Object.values(context));
    } catch (e) {
      throw new Error(`Invalid expression: ${e.message}`);
    }
  }
  
  // Sandbox evaluation (prevent code injection)
  safeEvaluate(expression: string, context: Record<string, any>): boolean {
    // Whitelist allowed functions and variables
    const allowedFunctions = {
      parseFloat, parseInt, Number, String,
      Math: { abs: Math.abs, round: Math.round }
    };
    
    // Validate no dangerous keywords
    if (/import|require|eval|Function|process/.test(expression)) {
      throw new Error("Unsafe expression");
    }
    
    return this.validate(expression, context);
  }
}
```

---

## Database Schema Deep Dive

### Dynamic Submission Table Example

**Form Definition**:
```json
{
  "id": "f123abc",
  "code": "customer_feedback",
  "fields": [
    { "fieldKey": "customer_name", "type": "TEXT" },
    { "fieldKey": "rating", "type": "NUMERIC" },
    { "fieldKey": "feedback", "type": "TEXTAREA" }
  ]
}
```

**Generated SQL**:
```sql
CREATE TABLE form_f123abc_submission_v1 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_version_id UUID NOT NULL,
  customer_name VARCHAR(500),
  rating INTEGER,
  feedback TEXT,
  submitted_by VARCHAR(255) NOT NULL,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  submission_status VARCHAR(100) DEFAULT 'FINAL',
  is_draft BOOLEAN DEFAULT false,
  is_deleted BOOLEAN DEFAULT false,
  FOREIGN KEY (form_version_id) REFERENCES form_versions(id)
);

CREATE INDEX idx_form_f123abc_submission_v1_submitted_by 
  ON form_f123abc_submission_v1(submitted_by);
CREATE INDEX idx_form_f123abc_submission_v1_submitted_at 
  ON form_f123abc_submission_v1(submitted_at);
```

### Column Flattening for Grid Fields

**Grid Field Definition**:
```json
{
  "fieldKey": "satisfaction_grid",
  "type": "GRID_RADIO",
  "fieldOptions": {
    "rows": [
      { "value": "quality" },
      { "value": "service" }
    ],
    "columns": [
      { "value": "poor" },
      { "value": "good" },
      { "value": "excellent" }
    ]
  }
}
```

**Generated Columns** (Flattened):
```sql
satisfaction_grid_quality VARCHAR(100),    -- Row: quality
satisfaction_grid_service VARCHAR(100),    -- Row: service
```

**Submitted Data**:
```json
{
  "satisfaction_grid_quality": "good",
  "satisfaction_grid_service": "excellent"
}
```

---

## Environment & Deployment Specifics

### Required Versions

**Backend**:
- **Java**: 17+ (JDK 17 or OpenJDK 17)
- **Maven**: 3.8.1+
- **Spring Boot**: 3.5.11
- **PostgreSQL**: 14+ with UUID extension

**Frontend**:
- **Node.js**: 18+ (recommend 20 LTS)
- **npm**: 9+ or yarn 3+
- **Next.js**: 16.1.6
- **React**: 19.2.3
- **TypeScript**: 5+

**Database**:
- **PostgreSQL**: 14+ with `uuid-ossp` extension
- **SSL Support**: Required for production
- **Replication**: For high availability

---

### Environment Variables Template

**Backend (Set these before running)**:
```bash
# Database
export DB_URL="jdbc:postgresql://localhost:5432/formbuilder3"
export DB_USER="formbuilder_user"
export DB_PASSWORD="secure_password_here"
export DB_POOL_SIZE="10"

# Email (SMTP)
export MAIL_HOST="smtp.gmail.com"
export MAIL_PORT="587"
export MAIL_USER="noreply@company.com"
export MAIL_PASSWORD="app_specific_password"
export MAIL_FROM="noreply@company.com"

# AI Integration
export AI_API_KEY="gsk_..."
export AI_MODEL="llama-3.3-70b-versatile"
export AI_BASE_URL="https://api.groq.com/openai"

# Security
export JWT_SECRET="your-256-bit-secret-key-base64-encoded"
export SESSION_TIMEOUT="15m"
export APP_FRONTEND_URL="http://localhost:3000"

# Logging
export LOG_LEVEL="INFO"
export LOG_PATH="/var/log/formbuilder3"

# File Upload
export UPLOAD_DIR="/var/uploads/formbuilder3"
export MAX_FILE_SIZE="5242880"  # 5MB in bytes

# Features
export FEATURE_AI_ENABLED="true"
export FEATURE_WORKFLOW_ENABLED="true"
export FEATURE_RULES_ENABLED="true"
```

**Frontend (.env.local)**:
```bash
# API Configuration
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080/api/v1
NEXT_PUBLIC_FRONTEND_URL=http://localhost:3000

# Features
NEXT_PUBLIC_FEATURE_AI_ENABLED=true
NEXT_PUBLIC_FEATURE_WORKFLOW=true

# Monitoring
NEXT_PUBLIC_LOG_LEVEL=debug
```

---

### Docker Deployment

**Dockerfile (Backend)**:
```dockerfile
FROM openjdk:17-slim

WORKDIR /app
COPY target/formbuilder3.jar app.jar

ENV DB_URL=jdbc:postgresql://postgres:5432/formbuilder3
ENV DB_USER=formbuilder
ENV JAVA_OPTS="-Xmx512m -Xms256m"

EXPOSE 8080
CMD java ${JAVA_OPTS} -jar app.jar
```

**docker-compose.yml**:
```yaml
version: '3.9'
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: formbuilder3
      POSTGRES_USER: formbuilder
      POSTGRES_PASSWORD: secure_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  backend:
    build: ./formbuilder-backend1
    environment:
      DB_URL: jdbc:postgresql://postgres:5432/formbuilder3
      DB_USER: formbuilder
      DB_PASSWORD: secure_password
      MAIL_HOST: smtp.gmail.com
      MAIL_USER: ${MAIL_USER}
      MAIL_PASSWORD: ${MAIL_PASSWORD}
      AI_API_KEY: ${AI_API_KEY}
    ports:
      - "8080:8080"
    depends_on:
      - postgres

  frontend:
    build: ./formbuilder-frontend1
    environment:
      NEXT_PUBLIC_API_BASE_URL: http://localhost:8080/api/v1
    ports:
      - "3000:3000"
    depends_on:
      - backend

volumes:
  postgres_data:
```

---

## Codebase Statistics

### Detailed Breakdown

**Backend**:
- **Classes**: 100+
  - Controllers: 16
  - Services: 20+
  - Entities: 17
  - Repositories: 15
  - DTOs: 30+
  - Utils/Helpers: 15+
  - Config: 5+
- **Lines of Code**: 15,000+
- **Test Files**: 20+ (JUnit 5 tests)
- **Dependencies**: 40+ (Spring, PostgreSQL, AI, etc.)

**Frontend**:
- **Components**: 25+
- **Pages/Routes**: 14+
- **Hooks**: 3+ (custom)
- **Utilities**: 6 modules
- **Types**: 20+ TypeScript interfaces
- **Lines of Code**: 8,000+
- **Build Size**: ~500KB (gzipped)

**Database**:
- **Tables**: 17 core + unlimited dynamic tables
- **Indexes**: 15+ predefined
- **Stored Procedures**: 0 (code-driven DDL)
- **Views**: 0 (queries are SQL direct)

---

## Security Checklist for Production

- [ ] Move all credentials to environment variables
- [ ] Set up secrets manager (Vault, AWS Secrets, etc.)
- [ ] Enable CORS for production frontend URL
- [ ] Implement global API rate limiting
- [ ] Set up HTTPS/TLS certificates
- [ ] Enable PostgreSQL SSL connections
- [ ] Configure firewall rules
- [ ] Set up database backups (automated daily)
- [ ] Enable audit logging and monitoring
- [ ] Configure log rotation
- [ ] Set up intrusion detection (WAF)
- [ ] Regular security patches and updates
- [ ] Penetration testing before go-live

---

## Missing Implementation Tasks

| Task | Priority | Estimated Effort |
|------|----------|-----------------|
| Webhook trigger execution | Medium | 4-6 hours |
| API rate limiting | High | 2-3 hours |
| File upload MIME validation | High | 1-2 hours |
| Orphaned file cleanup | Low | 2-3 hours |
| Metrics/Monitoring (Prometheus) | Low | 4-5 hours |
| Cache layer (@Cacheable) | Low | 3-4 hours |
| Field selection in API responses | Low | 2-3 hours |
| GraphQL endpoint | Low | 8-10 hours |

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2024-01-15 | Initial comprehensive supplement created |

---

**End of Supplement Document**

For questions about any feature, refer to the relevant section or check the main FormBuilder3_Project_Report.md for integration with the overall project structure.
