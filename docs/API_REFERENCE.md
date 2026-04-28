# FormBuilder3: Complete API Reference

## Base URL
```
http://localhost:8080/api/v1
```

## Authentication
All endpoints except `/auth/login` require an active session (JSESSIONID cookie).

---

## Authentication Endpoints

### Login
Create a new authenticated session.

**Endpoint:** `POST /auth/login`

**Request:**
```json
{
  "username": "admin",
  "password": "admin123"
}
```

**Response (200):**
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "username": "admin",
  "roles": ["ADMIN", "MENTOR"]
}
```

**Response (401):**
```json
{
  "errorCode": "UNAUTHORIZED",
  "message": "Invalid credentials"
}
```

---

### Logout
Invalidate the current session.

**Endpoint:** `POST /auth/logout`

**Response (200):**
```json
{
  "message": "Logged out successfully"
}
```

---

### Get Current User
Retrieve the currently authenticated user.

**Endpoint:** `GET /auth/me`

**Response (200):**
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "username": "admin",
  "roles": ["ADMIN", "MENTOR"]
}
```

**Response (401):**
```json
{
  "errorCode": "UNAUTHORIZED",
  "message": "Not authenticated"
}
```

---

## Form Management Endpoints

### Create Form
Create a new form with metadata.

**Endpoint:** `POST /forms`

**Required Role:** ADMIN, MENTOR

**Request:**
```json
{
  "code": "employee_onboarding",
  "name": "Employee Onboarding Form",
  "description": "Form for new employee onboarding process"
}
```

**Validation Rules:**
- `code`: Required, unique, lowercase, alphanumeric + underscore, 1-100 chars
- `name`: Required, 1-255 chars
- `description`: Optional

**Response (201):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "code": "employee_onboarding",
  "name": "Employee Onboarding Form",
  "description": "Form for new employee onboarding process",
  "status": "DRAFT",
  "createdBy": "admin",
  "createdAt": "2026-01-20T10:30:00Z",
  "updatedAt": "2026-01-20T10:30:00Z"
}
```

**Response (409):**
```json
{
  "errorCode": "CONFLICT",
  "message": "Form with code 'employee_onboarding' already exists"
}
```

---

### List Forms
Get all forms accessible to the user.

**Endpoint:** `GET /forms`

**Query Parameters:**
- `status` (optional): DRAFT | PUBLISHED | ARCHIVED
- `sortBy` (optional): createdAt | name | updatedAt (default: createdAt)
- `sortOrder` (optional): ASC | DESC (default: DESC)

**Example:** `GET /forms?status=PUBLISHED&sortBy=name&sortOrder=ASC`

**Response (200):**
```json
{
  "total": 5,
  "items": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "code": "employee_onboarding",
      "name": "Employee Onboarding Form",
      "status": "PUBLISHED",
      "activeVersion": 2,
      "createdAt": "2026-01-20T10:30:00Z",
      "updatedAt": "2026-01-21T14:15:00Z"
    }
  ]
}
```

---

### Get Form
Retrieve form metadata.

**Endpoint:** `GET /forms/{formId}`

**Path Parameters:**
- `formId`: UUID of the form

**Response (200):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "code": "employee_onboarding",
  "name": "Employee Onboarding Form",
  "description": "Form for new employee onboarding process",
  "status": "PUBLISHED",
  "createdBy": "admin",
  "createdAt": "2026-01-20T10:30:00Z",
  "updatedAt": "2026-01-21T14:15:00Z"
}
```

**Response (404):**
```json
{
  "errorCode": "NOT_FOUND",
  "message": "Form not found"
}
```

---

### Update Form Metadata
Update form name and description (not code or status).

**Endpoint:** `PUT /forms/{formId}`

**Required Role:** ADMIN, MENTOR (form creator)

**Request:**
```json
{
  "name": "Updated Form Name",
  "description": "Updated description"
}
```

**Response (200):**
```json
{
  "message": "Form updated successfully"
}
```

---

### Publish Form
Publish a form and create its database table.

**Endpoint:** `POST /forms/{formId}/publish`

**Required Role:** ADMIN

**Response (200):**
```json
{
  "message": "Form published successfully",
  "status": "PUBLISHED",
  "tableCreated": "form_data_employee_onboarding"
}
```

