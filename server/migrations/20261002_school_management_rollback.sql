-- Rollback for 20261002_school_management.sql. Drops every school table and the
-- added columns. School data is lost, so back up before running this.

DROP TABLE IF EXISTS school_student_physical_records;
DROP TABLE IF EXISTS school_student_health_profiles;
DROP TABLE IF EXISTS school_students;
DROP TABLE IF EXISTS school_classroom_teachers;
DROP TABLE IF EXISTS school_teachers;
DROP TABLE IF EXISTS school_student_types;
DROP TABLE IF EXISTS school_teacher_types;
DROP TABLE IF EXISTS school_classrooms;
DROP TABLE IF EXISTS school_grade_levels;
DROP TABLE IF EXISTS schools;

SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='patient_accounts' AND COLUMN_NAME='must_change_password');
SET @sql := IF(@has=1, 'ALTER TABLE patient_accounts DROP COLUMN must_change_password', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='forms' AND COLUMN_NAME='health_domain');
SET @sql := IF(@has=1, 'ALTER TABLE forms DROP COLUMN health_domain', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='organizations' AND COLUMN_NAME='org_type');
SET @sql := IF(@has=1, 'ALTER TABLE organizations DROP COLUMN org_type', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
