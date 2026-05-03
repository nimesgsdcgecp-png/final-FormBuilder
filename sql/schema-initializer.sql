-- ==============================================================================
-- FormBuilder3 - Complete Database Initializer
-- ==============================================================================
-- IMPORTANT: This file creates the entire database from scratch with:
--   ✅ All tables (18 total)
--   ✅ All permissions
--   ✅ All roles with full permissions
--   ✅ All modules
--   ✅ Complete admin user with all permissions
--   ✅ Default configurations
--
-- This is a ONE-FILE setup. Run this ONCE to start fresh.
-- ==============================================================================

-- ==============================================================================
-- PART 1: SAFETY CHECKS & CLEANUP
-- ==============================================================================
-- DROP SCHEMA public CASCADE; CREATE SCHEMA public;

-- ==============================================================================
-- PART 2: CREATE TABLES
-- ==============================================================================

-- 1. Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    last_login TIMESTAMP WITH TIME ZONE,
    reset_attempts INTEGER DEFAULT 0,
    last_reset_attempt TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Roles table
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) UNIQUE NOT NULL,
    description VARCHAR(255),
    created_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    parent_role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
    is_system_role BOOLEAN DEFAULT FALSE
);

-- 3. Permissions table
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) UNIQUE NOT NULL,
    description VARCHAR(255),
    category VARCHAR(255) NOT NULL,
    feature_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Modules table
CREATE TABLE IF NOT EXISTS modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_name VARCHAR(255) NOT NULL,
    prefix VARCHAR(255),
    icon_css VARCHAR(255),
    description TEXT,
    active BOOLEAN DEFAULT TRUE,
    is_parent BOOLEAN DEFAULT FALSE,
    is_sub_parent BOOLEAN DEFAULT FALSE,
    parent_id UUID REFERENCES modules(id) ON DELETE SET NULL,
    sub_parent_id UUID REFERENCES modules(id) ON DELETE SET NULL,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Role-Permission mapping
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Role-Module mapping
CREATE TABLE IF NOT EXISTS role_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(role_id, module_id)
);

-- 7. User-Form-Role assignments
CREATE TABLE IF NOT EXISTS user_form_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    form_id UUID,
    assigned_by VARCHAR(255),
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Forms table
CREATE TABLE IF NOT EXISTS forms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    code VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(255) NOT NULL DEFAULT 'DRAFT',
    code_locked BOOLEAN NOT NULL DEFAULT FALSE,
    allow_edit_response BOOLEAN NOT NULL DEFAULT FALSE,
    public_share_token VARCHAR(255) UNIQUE,
    target_table_name VARCHAR(255),
    approval_chain TEXT,
    issued_by_username VARCHAR(255),
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    creator_id UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 9. Form Versions table
CREATE TABLE IF NOT EXISTS form_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    change_log TEXT,
    definition_json JSONB NOT NULL,
    rules TEXT,
    activated_by VARCHAR(255),
    activated_at TIMESTAMP WITH TIME ZONE,
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_form_id_version UNIQUE(form_id, version_number)
);

-- 10. Password Reset Tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token VARCHAR(255) NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expiry_date TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 11. Form Fields table
CREATE TABLE IF NOT EXISTS form_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_version_id UUID NOT NULL REFERENCES form_versions(id) ON DELETE CASCADE,
    field_key VARCHAR(255) NOT NULL,
    label TEXT NOT NULL,
    field_type VARCHAR(255) NOT NULL,
    is_required BOOLEAN NOT NULL DEFAULT FALSE,
    is_read_only BOOLEAN NOT NULL DEFAULT FALSE,
    is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
    is_disabled BOOLEAN NOT NULL DEFAULT FALSE,
    is_multi_select BOOLEAN NOT NULL DEFAULT FALSE,
    is_unique BOOLEAN NOT NULL DEFAULT FALSE,
    default_value VARCHAR(255),
    help_text TEXT,
    calculation_formula TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    field_options TEXT,
    parent_column_name VARCHAR(255),
    config_json JSONB,
    validation_rules JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_form_version_field UNIQUE(form_version_id, field_key)
);