**Response (409):**
```json
{
  "errorCode": "CONFLICT",
  "message": "Only DRAFT forms can be published"
}
```

**Response (422):**
```json
{
  "errorCode": "VALIDATION_ERROR",
  "message": "Form validation failed",
  "details": [
    {
      "message": "Form must have at least one field"
    }
  ]
}
```

---

### Archive Form
Archive a published form (prevents new submissions).

**Endpoint:** `POST /forms/{formId}/archive`

**Required Role:** ADMIN

**Response (200):**
```json
{
  "message": "Form archived successfully"
}
```

---

## Form Version Endpoints

### List Versions
Get all versions of a form.

**Endpoint:** `GET /forms/{formId}/versions`

**Response (200):**
```json
{
  "items": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "versionNumber": 1,
      "isActive": false,
      "createdBy": "admin",
      "createdAt": "2026-01-20T10:30:00Z"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440002",
      "versionNumber": 2,
      "isActive": true,
      "createdBy": "admin",
      "createdAt": "2026-01-21T14:15:00Z"
    }
  ]
}
```

---

### Create New Version
Create a new version by cloning the previous version.

**Endpoint:** `POST /forms/{formId}/versions`

**Required Role:** ADMIN, MENTOR

**Request:**
```json
{
  "baseVersion": 2
}
```

**Response (201):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440003",
  "versionNumber": 3,
  "isActive": false,
  "message": "New version created (cloned from version 2)"
}
```

---

### Activate Version
Make a version the active version for new submissions.

**Endpoint:** `POST /forms/{formId}/versions/{versionId}/activate`

**Required Role:** ADMIN

**Response (200):**
```json
{
  "message": "Version activated successfully",
  "activeVersion": 3
}
```

---

### Get Version Details
Get full definition of a specific version.

**Endpoint:** `GET /forms/{formId}/versions/{versionId}`

**Response (200):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440002",
  "formId": "550e8400-e29b-41d4-a716-446655440000",
  "versionNumber": 2,
  "isActive": true,
  "definitionJson": {
    "layout": {
      "sections": [
        {
          "title": "Basic Information",
          "fields": ["name", "email", "department"]
        }
      ]
    }
  },
  "fields": [
    {
      "id": "field-1",
      "fieldKey": "name",
      "label": "Full Name",
      "fieldType": "TEXT",
      "isRequired": true,
      "displayOrder": 1
    }
  ],
  "validations": [
    {
      "id": "val-1",
      "fieldKey": "name",
      "expression": "name != ''",
      "errorMessage": "Name is required",
      "scope": "FIELD"
    }
  ]
}
```

---

## Field Management Endpoints

### Add/Update Field
Create or update a field in a form version.

**Endpoint:** `PUT /forms/{formId}/versions/{versionId}/fields/{fieldKey}`

**Required Role:** ADMIN, MENTOR

**Request:**
```json
{
  "label": "Full Name",
  "fieldType": "TEXT",
  "isRequired": true,
  "isReadOnly": false,
  "defaultValue": null,
  "displayOrder": 1,
  "config": {
    "placeholder": "Enter your full name",
    "maxLength": 255
  }
}
```

**Field Types:**
- TEXT, TEXTAREA
- NUMBER, DECIMAL
- DATE, DATETIME, TIME
- EMAIL, PHONE, URL
- CHECKBOX, RADIO, DROPDOWN, MULTISELECT
- FILE
- HIDDEN
- LABEL, SECTION_HEADER

**Response (200):**
```json
{
  "id": "field-1",
  "fieldKey": "name",
  "label": "Full Name",
  "fieldType": "TEXT",
  "isRequired": true,
  "message": "Field saved successfully"
}
```

---

### List Fields
Get all fields in a form version.

**Endpoint:** `GET /forms/{formId}/versions/{versionId}/fields`

**Response (200):**
```json
{
  "items": [
    {
      "id": "field-1",
      "fieldKey": "name",
      "label": "Full Name",
      "fieldType": "TEXT",
      "isRequired": true,
      "displayOrder": 1
    },
    {
      "id": "field-2",
      "fieldKey": "email",
      "label": "Email Address",
      "fieldType": "EMAIL",
      "isRequired": true,
      "displayOrder": 2
    }
  ]
}
```

