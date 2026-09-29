-- Multi-organization authorization (MySQL 8+). Run after taking a database backup.
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
INSERT IGNORE INTO user_system_roles (user_id, system_role_id) SELECT id, 1 FROM users WHERE role_id = 1;

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

ALTER TABLE mastercases ADD COLUMN organization_id INT NULL, ADD KEY idx_mastercases_organization (organization_id), ADD CONSTRAINT fk_mastercases_organization FOREIGN KEY (organization_id) REFERENCES organizations(id);
ALTER TABLE form_responses ADD COLUMN organization_id INT NULL, ADD KEY idx_form_responses_organization (organization_id), ADD CONSTRAINT fk_form_responses_organization FOREIGN KEY (organization_id) REFERENCES organizations(id);
ALTER TABLE clinics ADD COLUMN organization_id INT NULL, ADD KEY idx_clinics_organization (organization_id), ADD CONSTRAINT fk_clinics_organization FOREIGN KEY (organization_id) REFERENCES organizations(id);
ALTER TABLE forms ADD COLUMN organization_id INT NULL, ADD KEY idx_forms_organization (organization_id), ADD CONSTRAINT fk_forms_organization FOREIGN KEY (organization_id) REFERENCES organizations(id);

-- Seed role permissions from the legacy matrix. The application also includes a
-- compatibility fallback until the old permissions table is removed.
INSERT IGNORE INTO role_permissions (role_id, permission_key)
SELECT role_id, 'dashboard.view' FROM permissions WHERE module IN ('Dashboard') AND (can_view OR can_manage OR can_full);
INSERT IGNORE INTO role_permissions (role_id, permission_key)
SELECT role_id, 'cases.view' FROM permissions WHERE module IN ('Case Management','จัดการเคส') AND (can_view OR can_manage OR can_full);
INSERT IGNORE INTO role_permissions (role_id, permission_key)
SELECT p.role_id, k.permission_key FROM permissions p CROSS JOIN (SELECT 'cases.create' permission_key UNION ALL SELECT 'cases.update' UNION ALL SELECT 'cases.delete' UNION ALL SELECT 'cases.assign' UNION ALL SELECT 'cases.export') k WHERE p.module IN ('Case Management','จัดการเคส') AND (p.can_manage OR p.can_full);
INSERT IGNORE INTO role_permissions (role_id, permission_key)
SELECT role_id, 'appointments.view' FROM permissions WHERE module IN ('Appointments','ตารางนัดหมาย') AND (can_view OR can_manage OR can_full);
INSERT IGNORE INTO role_permissions (role_id, permission_key)
SELECT p.role_id, k.permission_key FROM permissions p CROSS JOIN (SELECT 'appointments.create' permission_key UNION ALL SELECT 'appointments.update' UNION ALL SELECT 'appointments.delete') k WHERE p.module IN ('Appointments','ตารางนัดหมาย') AND (p.can_manage OR p.can_full);
INSERT IGNORE INTO role_permissions (role_id, permission_key)
SELECT role_id, 'patient_members.view' FROM permissions WHERE module IN ('User Management','จัดการผู้ใช้ (Users)','จัดการผู้ใช้') AND (can_view OR can_manage OR can_full);
INSERT IGNORE INTO role_permissions (role_id, permission_key)
SELECT role_id, k.permission_key FROM permissions p CROSS JOIN (SELECT 'patient_members.update' permission_key UNION ALL SELECT 'patient_members.delete') k WHERE p.module IN ('User Management','จัดการผู้ใช้ (Users)','จัดการผู้ใช้') AND (p.can_manage OR p.can_full);
INSERT IGNORE INTO role_permissions (role_id, permission_key)
SELECT role_id, 'forms.view' FROM permissions WHERE module IN ('Form Management','จัดการฟอร์ม') AND (can_view OR can_manage OR can_full);
INSERT IGNORE INTO role_permissions (role_id, permission_key)
SELECT p.role_id, k.permission_key FROM permissions p CROSS JOIN (SELECT 'forms.create' permission_key UNION ALL SELECT 'forms.update' UNION ALL SELECT 'forms.delete') k WHERE p.module IN ('Form Management','จัดการฟอร์ม') AND (p.can_manage OR p.can_full);
INSERT IGNORE INTO role_permissions (role_id, permission_key)
SELECT role_id, 'clinics.view' FROM permissions WHERE module='Clinic Management' AND (can_view OR can_manage OR can_full);
INSERT IGNORE INTO role_permissions (role_id, permission_key)
SELECT p.role_id, k.permission_key FROM permissions p CROSS JOIN (SELECT 'clinics.create' permission_key UNION ALL SELECT 'clinics.update' UNION ALL SELECT 'clinics.delete') k WHERE p.module='Clinic Management' AND (p.can_manage OR p.can_full);
INSERT IGNORE INTO role_permissions (role_id, permission_key)
SELECT role_id, 'help_center.view' FROM permissions WHERE module='Help Center Management' AND (can_view OR can_manage OR can_full);
INSERT IGNORE INTO role_permissions (role_id, permission_key)
SELECT p.role_id, k.permission_key FROM permissions p CROSS JOIN (SELECT 'help_center.create' permission_key UNION ALL SELECT 'help_center.update' UNION ALL SELECT 'help_center.delete') k WHERE p.module='Help Center Management' AND (p.can_manage OR p.can_full);
INSERT IGNORE INTO role_permissions (role_id, permission_key)
SELECT role_id, 'content.view' FROM permissions WHERE module='Content Management' AND (can_view OR can_manage OR can_full);
INSERT IGNORE INTO role_permissions (role_id, permission_key)
SELECT p.role_id, k.permission_key FROM permissions p CROSS JOIN (SELECT 'content.create' permission_key UNION ALL SELECT 'content.update' UNION ALL SELECT 'content.delete') k WHERE p.module='Content Management' AND (p.can_manage OR p.can_full);
