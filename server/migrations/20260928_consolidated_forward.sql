-- =====================================================================
-- SUTHieCare consolidated forward migration (MySQL 8.0 / 8.4)
--
-- Combines, in dependency order, every forward migration after patient_auth.sql
--   20260901_organizations_rbac.sql
--   20260901_clinics_forms_organization.sql   (covered by the RBAC section)
--   20260901_assign_unassigned_to_suth_hospital.sql
--   20260901_patient_account_identity.sql
--   20260902_form_result_display_mode.sql
--   20260902_form_requires_login.sql + 20260902_form_login_enforcement.sql
--   20260915_schema_alignment.sql
--   email_otp.sql                              (rewritten without the MariaDB-only IF NOT EXISTS)
--   staff_trusted_sessions                     (from scripts/migrateStaffTrustedSessions.js)
--   20260916_operational_organization_scope.sql
--
-- Idempotent: every DDL step checks information_schema first, so it is safe to
-- run on a fresh upgrade or on a database that already has part of it.
-- No stored procedures or DELIMITER, so it runs in the mysql CLI, Navicat,
-- and the Node migration runner (which splits on semicolons, so keep comments
-- free of them).
--
-- Against the production dump of 18/09/2569 the only real changes are
--   * create table staff_trusted_sessions
--   * assign organization to the few rows created after that deploy
--     (mastercases, form_responses, service_types with organization_id NULL)
--
-- BACK UP THE DATABASE BEFORE RUNNING.
-- =====================================================================

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------
-- 0. Preconditions (fail fast if patient_auth.sql was never applied)
-- ---------------------------------------------------------------------
SELECT 1 FROM patient_accounts LIMIT 0;
SELECT patient_account_id FROM form_responses LIMIT 0;

