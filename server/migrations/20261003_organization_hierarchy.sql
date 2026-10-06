-- Organization hierarchy. A main organization (org_level main) groups
-- sub-units and decides their type: hospital (sub-units hold clinics) or
-- school (sub-units hold schools). A sub-unit (org_level unit, parent_id = its
-- main organization) carries a copy of that type and owns members and data.
-- Existing organizations stay sub-units without a parent until an
-- administrator places them under a main organization. Idempotent and MySQL 8
-- safe. Comments must not contain semicolons.

SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='organizations' AND COLUMN_NAME='parent_id');
SET @sql := IF(@has=0, 'ALTER TABLE organizations ADD COLUMN parent_id INT NULL AFTER id, ADD INDEX idx_organizations_parent (parent_id)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @hasfk := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='organizations' AND CONSTRAINT_NAME='fk_organizations_parent');
SET @sql := IF(@hasfk=0, 'ALTER TABLE organizations ADD CONSTRAINT fk_organizations_parent FOREIGN KEY (parent_id) REFERENCES organizations (id) ON DELETE RESTRICT', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- A new main organization may not have chosen its type yet, so org_type is nullable.
SET @nullable := (SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='organizations' AND COLUMN_NAME='org_type');
SET @sql := IF(@nullable='NO', 'ALTER TABLE organizations MODIFY COLUMN org_type ENUM(''hospital'',''school'') NULL DEFAULT ''hospital''', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- org_level tells a main organization (groups sub-units and gives them its
-- type) from a sub-unit. Rows that were created as main organizations before
-- this column existed have no type and no parent.
SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='organizations' AND COLUMN_NAME='org_level');
SET @sql := IF(@has=0, 'ALTER TABLE organizations ADD COLUMN org_level ENUM(''main'',''unit'') NOT NULL DEFAULT ''unit'' AFTER parent_id', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := IF(@has=0, 'UPDATE organizations o LEFT JOIN (SELECT DISTINCT parent_id FROM organizations WHERE parent_id IS NOT NULL) c ON c.parent_id = o.id SET o.org_level = ''main'' WHERE o.parent_id IS NULL AND (o.org_type IS NULL OR c.parent_id IS NOT NULL)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