---

### Delete Field
Remove a field from a form (logical delete - column retained).

**Endpoint:** `DELETE /forms/{formId}/versions/{versionId}/fields/{fieldKey}`

**Response (200):**
```json
{
  "message": "Field deleted successfully"
}
```

---

## Validation Management Endpoints

### Add/Update Validation
Create or update a validation rule.

**Endpoint:** `PUT /forms/{formId}/versions/{versionId}/validations/{validationId}`

**Required Role:** ADMIN, MENTOR

**Request:**
```json
{
  "fieldKey": "salary",
  "scope": "FIELD",
  "validationType": "CUSTOM",
  "expression": "salary > 0 && salary < 1000000",
  "errorMessage": "Salary must be between 0 and 1,000,000",
  "executionOrder": 1
}
```

**Scopes:**
- FIELD: Validation applies to specific field
- FORM: Validation applies to entire form

**Response (200):**
```json
{
  "id": "val-123",
  "message": "Validation rule saved successfully"
}
```

---

### List Validations
Get all validation rules for a form version.

**Endpoint:** `GET /forms/{formId}/versions/{versionId}/validations`

**Response (200):**
```json
{
  "items": [
    {
      "id": "val-1",
      "fieldKey": "salary",
      "scope": "FIELD",
      "validationType": "CUSTOM",
      "expression": "salary > 0",
      "errorMessage": "Salary must be positive",
      "executionOrder": 1
    }
  ]
}
```

---

## Runtime Form Endpoints

### Get Form for Rendering
Retrieve form definition for runtime rendering.

**Endpoint:** `GET /runtime/forms/{formCode}`

**Response (200):**
```json
{
  "formId": "550e8400-e29b-41d4-a716-446655440000",
  "formCode": "employee_onboarding",
  "formVersionId": "550e8400-e29b-41d4-a716-446655440002",
  "versionNumber": 2,
  "name": "Employee Onboarding Form",
  "description": "Form for new employee onboarding process",
  "fields": [
    {
      "id": "field-1",
      "fieldKey": "name",
      "label": "Full Name",
      "fieldType": "TEXT",
      "isRequired": true,
      "defaultValue": null,
      "config": {
        "placeholder": "Enter your full name"
      }
    }
  ],
  "validations": [
    {
      "fieldKey": "name",
      "scope": "FIELD",
      "expression": "name != ''",
      "errorMessage": "Name is required"
    }
  ]
}
```

**Response (404):**
```json
{
  "errorCode": "NOT_FOUND",
  "message": "Form not found or not published"
}
```

---

## Submission Endpoints

### Save Draft Submission
Save incomplete form submission as draft.

**Endpoint:** `POST /runtime/forms/{formCode}/submissions/draft`

