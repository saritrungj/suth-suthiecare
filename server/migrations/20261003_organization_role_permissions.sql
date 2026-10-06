CREATE TABLE IF NOT EXISTS organization_role_permission_sets (
  organization_id INT NOT NULL,
  role_id INT NOT NULL,
  source VARCHAR(32) NOT NULL DEFAULT 'explicit',
  version INT NOT NULL DEFAULT 1,
  updated_by INT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (organization_id, role_id)
);

CREATE TABLE IF NOT EXISTS organization_role_permissions (
  organization_id INT NOT NULL,
  role_id INT NOT NULL,
  permission_key VARCHAR(100) NOT NULL,
  PRIMARY KEY (organization_id, role_id, permission_key)
);