-- ---------------------------------------------------------------------
-- 1. Multi-organization RBAC tables
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organizations (
  id INT NOT NULL AUTO_INCREMENT,
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY uq_organizations_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS system_roles (
  id INT NOT NULL AUTO_INCREMENT,
  code VARCHAR(64) NOT NULL,
  name VARCHAR(100) NOT NULL,
  PRIMARY KEY (id), UNIQUE KEY uq_system_roles_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT IGNORE INTO system_roles (id, code, name) VALUES (1, 'system_admin', 'System Admin');

CREATE TABLE IF NOT EXISTS user_system_roles (
  user_id INT NOT NULL,
  system_role_id INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, system_role_id),
  CONSTRAINT fk_usr_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_usr_role FOREIGN KEY (system_role_id) REFERENCES system_roles(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS organization_memberships (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  organization_id INT NOT NULL,
  role_id INT NOT NULL,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  is_primary TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY uq_org_member (user_id, organization_id),
  KEY idx_org_memberships_org_status (organization_id, status),
  KEY idx_org_memberships_user_status (user_id, status),
  CONSTRAINT fk_om_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_om_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_om_role FOREIGN KEY (role_id) REFERENCES roles(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INT NOT NULL,
  permission_key VARCHAR(100) NOT NULL,
  PRIMARY KEY (role_id, permission_key),
  CONSTRAINT fk_rp_role FOREIGN KEY (role_id) REFERENCES roles(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS authorization_audit_logs (
  id BIGINT NOT NULL AUTO_INCREMENT,
  request_id CHAR(36) NULL,
  actor_user_id INT NULL,
  organization_id INT NULL,
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(80) NULL,
  target_id VARCHAR(100) NULL,
  result ENUM('allowed','denied','changed') NOT NULL,
  reason VARCHAR(255) NULL,
  before_data JSON NULL,
  after_data JSON NULL,
  ip VARCHAR(64) NULL,
  user_agent VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id), KEY idx_auth_audit_actor_created (actor_user_id, created_at),
  KEY idx_auth_audit_org_created (organization_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 2. organization_id on mastercases, form_responses, clinics, forms
-- ---------------------------------------------------------------------
SET @sql := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='mastercases' AND COLUMN_NAME='organization_id')=0,
  'ALTER TABLE mastercases ADD COLUMN organization_id INT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='mastercases' AND INDEX_NAME='idx_mastercases_organization')=0,
  'CREATE INDEX idx_mastercases_organization ON mastercases (organization_id)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='mastercases' AND CONSTRAINT_NAME='fk_mastercases_organization')=0,
  'ALTER TABLE mastercases ADD CONSTRAINT fk_mastercases_organization FOREIGN KEY (organization_id) REFERENCES organizations(id)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='form_responses' AND COLUMN_NAME='organization_id')=0,
  'ALTER TABLE form_responses ADD COLUMN organization_id INT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='form_responses' AND INDEX_NAME='idx_form_responses_organization')=0,
  'CREATE INDEX idx_form_responses_organization ON form_responses (organization_id)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='form_responses' AND CONSTRAINT_NAME='fk_form_responses_organization')=0,
  'ALTER TABLE form_responses ADD CONSTRAINT fk_form_responses_organization FOREIGN KEY (organization_id) REFERENCES organizations(id)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='clinics' AND COLUMN_NAME='organization_id')=0,
  'ALTER TABLE clinics ADD COLUMN organization_id INT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='clinics' AND INDEX_NAME='idx_clinics_organization')=0,
  'CREATE INDEX idx_clinics_organization ON clinics (organization_id)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='clinics' AND CONSTRAINT_NAME='fk_clinics_organization')=0,
  'ALTER TABLE clinics ADD CONSTRAINT fk_clinics_organization FOREIGN KEY (organization_id) REFERENCES organizations(id)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='forms' AND COLUMN_NAME='organization_id')=0,
  'ALTER TABLE forms ADD COLUMN organization_id INT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='forms' AND INDEX_NAME='idx_forms_organization')=0,
  'CREATE INDEX idx_forms_organization ON forms (organization_id)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='forms' AND CONSTRAINT_NAME='fk_forms_organization')=0,
  'ALTER TABLE forms ADD CONSTRAINT fk_forms_organization FOREIGN KEY (organization_id) REFERENCES organizations(id)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------
-- 3. Seed RBAC from the legacy permissions matrix.
--    Only when role_permissions / user_system_roles are still empty, so a
--    re-run never re-grants access an administrator removed in the new UI.
-- ---------------------------------------------------------------------
SET @rbac_fresh := (SELECT COUNT(*) = 0 FROM role_permissions);
SET @sysrole_fresh := (SELECT COUNT(*) = 0 FROM user_system_roles);

INSERT IGNORE INTO user_system_roles (user_id, system_role_id)
SELECT id, 1 FROM users WHERE role_id = 1 AND @sysrole_fresh;

INSERT IGNORE INTO role_permissions (role_id, permission_key)
SELECT role_id, 'dashboard.view' FROM permissions WHERE @rbac_fresh AND module IN ('Dashboard') AND (can_view OR can_manage OR can_full);
INSERT IGNORE INTO role_permissions (role_id, permission_key)
SELECT role_id, 'cases.view' FROM permissions WHERE @rbac_fresh AND module IN ('Case Management','จัดการเคส') AND (can_view OR can_manage OR can_full);
INSERT IGNORE INTO role_permissions (role_id, permission_key)
SELECT p.role_id, k.permission_key FROM permissions p CROSS JOIN (SELECT 'cases.create' permission_key UNION ALL SELECT 'cases.update' UNION ALL SELECT 'cases.delete' UNION ALL SELECT 'cases.assign' UNION ALL SELECT 'cases.export') k WHERE @rbac_fresh AND p.module IN ('Case Management','จัดการเคส') AND (p.can_manage OR p.can_full);
INSERT IGNORE INTO role_permissions (role_id, permission_key)
SELECT role_id, 'appointments.view' FROM permissions WHERE @rbac_fresh AND module IN ('Appointments','ตารางนัดหมาย') AND (can_view OR can_manage OR can_full);
INSERT IGNORE INTO role_permissions (role_id, permission_key)
SELECT p.role_id, k.permission_key FROM permissions p CROSS JOIN (SELECT 'appointments.create' permission_key UNION ALL SELECT 'appointments.update' UNION ALL SELECT 'appointments.delete') k WHERE @rbac_fresh AND p.module IN ('Appointments','ตารางนัดหมาย') AND (p.can_manage OR p.can_full);
INSERT IGNORE INTO role_permissions (role_id, permission_key)
SELECT role_id, 'patient_members.view' FROM permissions WHERE @rbac_fresh AND module IN ('User Management','จัดการผู้ใช้ (Users)','จัดการผู้ใช้') AND (can_view OR can_manage OR can_full);
INSERT IGNORE INTO role_permissions (role_id, permission_key)
SELECT p.role_id, k.permission_key FROM permissions p CROSS JOIN (SELECT 'patient_members.update' permission_key UNION ALL SELECT 'patient_members.delete') k WHERE @rbac_fresh AND p.module IN ('User Management','จัดการผู้ใช้ (Users)','จัดการผู้ใช้') AND (p.can_manage OR p.can_full);
INSERT IGNORE INTO role_permissions (role_id, permission_key)
SELECT role_id, 'forms.view' FROM permissions WHERE @rbac_fresh AND module IN ('Form Management','จัดการฟอร์ม') AND (can_view OR can_manage OR can_full);
INSERT IGNORE INTO role_permissions (role_id, permission_key)
SELECT p.role_id, k.permission_key FROM permissions p CROSS JOIN (SELECT 'forms.create' permission_key UNION ALL SELECT 'forms.update' UNION ALL SELECT 'forms.delete') k WHERE @rbac_fresh AND p.module IN ('Form Management','จัดการฟอร์ม') AND (p.can_manage OR p.can_full);
INSERT IGNORE INTO role_permissions (role_id, permission_key)
SELECT role_id, 'clinics.view' FROM permissions WHERE @rbac_fresh AND module = 'Clinic Management' AND (can_view OR can_manage OR can_full);
INSERT IGNORE INTO role_permissions (role_id, permission_key)
SELECT p.role_id, k.permission_key FROM permissions p CROSS JOIN (SELECT 'clinics.create' permission_key UNION ALL SELECT 'clinics.update' UNION ALL SELECT 'clinics.delete') k WHERE @rbac_fresh AND p.module = 'Clinic Management' AND (p.can_manage OR p.can_full);
INSERT IGNORE INTO role_permissions (role_id, permission_key)
SELECT role_id, 'help_center.view' FROM permissions WHERE @rbac_fresh AND module = 'Help Center Management' AND (can_view OR can_manage OR can_full);
INSERT IGNORE INTO role_permissions (role_id, permission_key)
SELECT p.role_id, k.permission_key FROM permissions p CROSS JOIN (SELECT 'help_center.create' permission_key UNION ALL SELECT 'help_center.update' UNION ALL SELECT 'help_center.delete') k WHERE @rbac_fresh AND p.module = 'Help Center Management' AND (p.can_manage OR p.can_full);
INSERT IGNORE INTO role_permissions (role_id, permission_key)
SELECT role_id, 'content.view' FROM permissions WHERE @rbac_fresh AND module = 'Content Management' AND (can_view OR can_manage OR can_full);
INSERT IGNORE INTO role_permissions (role_id, permission_key)
SELECT p.role_id, k.permission_key FROM permissions p CROSS JOIN (SELECT 'content.create' permission_key UNION ALL SELECT 'content.update' UNION ALL SELECT 'content.delete') k WHERE @rbac_fresh AND p.module = 'Content Management' AND (p.can_manage OR p.can_full);

-- ---------------------------------------------------------------------
-- 4. Assign unowned records to SUT Hospital (safe to repeat)
-- ---------------------------------------------------------------------
INSERT INTO organizations (code, name, description, status)
SELECT 'SUTH-HOSPITAL',
       'โรงพยาบาลมหาวิทยาลัยเทคโนโลยีสุรนารี',
       'หน่วยงานหลักสำหรับข้อมูลเดิมของระบบและบริการโรงพยาบาลมหาวิทยาลัยเทคโนโลยีสุรนารี',
       'active'
WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE name = 'โรงพยาบาลมหาวิทยาลัยเทคโนโลยีสุรนารี');

SET @suth_org := (SELECT MIN(id) FROM organizations WHERE name = 'โรงพยาบาลมหาวิทยาลัยเทคโนโลยีสุรนารี');

UPDATE clinics SET organization_id = @suth_org
WHERE organization_id IS NULL
   OR organization_id IN (SELECT id FROM organizations WHERE name = 'โรงพยาบาลมหาวิทยาลัยเทคโนโลยีสุรนารี' AND id <> @suth_org);

UPDATE forms SET organization_id = @suth_org
WHERE organization_id IS NULL
   OR organization_id IN (SELECT id FROM organizations WHERE name = 'โรงพยาบาลมหาวิทยาลัยเทคโนโลยีสุรนารี' AND id <> @suth_org);

-- Form ownership follows the clinic selected in clinic_type.
UPDATE forms f JOIN clinics c ON c.slug = f.clinic_type
SET f.organization_id = c.organization_id
WHERE c.organization_id IS NOT NULL AND NOT (f.organization_id <=> c.organization_id);

-- Responses and cases take the organization of their form, then fall back to SUT Hospital.
UPDATE form_responses r JOIN forms f ON f.id = r.form_id
SET r.organization_id = f.organization_id
WHERE r.organization_id IS NULL AND f.organization_id IS NOT NULL;

UPDATE mastercases m JOIN form_responses r ON r.master_case_id = m.id
SET m.organization_id = r.organization_id
WHERE m.organization_id IS NULL AND r.organization_id IS NOT NULL;

UPDATE mastercases SET organization_id = @suth_org
WHERE organization_id IS NULL
   OR organization_id IN (SELECT id FROM organizations WHERE name = 'โรงพยาบาลมหาวิทยาลัยเทคโนโลยีสุรนารี' AND id <> @suth_org);

UPDATE form_responses SET organization_id = @suth_org
WHERE organization_id IS NULL
   OR organization_id IN (SELECT id FROM organizations WHERE name = 'โรงพยาบาลมหาวิทยาลัยเทคโนโลยีสุรนารี' AND id <> @suth_org);

-- Keep duplicate hospital rows for audit but hide them from selectors.
UPDATE organizations SET status = 'inactive'
WHERE name = 'โรงพยาบาลมหาวิทยาลัยเทคโนโลยีสุรนารี' AND id <> @suth_org AND status <> 'inactive';
UPDATE organizations SET status = 'active' WHERE id = @suth_org AND status <> 'active';

-- ---------------------------------------------------------------------
-- 5. Form result display mode and login enforcement
-- ---------------------------------------------------------------------
SET @sql := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='forms' AND COLUMN_NAME='result_display_mode')=0,
  'ALTER TABLE forms ADD COLUMN result_display_mode ENUM(''realtime'',''on_submit'') NOT NULL DEFAULT ''realtime''', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='forms' AND COLUMN_NAME='login_enforcement')=0,
  'ALTER TABLE forms ADD COLUMN login_enforcement ENUM(''strict'',''optional'',''none'') NOT NULL DEFAULT ''none'' AFTER result_display_mode', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Legacy requires_login = 1 becomes 'optional', then the old column is dropped.
SET @has_requires_login := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='forms' AND COLUMN_NAME='requires_login');
SET @sql := IF(@has_requires_login > 0,
  'UPDATE forms SET login_enforcement = ''optional'' WHERE requires_login = 1 AND login_enforcement = ''none''', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := IF(@has_requires_login > 0, 'ALTER TABLE forms DROP COLUMN requires_login', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------
-- 6. Patient account ownership of submissions
-- ---------------------------------------------------------------------
SET @sql := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='mastercases' AND COLUMN_NAME='patient_account_id')=0,
  'ALTER TABLE mastercases ADD COLUMN patient_account_id INT NULL AFTER id', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='mastercases' AND COLUMN_NAME='identityValue' AND IS_NULLABLE='YES' AND COLUMN_TYPE='varchar(255)')=0,
  'ALTER TABLE mastercases MODIFY identityValue VARCHAR(255) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='mastercases' AND INDEX_NAME='idx_mastercases_account_clinic_status')=0,
  'CREATE INDEX idx_mastercases_account_clinic_status ON mastercases (patient_account_id, clinicType, status)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='form_responses' AND INDEX_NAME='idx_form_responses_patient_account')=0,
  'CREATE INDEX idx_form_responses_patient_account ON form_responses (patient_account_id, submitted_at)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='mastercases' AND CONSTRAINT_NAME='fk_mastercases_patient_account')=0,
  'ALTER TABLE mastercases ADD CONSTRAINT fk_mastercases_patient_account FOREIGN KEY (patient_account_id) REFERENCES patient_accounts(id) ON DELETE SET NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='form_responses' AND CONSTRAINT_NAME='fk_form_responses_patient_account')=0,
  'ALTER TABLE form_responses ADD CONSTRAINT fk_form_responses_patient_account FOREIGN KEY (patient_account_id) REFERENCES patient_accounts(id) ON DELETE SET NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS patient_identity_backfill_log (
  id BIGINT NOT NULL AUTO_INCREMENT,
  run_id CHAR(36) NOT NULL,
  entity_type ENUM('form_response', 'master_case') NOT NULL,
  record_id BIGINT NOT NULL,
  previous_patient_account_id INT NULL,
  patient_account_id INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_patient_identity_backfill (run_id, entity_type, record_id),
  KEY idx_patient_identity_backfill_record (entity_type, record_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 7. Schema alignment (clinics.name_en, users.name as TEXT for ciphertext)
-- ---------------------------------------------------------------------
SET @sql := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='clinics' AND COLUMN_NAME='name_en')=0,
  'ALTER TABLE clinics ADD COLUMN name_en VARCHAR(255) NULL AFTER name', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='name' AND DATA_TYPE LIKE '%text%')=0,
  'ALTER TABLE users MODIFY COLUMN name TEXT CHARACTER SET utf8mb4 NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------
-- 8. Email OTP (staff login, email verification, account recovery)
-- ---------------------------------------------------------------------
SET @sql := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='email_verified_at')=0,
  'ALTER TABLE users ADD COLUMN email_verified_at DATETIME NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='pending_email')=0,
  'ALTER TABLE users ADD COLUMN pending_email VARCHAR(254) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='auth_version')=0,
  'ALTER TABLE users ADD COLUMN auth_version INT NOT NULL DEFAULT 0', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='patient_accounts' AND COLUMN_NAME='email')=0,
  'ALTER TABLE patient_accounts ADD COLUMN email VARCHAR(254) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='patient_accounts' AND COLUMN_NAME='email_verified_at')=0,
  'ALTER TABLE patient_accounts ADD COLUMN email_verified_at DATETIME NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='patient_accounts' AND COLUMN_NAME='pending_email')=0,
  'ALTER TABLE patient_accounts ADD COLUMN pending_email VARCHAR(254) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='patient_accounts' AND COLUMN_NAME='auth_version')=0,
  'ALTER TABLE patient_accounts ADD COLUMN auth_version INT NOT NULL DEFAULT 0', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS auth_email_challenges (
  id BIGINT NOT NULL AUTO_INCREMENT,
  token_hash CHAR(64) NOT NULL,
  account_type ENUM('staff','patient') NOT NULL,
  account_id INT NOT NULL,
  purpose ENUM('staff_login','email_verification','account_recovery') NOT NULL,
  destination VARCHAR(254) NOT NULL,
  otp_hmac CHAR(64) NOT NULL,
  generation INT NOT NULL DEFAULT 1,
  auth_version_snapshot INT NOT NULL DEFAULT 0,
  attempts INT NOT NULL DEFAULT 0,
  expires_at DATETIME NOT NULL,
  resend_after DATETIME NOT NULL,
  consumed_at DATETIME NULL,
  invalidated_at DATETIME NULL,
  send_status ENUM('sending','sent','failed') NOT NULL DEFAULT 'sending',
  provider_message_id VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_auth_email_challenge_token (token_hash),
  KEY idx_auth_email_challenge_account (account_type, account_id, purpose, created_at),
  KEY idx_auth_email_challenge_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS email_send_usage (
  period ENUM('day','month') NOT NULL,
  bucket CHAR(10) NOT NULL,
  sent_count INT NOT NULL DEFAULT 0,
  PRIMARY KEY (period, bucket)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 9. Staff trusted devices (skip OTP on a remembered device)
--    NEW relative to the 18/09/2569 production dump.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staff_trusted_sessions (
  id BIGINT NOT NULL AUTO_INCREMENT,
  account_id INT NOT NULL,
  token_hash CHAR(64) NOT NULL,
  auth_version_snapshot INT NOT NULL DEFAULT 0,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_staff_trusted_session_token (token_hash),
  KEY idx_staff_trusted_session_account (account_id, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 10. Organization ownership for operational lookup tables
-- ---------------------------------------------------------------------
SET @sql := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='staffs' AND COLUMN_NAME='organization_id')=0,
  'ALTER TABLE staffs ADD COLUMN organization_id INT NULL, ADD INDEX idx_staffs_organization (organization_id)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='staffs' AND CONSTRAINT_NAME='fk_staffs_organization')=0,
  'ALTER TABLE staffs ADD CONSTRAINT fk_staffs_organization FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE RESTRICT ON UPDATE RESTRICT', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='service_types' AND COLUMN_NAME='organization_id')=0,
  'ALTER TABLE service_types ADD COLUMN organization_id INT NULL, ADD INDEX idx_service_types_organization (organization_id)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='service_types' AND CONSTRAINT_NAME='fk_service_types_organization')=0,
  'ALTER TABLE service_types ADD CONSTRAINT fk_service_types_organization FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE RESTRICT ON UPDATE RESTRICT', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='case_statuses' AND COLUMN_NAME='organization_id')=0,
  'ALTER TABLE case_statuses ADD COLUMN organization_id INT NULL, ADD INDEX idx_case_statuses_organization (organization_id)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='case_statuses' AND CONSTRAINT_NAME='fk_case_statuses_organization')=0,
  'ALTER TABLE case_statuses ADD CONSTRAINT fk_case_statuses_organization FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE RESTRICT ON UPDATE RESTRICT', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='note_templates' AND COLUMN_NAME='organization_id')=0,
  'ALTER TABLE note_templates ADD COLUMN organization_id INT NULL, ADD INDEX idx_note_templates_organization (organization_id)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='note_templates' AND CONSTRAINT_NAME='fk_note_templates_organization')=0,
  'ALTER TABLE note_templates ADD CONSTRAINT fk_note_templates_organization FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE RESTRICT ON UPDATE RESTRICT', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='dashboard_settings' AND COLUMN_NAME='organization_id')=0,
  'ALTER TABLE dashboard_settings ADD COLUMN organization_id INT NULL, ADD INDEX idx_dashboard_settings_organization (organization_id)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='dashboard_settings' AND CONSTRAINT_NAME='fk_dashboard_settings_organization')=0,
  'ALTER TABLE dashboard_settings ADD CONSTRAINT fk_dashboard_settings_organization FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE RESTRICT ON UPDATE RESTRICT', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE staffs SET organization_id = @suth_org WHERE organization_id IS NULL;
