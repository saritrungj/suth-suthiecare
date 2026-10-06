-- Rollback for 20261002_person_identity.sql. Drops the person links and table.
-- The mastercases identity_hash index is kept because it is harmless and useful.

SET @hasfk := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='form_responses' AND CONSTRAINT_NAME='fk_form_responses_person');
SET @sql := IF(@hasfk=1, 'ALTER TABLE form_responses DROP FOREIGN KEY fk_form_responses_person', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='form_responses' AND COLUMN_NAME='person_id');
SET @sql := IF(@has=1, 'ALTER TABLE form_responses DROP INDEX idx_form_responses_person, DROP COLUMN person_id', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @hasfk := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='mastercases' AND CONSTRAINT_NAME='fk_mastercases_person');
SET @sql := IF(@hasfk=1, 'ALTER TABLE mastercases DROP FOREIGN KEY fk_mastercases_person', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='mastercases' AND COLUMN_NAME='person_id');
SET @sql := IF(@has=1, 'ALTER TABLE mastercases DROP INDEX idx_mastercases_person_clinic_status, DROP COLUMN person_id', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

DROP TABLE IF EXISTS persons;
