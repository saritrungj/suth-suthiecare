-- Reverses 20261023_student_mental_status.sql.
DROP TABLE IF EXISTS school_student_care_statuses;
SET @has=(SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='school_academic_years' AND COLUMN_NAME='term1_starts_on');
SET @sql=IF(@has=1,'ALTER TABLE school_academic_years DROP COLUMN term1_starts_on, DROP COLUMN term1_ends_on, DROP COLUMN term2_starts_on, DROP COLUMN term2_ends_on','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
