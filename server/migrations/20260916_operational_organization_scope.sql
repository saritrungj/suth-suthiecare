-- Adds organization ownership to legacy operational lookup tables.
-- Run after 20260901_assign_unassigned_to_suth_hospital.sql.
-- Idempotent (safe to run more than once) using information_schema checks instead of
-- "ADD COLUMN IF NOT EXISTS" / "CREATE INDEX IF NOT EXISTS", which are MariaDB-only
-- syntax that MySQL 8.x rejects with ERROR 1064.
SET @suth_org := (SELECT MIN(id) FROM organizations WHERE name = 'โรงพยาบาลมหาวิทยาลัยเทคโนโลยีสุรนารี');

-- staffs.organization_id
SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='staffs' AND COLUMN_NAME='organization_id');
SET @sql := IF(@has=0, 'ALTER TABLE staffs ADD COLUMN organization_id INT NULL, ADD INDEX idx_staffs_organization (organization_id)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @hasfk := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='staffs' AND CONSTRAINT_NAME='fk_staffs_organization');
SET @sql := IF(@hasfk=0, 'ALTER TABLE staffs ADD CONSTRAINT fk_staffs_organization FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE RESTRICT ON UPDATE RESTRICT', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- service_types.organization_id
SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='service_types' AND COLUMN_NAME='organization_id');
SET @sql := IF(@has=0, 'ALTER TABLE service_types ADD COLUMN organization_id INT NULL, ADD INDEX idx_service_types_organization (organization_id)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @hasfk := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='service_types' AND CONSTRAINT_NAME='fk_service_types_organization');
SET @sql := IF(@hasfk=0, 'ALTER TABLE service_types ADD CONSTRAINT fk_service_types_organization FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE RESTRICT ON UPDATE RESTRICT', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- case_statuses.organization_id
SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='case_statuses' AND COLUMN_NAME='organization_id');
SET @sql := IF(@has=0, 'ALTER TABLE case_statuses ADD COLUMN organization_id INT NULL, ADD INDEX idx_case_statuses_organization (organization_id)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @hasfk := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='case_statuses' AND CONSTRAINT_NAME='fk_case_statuses_organization');
SET @sql := IF(@hasfk=0, 'ALTER TABLE case_statuses ADD CONSTRAINT fk_case_statuses_organization FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE RESTRICT ON UPDATE RESTRICT', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- note_templates.organization_id
SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='note_templates' AND COLUMN_NAME='organization_id');
SET @sql := IF(@has=0, 'ALTER TABLE note_templates ADD COLUMN organization_id INT NULL, ADD INDEX idx_note_templates_organization (organization_id)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @hasfk := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='note_templates' AND CONSTRAINT_NAME='fk_note_templates_organization');
SET @sql := IF(@hasfk=0, 'ALTER TABLE note_templates ADD CONSTRAINT fk_note_templates_organization FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE RESTRICT ON UPDATE RESTRICT', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- dashboard_settings.organization_id
SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='dashboard_settings' AND COLUMN_NAME='organization_id');
SET @sql := IF(@has=0, 'ALTER TABLE dashboard_settings ADD COLUMN organization_id INT NULL, ADD INDEX idx_dashboard_settings_organization (organization_id)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @hasfk := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='dashboard_settings' AND CONSTRAINT_NAME='fk_dashboard_settings_organization');
SET @sql := IF(@hasfk=0, 'ALTER TABLE dashboard_settings ADD CONSTRAINT fk_dashboard_settings_organization FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE RESTRICT ON UPDATE RESTRICT', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE staffs SET organization_id=@suth_org WHERE organization_id IS NULL;
UPDATE service_types SET organization_id=@suth_org WHERE organization_id IS NULL;
UPDATE case_statuses SET organization_id=@suth_org WHERE organization_id IS NULL;
UPDATE note_templates SET organization_id=@suth_org WHERE organization_id IS NULL;
UPDATE dashboard_settings SET organization_id=@suth_org WHERE organization_id IS NULL;

-- Reassign records that can be derived from a clinic before enforcing API scope.
-- Explicit COLLATE: clinics.slug is utf8mb4_unicode_ci while clinic_type on these
-- tables is utf8mb4_general_ci, so the bare join raises ERROR 1267 (illegal mix
-- of collations) without it.
UPDATE note_templates nt JOIN clinics c ON c.slug=nt.clinic_type COLLATE utf8mb4_general_ci
SET nt.organization_id=c.organization_id WHERE c.organization_id IS NOT NULL;
UPDATE case_statuses cs JOIN clinics c ON c.slug=cs.clinic_type COLLATE utf8mb4_general_ci
SET cs.organization_id=c.organization_id WHERE c.organization_id IS NOT NULL AND cs.clinic_type NOT IN ('all','general');

SELECT 'staffs' table_name, COUNT(*) total, SUM(organization_id IS NULL) unassigned FROM staffs
UNION ALL SELECT 'service_types', COUNT(*), SUM(organization_id IS NULL) FROM service_types
UNION ALL SELECT 'case_statuses', COUNT(*), SUM(organization_id IS NULL) FROM case_statuses
UNION ALL SELECT 'note_templates', COUNT(*), SUM(organization_id IS NULL) FROM note_templates
UNION ALL SELECT 'dashboard_settings', COUNT(*), SUM(organization_id IS NULL) FROM dashboard_settings;
