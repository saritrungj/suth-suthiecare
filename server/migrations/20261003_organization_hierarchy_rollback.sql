-- Rollback for 20261003_organization_hierarchy.sql. Main organizations are
-- kept as rows but become plain hospital organizations without children.

SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='organizations' AND COLUMN_NAME='org_level');
SET @sql := IF(@has=1, 'ALTER TABLE organizations DROP COLUMN org_level', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @hasfk := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='organizations' AND CONSTRAINT_NAME='fk_organizations_parent');
SET @sql := IF(@hasfk=1, 'ALTER TABLE organizations DROP FOREIGN KEY fk_organizations_parent', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='organizations' AND COLUMN_NAME='parent_id');
SET @sql := IF(@has=1, 'ALTER TABLE organizations DROP INDEX idx_organizations_parent, DROP COLUMN parent_id', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='organizations' AND COLUMN_NAME='org_type');
SET @sql := IF(@has=1, 'UPDATE organizations SET org_type=''hospital'' WHERE org_type IS NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := IF(@has=1, 'ALTER TABLE organizations MODIFY COLUMN org_type ENUM(''hospital'',''school'') NOT NULL DEFAULT ''hospital''', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