UPDATE service_types SET organization_id = @suth_org WHERE organization_id IS NULL;
UPDATE case_statuses SET organization_id = @suth_org WHERE organization_id IS NULL;
UPDATE note_templates SET organization_id = @suth_org WHERE organization_id IS NULL;
UPDATE dashboard_settings SET organization_id = @suth_org WHERE organization_id IS NULL;

-- clinic_type on these tables may use a different collation from clinics.slug,
-- so both sides are compared under one explicit collation.
UPDATE note_templates nt JOIN clinics c
  ON c.slug COLLATE utf8mb4_unicode_ci = nt.clinic_type COLLATE utf8mb4_unicode_ci
SET nt.organization_id = c.organization_id
WHERE c.organization_id IS NOT NULL AND NOT (nt.organization_id <=> c.organization_id);

UPDATE case_statuses cs JOIN clinics c
  ON c.slug COLLATE utf8mb4_unicode_ci = cs.clinic_type COLLATE utf8mb4_unicode_ci
SET cs.organization_id = c.organization_id
WHERE c.organization_id IS NOT NULL AND cs.clinic_type NOT IN ('all','general')
  AND NOT (cs.organization_id <=> c.organization_id);

-- ---------------------------------------------------------------------
-- 11. Verification report (every "unassigned" value should be 0)
-- ---------------------------------------------------------------------
SELECT 'clinics' table_name, COUNT(*) total, COALESCE(SUM(organization_id IS NULL),0) unassigned FROM clinics
UNION ALL SELECT 'forms', COUNT(*), COALESCE(SUM(organization_id IS NULL),0) FROM forms
UNION ALL SELECT 'mastercases', COUNT(*), COALESCE(SUM(organization_id IS NULL),0) FROM mastercases
UNION ALL SELECT 'form_responses', COUNT(*), COALESCE(SUM(organization_id IS NULL),0) FROM form_responses
UNION ALL SELECT 'staffs', COUNT(*), COALESCE(SUM(organization_id IS NULL),0) FROM staffs
UNION ALL SELECT 'service_types', COUNT(*), COALESCE(SUM(organization_id IS NULL),0) FROM service_types
UNION ALL SELECT 'case_statuses', COUNT(*), COALESCE(SUM(organization_id IS NULL),0) FROM case_statuses
UNION ALL SELECT 'note_templates', COUNT(*), COALESCE(SUM(organization_id IS NULL),0) FROM note_templates
UNION ALL SELECT 'dashboard_settings', COUNT(*), COALESCE(SUM(organization_id IS NULL),0) FROM dashboard_settings;