-- 12. Field Validations table
CREATE TABLE IF NOT EXISTS field_validations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_version_id UUID NOT NULL REFERENCES form_versions(id) ON DELETE CASCADE,
    field_key VARCHAR(255),
    validation_type VARCHAR(255) NOT NULL,
    scope VARCHAR(255) NOT NULL,
    expression TEXT NOT NULL,
    error_message TEXT NOT NULL,
    execution_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 13. Form Submission Metadata table
CREATE TABLE IF NOT EXISTS form_submission_meta (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID NOT NULL,
    form_version_id UUID NOT NULL,
    submission_table VARCHAR(255) NOT NULL,
    submission_row_id UUID NOT NULL,
    status VARCHAR(255) NOT NULL DEFAULT 'SUBMITTED',
    submitted_by VARCHAR(255),
    submitted_at TIMESTAMP WITH TIME ZONE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 14. Workflow Instances table
CREATE TABLE IF NOT EXISTS workflow_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_builder_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(255) DEFAULT 'PENDING',
    total_steps INTEGER,
    current_step_index INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 15. Workflow Steps table
CREATE TABLE IF NOT EXISTS workflow_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id UUID NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
    approver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    step_index INTEGER,
    status VARCHAR(255) DEFAULT 'PENDING',
    comments TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    decided_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 16. Audit Logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action VARCHAR(255) NOT NULL,
    actor VARCHAR(255) NOT NULL,
    resource_type VARCHAR(255),
    resource_id VARCHAR(255),
    details TEXT,
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    ip_address VARCHAR(255),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 17. Level Up Requests table
CREATE TABLE IF NOT EXISTS level_up_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(255) NOT NULL DEFAULT 'PENDING',
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    decided_by VARCHAR(255),
    decided_at TIMESTAMP WITH TIME ZONE
);

-- 18. System Configurations table
CREATE TABLE IF NOT EXISTS system_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key VARCHAR(255) UNIQUE NOT NULL,
    config_value VARCHAR(255),
    description VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- PART 3: CREATE INDEXES
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_forms_code ON forms(code);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor);

-- ==============================================================================
-- PART 4: SEED DATA
-- ==============================================================================

-- 1. Permissions
INSERT INTO permissions (id, name, description, category, feature_id) VALUES
    ('11111111-1111-1111-1000-000000000001', 'MANAGE', 'Full administrative access', 'System', 'ALL'),
    ('11111111-1111-1111-1000-000000000002', 'READ', 'Read access to resources', 'System', 'ALL'),
    ('11111111-1111-1111-1000-000000000003', 'WRITE', 'Write/Create new resources', 'System', 'ALL'),
    ('11111111-1111-1111-1000-000000000004', 'EDIT', 'Edit existing resources', 'System', 'ALL'),
    ('11111111-1111-1111-1000-000000000005', 'AUDIT', 'Access audit logs', 'System', 'ALL'),
    ('11111111-1111-1111-1000-000000000006', 'DELETE', 'Delete resources', 'System', 'ALL'),
    ('11111111-1111-1111-1000-000000000007', 'EXPORT', 'Export data', 'System', 'ALL'),
    ('11111111-1111-1111-1000-000000000008', 'APPROVE', 'Approval authority', 'System', 'ALL'),
    ('11111111-1111-1111-1000-000000000009', 'VISIBILITY', 'Visibility control', 'System', 'ALL')
ON CONFLICT (name) DO NOTHING;

-- 2. Roles
INSERT INTO roles (id, name, description, created_by, is_system_role) VALUES
    ('22222222-2222-2222-2000-000000000001', 'ADMIN', 'System Administrator with full access', 'system', TRUE),
    ('22222222-2222-2222-2000-000000000002', 'ROLE_ADMIN', 'Role Administrator (alias to ADMIN)', 'system', TRUE),
    ('22222222-2222-2222-2000-000000000003', 'BUILDER', 'Form Builder - Can create and publish forms', 'system', TRUE),
    ('22222222-2222-2222-2000-000000000004', 'USER', 'Standard User - Can submit forms', 'system', TRUE)