**Request:**
```json
{
  "data": {
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

**Response (200):**
```json
{
  "submissionId": "550e8400-e29b-41d4-a716-446655440010",
  "status": "DRAFT",
  "message": "Draft saved successfully"
}
```

---

### Submit Form
Submit completed form with full validation.

**Endpoint:** `POST /runtime/forms/{formCode}/submissions/submit`

**Request:**
```json
{
  "data": {
    "name": "John Doe",
    "email": "john@example.com",
    "department": "Engineering",
    "salary": 95000
  }
}
```

**Response (200):**
```json
{
  "submissionId": "550e8400-e29b-41d4-a716-446655440010",
  "status": "SUBMITTED",
  "submittedAt": "2026-01-22T15:45:00Z",
  "message": "Form submitted successfully"
}
```

**Response (400):**
```json
{
  "errorCode": "VALIDATION_ERROR",
  "message": "Form validation failed",
  "details": [
    {
      "fieldKey": "email",
      "message": "Invalid email format"
    },
    {
      "fieldKey": "salary",
      "message": "Salary must be positive"
    }
  ]
}
```

---

### Get Submission Details
Retrieve a submitted form's data.

**Endpoint:** `GET /runtime/forms/{formCode}/submissions/{submissionId}`

**Required Role:** ADMIN, MENTOR

**Response (200):**
```json
{
  "submissionId": "550e8400-e29b-41d4-a716-446655440010",
  "formId": "550e8400-e29b-41d4-a716-446655440000",
  "formVersionId": "550e8400-e29b-41d4-a716-446655440002",
  "status": "SUBMITTED",
  "submittedBy": "john.doe",
  "submittedAt": "2026-01-22T15:45:00Z",
  "data": {
    "name": "John Doe",
    "email": "john@example.com",
    "department": "Engineering",
    "salary": 95000
  }
}
```

---

## Submission Management Endpoints

### List Submissions (Grid View)
Get paginated list of submissions for a form.

**Endpoint:** `GET /forms/{formId}/submissions`

**Query Parameters:**
- `page` (optional): Page number (default: 0)
- `size` (optional): Items per page (default: 20, max: 100)
- `status` (optional): DRAFT | SUBMITTED
- `sortBy` (optional): createdAt | submittedAt | submittedBy
- `sortOrder` (optional): ASC | DESC
- `search` (optional): Search in submission data

**Example:** `GET /forms/{formId}/submissions?page=0&size=20&status=SUBMITTED&sortBy=submittedAt&sortOrder=DESC`

**Response (200):**
```json
{
  "total": 145,
  "page": 0,
  "size": 20,
  "totalPages": 8,
  "items": [
    {
      "submissionId": "550e8400-e29b-41d4-a716-446655440010",
      "status": "SUBMITTED",
      "submittedBy": "john.doe",
      "submittedAt": "2026-01-22T15:45:00Z",
      "createdAt": "2026-01-22T14:30:00Z"
    }
  ]
}
```

---

### Bulk Operations
Perform bulk operations on submissions.

**Endpoint:** `POST /forms/{formId}/submissions/bulk`

**Required Role:** ADMIN, MENTOR

**Request:**
```json
{
  "operation": "DELETE",
  "submissionIds": [
    "550e8400-e29b-41d4-a716-446655440010",
    "550e8400-e29b-41d4-a716-446655440011"
  ]
}
```

**Operations:**
- DELETE: Soft delete submissions
- RESTORE: Restore deleted submissions
- EXPORT: (Handled separately via /export endpoint)

**Response (200):**
```json
{
  "operation": "DELETE",
  "processed": 2,
  "failed": 0,
  "message": "2 submissions deleted successfully"
}
```

---

### Export to CSV
Export submissions to CSV format.

**Endpoint:** `GET /forms/{formId}/submissions/export`

**Query Parameters:**
- `status` (optional): DRAFT | SUBMITTED
- `format` (optional): csv | xlsx (default: csv)

**Response:**
- Content-Type: `text/csv` or `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- Headers included
- Streamed response (no size limit)

**Example CSV Output:**
```csv
"id","submittedBy","submittedAt","name","email","department","salary"
"550e8400-...","john.doe","2026-01-22T15:45:00Z","John Doe","john@example.com","Engineering","95000"
```

---

## Error Response Format

All errors follow this structure:

```json
{
  "errorCode": "ERROR_CODE",
  "message": "Human-readable message",
  "details": [
    {
      "field": "fieldName",
      "message": "Field-specific error message"
    }
  ],
  "timestamp": "2026-01-22T15:45:00Z"
}
```

**Common Error Codes:**
- `UNAUTHORIZED` (401): Authentication required
- `FORBIDDEN` (403): Permission denied
- `NOT_FOUND` (404): Resource not found
- `CONFLICT` (409): Resource already exists
- `VALIDATION_ERROR` (422): Validation failed
- `INTERNAL_ERROR` (500): Server error

---

## Rate Limiting

- No explicit rate limiting in base implementation
- Recommended: 1000 requests/minute per user
- Per endpoint: 100 concurrent requests

---

## CORS Configuration

**Allowed Origins:**
- http://localhost:3000 (development)
- [Production domain] (production)

**Allowed Methods:**
- GET, POST, PUT, DELETE

**Allowed Headers:**
- Content-Type
- X-CSRF-Token
- Authorization

---

## API Versioning

Current version: **v1**

- Base path: `/api/v1`
- Version in headers: `API-Version: 1`
- Future versions: `/api/v2` (backward compatibility maintained)

---

*End of API Reference*
