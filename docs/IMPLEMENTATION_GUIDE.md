# FormBuilder3: Detailed Implementation Guide

## Table of Contents

1. [Backend Implementation Details](#backend-implementation)
2. [Frontend Implementation Details](#frontend-implementation)
3. [Database Implementation](#database-implementation)
4. [Deployment Guide](#deployment-guide)
5. [Troubleshooting](#troubleshooting)

---

## Backend Implementation

### Project Structure

```
formbuilder-backend1/
├── src/main/java/
│   ├── com/example/formbuilder/
│   │   ├── config/
│   │   │   ├── SecurityConfig.java
│   │   │   ├── DataSourceConfig.java
│   │   │   └── WebConfig.java
│   │   │
│   │   ├── controller/
│   │   │   ├── AuthController.java
│   │   │   ├── FormController.java
│   │   │   ├── VersionController.java
│   │   │   ├── FieldController.java
│   │   │   ├── ValidationController.java
│   │   │   ├── RuntimeController.java
│   │   │   ├── SubmissionController.java
│   │   │   └── GlobalExceptionHandler.java
│   │   │
│   │   ├── service/
│   │   │   ├── AuthService.java
│   │   │   ├── FormService.java
│   │   │   ├── VersionService.java
│   │   │   ├── ValidationEngine.java
│   │   │   ├── ExpressionEvaluator.java
│   │   │   ├── SchemaGenerator.java
│   │   │   ├── SubmissionService.java
│   │   │   ├── AuditService.java
│   │   │   └── CsvExportService.java
│   │   │
│   │   ├── repository/
│   │   │   ├── FormRepository.java
│   │   │   ├── FormVersionRepository.java
│   │   │   ├── FormFieldRepository.java
│   │   │   ├── ValidationRepository.java
│   │   │   ├── FormSubmissionMetaRepository.java
│   │   │   ├── UserRepository.java
│   │   │   └── DynamicTableRepository.java
│   │   │
│   │   ├── domain/
│   │   │   ├── Form.java
│   │   │   ├── FormVersion.java
│   │   │   ├── FormField.java
│   │   │   ├── FieldValidation.java
│   │   │   ├── FormSubmissionMeta.java
│   │   │   ├── AppUser.java
│   │   │   ├── AppRole.java
│   │   │   └── UserRole.java
│   │   │
│   │   ├── dto/
│   │   │   ├── FormDTO.java
│   │   │   ├── FormVersionDTO.java
│   │   │   ├── SubmissionRequest.java
│   │   │   ├── SubmissionResponse.java
│   │   │   ├── ValidationErrorDTO.java
│   │   │   └── ApiErrorResponse.java
│   │   │
│   │   ├── exception/
│   │   │   ├── FormNotFoundException.java
│   │   │   ├── ValidationException.java
│   │   │   ├── SchemaGenerationException.java
│   │   │   ├── UnauthorizedException.java
│   │   │   └── ConflictException.java
│   │   │
│   │   ├── security/
│   │   │   ├── CustomUserDetailsService.java
│   │   │   ├── JwtTokenProvider.java (if using JWT)
│   │   │   └── SecurityUtil.java
│   │   │
│   │   └── FormbuilderApplication.java
│   │
│   └── resources/
│       ├── application.properties
│       ├── application-dev.properties
│       └── application-prod.properties
│
├── pom.xml
└── README.md
```

### Key Class Implementations

#### 1. Form Entity

```java
@Entity
@Table(name = "form")
@Data
@NoArgsConstructor
public class Form {
  
  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  private UUID id;
  
  @Column(unique = true, nullable = false, length = 100)
  private String code;
  
  @Column(nullable = false, length = 255)
  private String name;
  
  @Column(columnDefinition = "TEXT")
  private String description;
  
  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private FormStatus status;
  
  @Column(nullable = false)
  private String createdBy;
  
  @Column(nullable = false)
  private LocalDateTime createdAt;
  
  @Column(nullable = false)
  private LocalDateTime updatedAt;
  
  @OneToMany(mappedBy = "form", cascade = CascadeType.ALL)
  private List<FormVersion> versions;
  
  @PrePersist
  protected void onCreate() {
    createdAt = LocalDateTime.now();
    updatedAt = LocalDateTime.now();
  }
  
  @PreUpdate
  protected void onUpdate() {
    updatedAt = LocalDateTime.now();
  }
  
  public FormVersion getActiveVersion() {
    return versions.stream()
      .filter(FormVersion::isActive)
      .findFirst()
      .orElse(null);
  }
}
```

#### 2. FormService Implementation

```java
@Service
@Transactional
@Slf4j
public class FormService {
  
  @Autowired
  private FormRepository formRepository;
  
  @Autowired
  private VersionService versionService;
  
  @Autowired
  private SchemaGenerator schemaGenerator;
  
  @Autowired
  private AuditService auditService;
  
  /**
   * Create new form
   */
  public FormDTO createForm(CreateFormRequest request, 
      String userId) {
    
    // Validate unique code
    if (formRepository.existsByCode(request.getCode())) {
      throw new ConflictException(
        "Form with code '" + request.getCode() + "' already exists");
    }
    
    Form form = new Form();
    form.setCode(request.getCode().toLowerCase());
    form.setName(request.getName());
    form.setDescription(request.getDescription());
    form.setStatus(FormStatus.DRAFT);
    form.setCreatedBy(userId);
    
    Form saved = formRepository.save(form);
    
    // Create initial version
    versionService.createInitialVersion(saved, userId);
    
    auditService.logAction(userId, "CREATE_FORM", "Form", 
      saved.getId().toString(), 
      Map.of("code", request.getCode(), "name", request.getName()));
    
    return new FormDTO(saved);
  }
  
  /**
   * Publish form - creates database table
   */
  public void publishForm(UUID formId, String userId) {
    
    Form form = formRepository.findById(formId)
      .orElseThrow(() -> new FormNotFoundException(formId));
    
    // Can only publish drafted forms
    if (form.getStatus() != FormStatus.DRAFT) {
      throw new ConflictException(
        "Only DRAFT forms can be published");
    }
    
    FormVersion activeVersion = form.getActiveVersion();
    if (activeVersion == null) {
      throw new IllegalStateException(
        "No version found for form");
    }
    
    // Validate form completeness
    validateFormForPublication(form, activeVersion);
    
    // Generate database table
    schemaGenerator.createSubmissionTable(form, 
      activeVersion.getFields());
    
    // Update form status
    form.setStatus(FormStatus.PUBLISHED);
    formRepository.save(form);
    
    auditService.logAction(userId, "PUBLISH_FORM", "Form", 
      formId.toString(), 
      Map.of("version", activeVersion.getVersionNumber()));
  }
  
  /**
   * Get all forms for user
   */
  public List<FormDTO> listForms(String userId) {
    // In real system, filter by user permissions
    return formRepository.findAll().stream()
      .map(FormDTO::new)
      .collect(Collectors.toList());
  }
  
  private void validateFormForPublication(Form form, 
      FormVersion version) {
    
    if (version.getFields() == null || 
        version.getFields().isEmpty()) {
      throw new ValidationException(
        "Form must have at least one field");
    }
    
    // Validate all fields have valid types
    for (FormField field : version.getFields()) {
      if (!isValidFieldType(field.getFieldType())) {
        throw new ValidationException(
          "Invalid field type: " + field.getFieldType());
      }
    }
    
    // Check for reserved keywords in field keys
    for (FormField field : version.getFields()) {
      if (isReservedKeyword(field.getFieldKey())) {
        throw new ValidationException(
          "Field key '" + field.getFieldKey() + 
          "' is a reserved SQL keyword");
      }
    }
  }
}
```

#### 3. ValidationEngine Implementation

```java
@Service
@Slf4j
public class ValidationEngine {
  
  @Autowired
  private ExpressionEvaluator evaluator;
  
  /**
   * Validates complete form submission
   */
  public ValidationResult validateSubmission(
      Map<String, Object> data, 
      FormVersion version) {
    
    List<FieldValidationError> errors = new ArrayList<>();
    
    // Step 1: Required field validation
    for (FormField field : version.getFields()) {
      if (field.isRequired()) {
        Object value = data.get(field.getFieldKey());
        if (value == null || 
            (value instanceof String && 
             ((String) value).trim().isEmpty())) {
          errors.add(new FieldValidationError(
            field.getFieldKey(),
            field.getLabel() + " is required"));
        }
      }
    }
    
    // Step 2: Field-level validations
    for (FieldValidation validation : 
        version.getValidations()) {
      
      if (!validation.getScope().equals("FIELD")) {
        continue;
      }
      
      try {
        boolean isValid = evaluator.evaluate(
          validation.getExpression(), 
          data);
        
        if (!isValid) {
          errors.add(new FieldValidationError(
            validation.getFieldKey(),
            validation.getErrorMessage()));
        }
      } catch (Exception e) {
        log.error("Validation error: " + 
          validation.getExpression(), e);
        throw new ValidationException(
          "Expression evaluation failed: " + 
          validation.getExpression());
      }
    }
    
    // Step 3: Form-level validations
    for (FieldValidation validation : 
        version.getValidations()) {
      
      if (!validation.getScope().equals("FORM")) {
        continue;
      }
      
      try {
        boolean isValid = evaluator.evaluate(
          validation.getExpression(), 
          data);
        
        if (!isValid) {
          errors.add(new FieldValidationError(
            null,
            validation.getErrorMessage()));
        }
      } catch (Exception e) {
        throw new ValidationException(
          "Form validation expression failed");
      }
    }
    
    return new ValidationResult(!errors.isEmpty(), errors);
  }
}
```

#### 4. SchemaGenerator Implementation

```java
@Service
@Slf4j
public class SchemaGenerator {
  
  @Autowired
  private JdbcTemplate jdbcTemplate;
  
  /**
   * Creates PostgreSQL table for form submissions
   * Table: form_data_{formCode}
   */
  public void createSubmissionTable(Form form, 
      List<FormField> fields) {
    
    String tableName = "form_data_" + 
      form.getCode().toLowerCase();
    
    try {
      // Check if table exists
      if (tableExists(tableName)) {
        log.warn("Table already exists: {}", tableName);
        return;
      }
      
      String sql = buildCreateTableSql(tableName, fields);
      log.debug("Creating table with SQL: {}", sql);
      
      jdbcTemplate.execute(sql);
      
      // Create indexes
      createIndexes(tableName, fields);
      
      log.info("Successfully created table: {}", tableName);
      
    } catch (DataAccessException e) {
      log.error("Failed to create table: " + tableName, e);
      throw new SchemaGenerationException(
        "Failed to create table for form: " + form.getCode(), e);
    }
  }
  
  private String buildCreateTableSql(String tableName, 
      List<FormField> fields) {
    
    StringBuilder sql = new StringBuilder();
    sql.append("CREATE TABLE ").append(tableName).append(" (");
    sql.append("  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),");
    sql.append("  form_version_id UUID NOT NULL,");
    sql.append("  created_by VARCHAR(100),");
    sql.append("  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,");
    sql.append("  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,");
    sql.append("  is_draft BOOLEAN DEFAULT false");
    
    for (FormField field : fields) {
      sql.append(", ").append(mapFieldToColumn(field));
    }
    
    sql.append(")");
    
    return sql.toString();
  }
  
  private String mapFieldToColumn(FormField field) {
    String sqlType = switch(field.getFieldType()) {
      case "TEXT" -> "TEXT";
      case "NUMBER" -> "NUMERIC";
      case "DATE" -> "DATE";
      case "DATETIME" -> "TIMESTAMP";
      case "CHECKBOX" -> "BOOLEAN";
      case "EMAIL" -> "VARCHAR(255)";
      case "PHONE" -> "VARCHAR(20)";
      default -> "TEXT";
    };
    
    return String.format("%s %s",
      field.getFieldKey().toLowerCase(),
      sqlType);
  }
  
  private void createIndexes(String tableName, 
      List<FormField> fields) {
    
    // Index on created_at
    String createdAtIndex = String.format(
      "CREATE INDEX idx_%s_created_at ON %s(created_at DESC)",
      tableName, tableName);
    
    // Index on is_draft
    String isDraftIndex = String.format(
      "CREATE INDEX idx_%s_is_draft ON %s(is_draft)",
      tableName, tableName);
    
    try {
      jdbcTemplate.execute(createdAtIndex);
      jdbcTemplate.execute(isDraftIndex);
    } catch (DataAccessException e) {
      log.warn("Failed to create indexes", e);
    }
  }
  
  private boolean tableExists(String tableName) {
    String sql = "SELECT EXISTS (" +
      "SELECT 1 FROM information_schema.tables " +
      "WHERE table_name = ?)";
    
    Boolean exists = jdbcTemplate.queryForObject(sql, 
      Boolean.class, tableName);
    
    return exists != null && exists;
  }
}
```

#### 5. SubmissionService Implementation

```java
@Service
@Transactional
@Slf4j
public class SubmissionService {
  
  @Autowired
  private FormRepository formRepository;
  
  @Autowired
  private SubmissionMetaRepository metaRepository;
  
  @Autowired
  private ValidationEngine validator;
  
  @Autowired
  private JdbcTemplate jdbcTemplate;
  
  /**
   * Save form as draft
   */
  public String saveDraft(String formCode, 
      SubmissionRequest request, String userId) {
    
    Form form = formRepository.findByCode(formCode)
      .orElseThrow(() -> new FormNotFoundException(formCode));
    
    if (form.getStatus() != FormStatus.PUBLISHED) {
      throw new ConflictException(
        "Form is not published");
    }
    
    FormVersion activeVersion = form.getActiveVersion();
    String tableName = "form_data_" + formCode.toLowerCase();
    
    // Check if user already has draft
    String draftId = findExistingDraft(form.getId(), userId);
    
    if (draftId != null) {
      // Update existing draft
      updateDraftInTable(tableName, draftId, 
        activeVersion.getId(), request.getData());
    } else {
      // Create new draft
      draftId = UUID.randomUUID().toString();
      insertDraftIntoTable(tableName, draftId, 
        activeVersion.getId(), request.getData(), userId);
    }
    
    return draftId;
  }
  
  /**
   * Submit form with full validation
   */
  public SubmissionResponse submitForm(String formCode, 
      SubmissionRequest request, String userId) {
    
    Form form = formRepository.findByCode(formCode)
      .orElseThrow(() -> new FormNotFoundException(formCode));
    
    FormVersion activeVersion = form.getActiveVersion();
    
    // Validate submission
    ValidationResult result = validator.validateSubmission(
      request.getData(), activeVersion);
    
    if (!result.isValid()) {
      throw new ValidationException(result.getErrors());
    }
    
    // Insert final submission
    String tableName = "form_data_" + formCode.toLowerCase();
    String submissionId = insertFinalSubmission(
      tableName, activeVersion.getId(), 
      request.getData(), userId);
    
    // Record metadata
    createSubmissionMetadata(
      form.getId(), activeVersion.getId(), 
      tableName, submissionId, userId);
    
    log.info("Submission {} recorded for form {}", 
      submissionId, formCode);
    
    return new SubmissionResponse(
      submissionId,
      "SUBMITTED",
      Instant.now());
  }
  
  /**
   * Get submission details
   */
  public Map<String, Object> getSubmissionData(
      String formCode, String submissionId) {
    
    String tableName = "form_data_" + formCode.toLowerCase();
    String sql = "SELECT * FROM " + tableName + " WHERE id = ?";
    
    try {
      return jdbcTemplate.queryForMap(sql, 
        UUID.fromString(submissionId));
    } catch (EmptyResultDataAccessException e) {
      throw new NotFoundException(
        "Submission not found: " + submissionId);
    }
  }
  
  private void insertDraftIntoTable(String tableName, 
      String draftId, UUID versionId, 
      Map<String, Object> data, String userId) {
    
    String sql = buildInsertSql(tableName, data, true);
    Object[] values = buildInsertValues(draftId, versionId, 
      data, userId, true);
    
    jdbcTemplate.update(sql, values);
  }
  
  private void updateDraftInTable(String tableName, 
      String draftId, UUID versionId, 
      Map<String, Object> data) {
    
    String sql = buildUpdateSql(tableName, data);
    Object[] values = buildUpdateValues(data, draftId);
    
    jdbcTemplate.update(sql, values);
  }
  
  private String insertFinalSubmission(String tableName, 
      UUID versionId, Map<String, Object> data, 
      String userId) {
    
    String submissionId = UUID.randomUUID().toString();
    String sql = buildInsertSql(tableName, data, false);
    Object[] values = buildInsertValues(submissionId, versionId, 
      data, userId, false);
    
    jdbcTemplate.update(sql, values);
    return submissionId;
  }
  
  private String buildInsertSql(String tableName, 
      Map<String, Object> data, boolean isDraft) {
    
    StringBuilder columns = new StringBuilder(
      "id, form_version_id, created_by, created_at, " +
      "updated_at, is_draft");
    
    StringBuilder placeholders = new StringBuilder("?, ?, ?, ?, ?, ?");
    
    for (String key : data.keySet()) {
      columns.append(", ").append(key.toLowerCase());
      placeholders.append(", ?");
    }
    
    return String.format(
      "INSERT INTO %s (%s) VALUES (%s)",
      tableName, columns, placeholders);
  }
}
```

---

## Frontend Implementation

### Project Structure

```
formbuilder-frontend1/
├── src/
│   ├── pages/
│   │   ├── login.tsx
│   │   ├── dashboard.tsx
│   │   ├── forms/
│   │   │   ├── index.tsx
│   │   │   ├── [id]/
│   │   │   │   ├── editor.tsx
│   │   │   │   ├── versions.tsx
│   │   │   │   └── submissions.tsx
│   │   ├── f/
│   │   │   └── [token].tsx (public form)
│   │   └── _app.tsx
│   │
│   ├── components/
│   │   ├── FormBuilder/
│   │   │   ├── Canvas.tsx
│   │   │   ├── FieldPalette.tsx
│   │   │   ├── ConfigPanel.tsx
│   │   │   ├── FieldComponent.tsx
│   │   │   └── ValidationPanel.tsx
│   │   │
│   │   ├── Runtime/
│   │   │   ├── FormRenderer.tsx
│   │   │   ├── FieldRenderer.tsx
│   │   │   ├── ValidationDisplay.tsx
│   │   │   └── SubmissionFlow.tsx
│   │   │
│   │   ├── Grid/
│   │   │   ├── SubmissionGrid.tsx
│   │   │   ├── BulkActions.tsx
│   │   │   ├── FilterBar.tsx
│   │   │   └── ExportButton.tsx
│   │   │
│   │   ├── Auth/
│   │   │   ├── LoginForm.tsx
│   │   │   ├── ProtectedRoute.tsx
│   │   │   └── LogoutButton.tsx
│   │   │
│   │   └── Common/
│   │       ├── Header.tsx
│   │       ├── Sidebar.tsx
│   │       ├── LoadingSpinner.tsx
│   │       ├── ErrorMessage.tsx
│   │       └── Modal.tsx
│   │
│   ├── services/
│   │   ├── api.ts
│   │   ├── auth.ts
│   │   ├── forms.ts
│   │   └── submissions.ts
│   │
│   ├── store/
│   │   ├── authStore.ts
│   │   ├── formStore.ts
│   │   ├── editorStore.ts
│   │   └── submissionStore.ts
│   │
│   ├── types/
│   │   ├── forms.ts
│   │   ├── submissions.ts
│   │   └── api.ts
│   │
│   ├── utils/
│   │   ├── validation.ts
│   │   ├── formatting.ts
│   │   └── helpers.ts
│   │
│   └── styles/
│       ├── globals.css
│       └── components.css
│
├── package.json
├── tsconfig.json
├── next.config.ts
└── tailwind.config.ts
```

### Key Component Implementations

#### 1. Auth Store (Zustand)

```typescript
// store/authStore.ts
import { create } from 'zustand';
import { api } from '@/services/api';

interface User {
  userId: string;
  username: string;
  roles: string[];
}

interface AuthStore {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  hasRole: (role: string) => boolean;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  loading: false,
  error: null,

  login: async (username: string, password: string) => {
    set({ loading: true, error: null });
    try {
      const response = await api.post('/auth/login', {
        username,
        password,
      });
      set({ user: response, loading: false });
    } catch (error) {
      set({
        error: 'Invalid credentials',
        loading: false,
      });
      throw error;
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout', {});
      set({ user: null });
    } catch (error) {
      console.error('Logout failed', error);
    }
  },

  checkAuth: async () => {
    try {
      const response = await api.get('/auth/me');
      set({ user: response });
    } catch (error) {
      set({ user: null });
    }
  },

  hasRole: (role: string) => {
    const { user } = get();
    return user?.roles.includes(role) ?? false;
  },
}));
```

#### 2. Form Editor Component

```typescript
// components/FormBuilder/Canvas.tsx
import React, { useState } from 'react';
import { useFormStore } from '@/store/formStore';
import FieldComponent from './FieldComponent';

interface DragItem {
  index: number;
  type: 'field' | 'section';
}

export default function Canvas() {
  const { fields, updateField, removeField, reorderFields } =
    useFormStore();
  const [draggedItem, setDraggedItem] = useState<DragItem | null>(
    null
  );

  const handleDragStart = (
    e: React.DragEvent,
    index: number
  ) => {
    setDraggedItem({ index, type: 'field' });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (
    e: React.DragEvent,
    targetIndex: number
  ) => {
    e.preventDefault();
    if (!draggedItem || draggedItem.index === targetIndex) return;

    const newOrder = Array.from(fields);
    const [movedField] = newOrder.splice(draggedItem.index, 1);
    newOrder.splice(targetIndex, 0, movedField);

    reorderFields(newOrder);
    setDraggedItem(null);
  };

  return (
    <div className="flex-1 border border-gray-300 rounded-lg p-6
                    bg-white overflow-y-auto">
      <h2 className="text-lg font-bold mb-4">Form Preview</h2>

      {fields.length === 0 ? (
        <div className="text-center text-gray-500 py-12">
          <p>Drag fields from the palette to start building
             your form</p>
        </div>
      ) : (
        <div className="space-y-4">
          {fields.map((field, index) => (
            <div
              key={field.id}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, index)}
              className="p-4 border border-gray-200 rounded-lg
                         hover:border-blue-400 cursor-move
                         transition"
            >
              <div className="flex justify-between items-start">
                <FieldComponent field={field} />
                <button
                  onClick={() => removeField(field.id)}
                  className="text-red-600 hover:text-red-800
                             font-semibold"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

#### 3. Form Renderer Component

```typescript
// components/Runtime/FormRenderer.tsx
import React, { useState, useEffect } from 'react';
import FieldRenderer from './FieldRenderer';
import ValidationDisplay from './ValidationDisplay';
import { FormDefinition, SubmissionData } from '@/types/forms';
import { formAPI } from '@/services/forms';

interface FormRendererProps {
  formCode: string;
  onSubmitSuccess: (submissionId: string) => void;
}

export default function FormRenderer({
  formCode,
  onSubmitSuccess,
}: FormRendererProps) {
  const [form, setForm] = useState<FormDefinition | null>(null);
  const [data, setData] = useState<SubmissionData>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadForm();
  }, [formCode]);

  const loadForm = async () => {
    try {
      const formData = await formAPI.getFormByCode(formCode);
      setForm(formData);
    } catch (error) {
      console.error('Failed to load form', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (fieldKey: string, value: any) => {
    setData((prev) => ({ ...prev, [fieldKey]: value }));
    // Clear error for this field
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[fieldKey];
      return newErrors;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrors({});

    try {
      const response = await formAPI.submitForm(formCode, {
        data,
      });
      onSubmitSuccess(response.submissionId);
    } catch (error: any) {
      // Handle validation errors
      if (error.response?.data?.details) {
        const errorMap: Record<string, string> = {};
        error.response.data.details.forEach(
          (detail: any) => {
            errorMap[detail.fieldKey] = detail.message;
          }
        );
        setErrors(errorMap);
      } else {
        setErrors({
          _form: error.response?.data?.message ||
                  'Submission failed',
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div>Loading form...</div>;
  if (!form) return <div>Form not found</div>;

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto
                                             space-y-6">
      <h1 className="text-3xl font-bold">{form.name}</h1>

      {form.description && (
        <p className="text-gray-600">{form.description}</p>
      )}

      {errors._form && (
        <ValidationDisplay
          error={errors._form}
          type="form"
        />
      )}

      <div className="space-y-4">
        {form.fields.map((field) => (
          <div key={field.id} className="space-y-2">
            <FieldRenderer
              field={field}
              value={data[field.fieldKey]}
              onChange={(value) =>
                handleFieldChange(field.fieldKey, value)
              }
              error={errors[field.fieldKey]}
            />
          </div>
        ))}
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="bg-blue-600 text-white px-6 py-2
                   rounded-lg font-semibold
                   disabled:bg-gray-400
                   hover:bg-blue-700"
      >
        {submitting ? 'Submitting...' : 'Submit'}
      </button>
    </form>
  );
}
```

#### 4. API Service

```typescript
// services/api.ts
import axios, { AxiosInstance, AxiosError } from 'axios';

const baseURL = process.env.NEXT_PUBLIC_API_URL ||
                'http://localhost:8080/api/v1';

const axiosInstance: AxiosInstance = axios.create({
  baseURL,
  withCredentials: true, // Include cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add CSRF token to requests
axiosInstance.interceptors.request.use((config) => {
  const token = document.querySelector(
    'meta[name="_csrf"]'
  )?.getAttribute('content');
  if (token) {
    config.headers['X-CSRF-Token'] = token;
  }
  return config;
});

// Handle auth errors
axiosInstance.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Redirect to login
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const api = {
  get: <T = any>(url: string, config = {}) =>
    axiosInstance.get<T>(url, config).then((r) => r.data),

  post: <T = any>(url: string, data?: any, config = {}) =>
    axiosInstance.post<T>(url, data, config).then((r) => r.data),

  put: <T = any>(url: string, data?: any, config = {}) =>
    axiosInstance.put<T>(url, data, config).then((r) => r.data),

  delete: <T = any>(url: string, config = {}) =>
    axiosInstance.delete<T>(url, config).then((r) => r.data),
};
```

---

## Database Implementation

### Complete Schema SQL

```sql
-- Users and Roles
CREATE TABLE app_user (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE app_role (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT
);

CREATE TABLE user_role (
  user_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES app_role(id) ON DELETE CASCADE,
  PRIMARY KEY(user_id, role_id)
);

-- Forms
CREATE TABLE form (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(20) NOT NULL CHECK (
    status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')
  ),
  created_by VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Form Versions
CREATE TABLE form_version (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES form(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  definition_json JSONB NOT NULL,
  created_by VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(form_id, version_number)
);

-- Form Fields
CREATE TABLE form_field (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_version_id UUID NOT NULL
    REFERENCES form_version(id) ON DELETE CASCADE,
  field_key VARCHAR(100) NOT NULL,
  label VARCHAR(255) NOT NULL,
  field_type VARCHAR(50) NOT NULL,
  is_required BOOLEAN NOT NULL DEFAULT false,
  is_read_only BOOLEAN NOT NULL DEFAULT false,
  default_value TEXT,
  display_order INTEGER NOT NULL,
  config_json JSONB,
  UNIQUE(form_version_id, field_key)
);

-- Field Validations
CREATE TABLE field_validation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_version_id UUID NOT NULL
    REFERENCES form_version(id) ON DELETE CASCADE,
  field_key VARCHAR(100),
  validation_type VARCHAR(50) NOT NULL,
  expression TEXT NOT NULL,
  error_message VARCHAR(255) NOT NULL,
  execution_order INTEGER NOT NULL,
  scope VARCHAR(20) NOT NULL DEFAULT 'FIELD'
    CHECK (scope IN ('FIELD', 'FORM'))
);

-- Submission Metadata
CREATE TABLE form_submission_meta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES form(id),
  form_version_id UUID NOT NULL REFERENCES form_version(id),
  submission_table VARCHAR(255) NOT NULL,
  submission_row_id UUID NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'SUBMITTED')),
  submitted_by VARCHAR(100),
  submitted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_deleted BOOLEAN DEFAULT false
);

-- Audit Log
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(100) NOT NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100),
  entity_id VARCHAR(100),
  changes JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_form_code ON form(code);
CREATE INDEX idx_form_status ON form(status);
CREATE INDEX idx_form_version_form_active
  ON form_version(form_id, is_active);
CREATE INDEX idx_form_submission_meta_form_status
  ON form_submission_meta(form_id, status);
CREATE INDEX idx_form_submission_meta_created_at
  ON form_submission_meta(created_at DESC);
CREATE INDEX idx_audit_log_created_at
  ON audit_log(created_at DESC);
CREATE INDEX idx_audit_log_user_id
  ON audit_log(user_id);
```

---

## Deployment Guide

### Prerequisites

- Java 21 (OpenJDK or Oracle)
- Node.js 18+
- PostgreSQL 14+
- Git
- Docker (optional)

### Step 1: Database Setup

```bash
# Create database
psql -U postgres -c "CREATE DATABASE formbuilder2;"

# Run schema
psql -U postgres formbuilder2 < sql/schema.sql

# Seed initial data
psql -U postgres formbuilder2 < sql/seeder.sql
```

### Step 2: Backend Setup

```bash
cd formbuilder-backend1

# Build
mvn clean package

# Run
java -jar target/formbuilder2-0.0.1-SNAPSHOT.jar
```

### Step 3: Frontend Setup

```bash
cd formbuilder-frontend1

# Install dependencies
npm install

# Build
npm run build

# Run production
npm start
```

### Step 4: Access Application

- Frontend: http://localhost:3000
- API: http://localhost:8080/api/v1
- Swagger UI: http://localhost:8080/swagger-ui.html

**Default Credentials:**
- Username: `admin`
- Password: `admin123`

---

## Troubleshooting

### Common Issues

**Backend fails to start:**
```bash
# Check PostgreSQL connection
psql -U postgres -c "\\l"

# Check port 8080
lsof -i :8080
```

**Frontend can't connect:**
- Verify NEXT_PUBLIC_API_URL in .env.local
- Check CORS configuration
- Verify backend is running

**Database errors:**
```bash
# Reset database
DROP DATABASE formbuilder2;
CREATE DATABASE formbuilder2;
psql -U postgres formbuilder2 < sql/schema.sql
```

**See full documentation for more troubleshooting steps.**

---

*End of Implementation Guide*