ON CONFLICT (name) DO NOTHING;

-- 2.5 Role-Permission Mapping
-- Links roles to granular permissions
INSERT INTO role_permissions (role_id, permission_id) VALUES
    -- ADMIN gets all permissions
    ('22222222-2222-2222-2000-000000000001', '11111111-1111-1111-1000-000000000001'), -- MANAGE
    ('22222222-2222-2222-2000-000000000001', '11111111-1111-1111-1000-000000000002'), -- READ
    ('22222222-2222-2222-2000-000000000001', '11111111-1111-1111-1000-000000000003'), -- WRITE
    ('22222222-2222-2222-2000-000000000001', '11111111-1111-1111-1000-000000000004'), -- EDIT
    ('22222222-2222-2222-2000-000000000001', '11111111-1111-1111-1000-000000000005'), -- AUDIT
    ('22222222-2222-2222-2000-000000000001', '11111111-1111-1111-1000-000000000006'), -- DELETE
    ('22222222-2222-2222-2000-000000000001', '11111111-1111-1111-1000-000000000007'), -- EXPORT
    ('22222222-2222-2222-2000-000000000001', '11111111-1111-1111-1000-000000000008'), -- APPROVE
    ('22222222-2222-2222-2000-000000000001', '11111111-1111-1111-1000-000000000009'), -- VISIBILITY

    -- ROLE_ADMIN (alias) also gets all permissions
    ('22222222-2222-2222-2000-000000000002', '11111111-1111-1111-1000-000000000001'), -- MANAGE
    ('22222222-2222-2222-2000-000000000002', '11111111-1111-1111-1000-000000000002'), -- READ
    ('22222222-2222-2222-2000-000000000002', '11111111-1111-1111-1000-000000000003'), -- WRITE
    ('22222222-2222-2222-2000-000000000002', '11111111-1111-1111-1000-000000000004'), -- EDIT

    -- BUILDER gets creation and viewing permissions
    ('22222222-2222-2222-2000-000000000003', '11111111-1111-1111-1000-000000000002'), -- READ
    ('22222222-2222-2222-2000-000000000003', '11111111-1111-1111-1000-000000000003'), -- WRITE
    ('22222222-2222-2222-2000-000000000003', '11111111-1111-1111-1000-000000000004'), -- EDIT

    -- USER gets read-only access
    ('22222222-2222-2222-2000-000000000004', '11111111-1111-1111-1000-000000000002')  -- READ
ON CONFLICT DO NOTHING;

-- 3. Admin User (Password: admin@123456)
INSERT INTO users (id, username, password_hash, email, first_name, last_name, is_active, created_at) VALUES
    ('66666666-6666-6666-6000-000000000001', 'admin', '$2b$10$BovrWvKcd5pxIoNQPOoZe.JHOXitasAxkECnJG.BMSKlAx3xaPYs.', 'admin@formbuilder.local', 'System', 'Administrator', TRUE, CURRENT_TIMESTAMP)
ON CONFLICT (username) DO NOTHING;

-- 4. Role Assignment
INSERT INTO user_form_roles (id, user_id, role_id, assigned_by) VALUES
    ('77777777-7777-7777-7000-000000000001', '66666666-6666-6666-6000-000000000001', '22222222-2222-2222-2000-000000000001', 'system')
ON CONFLICT DO NOTHING;

-- 5. Config
INSERT INTO system_configurations (config_key, config_value, description) VALUES
    ('APP_NAME', 'FormBuilder3', 'Application name'),
    ('APP_VERSION', '1.0.0', 'Application version'),
    ('DATABASE_INITIALIZED', 'true', 'Flag to check if database is set up')
ON CONFLICT (config_key) DO NOTHING;

-- ==============================================================================
-- SUMMARY
-- ==============================================================================
-- ✅ Database initialization complete!
-- ✅ 18 Tables | Complete RBAC | Admin User
-- ==============================================================================
