-- Reverses 20261020_school_care_extensions.sql. Rows using the new enum
-- values are moved to the closest old value before the enums shrink.
DROP TABLE IF EXISTS school_documents;
DROP TABLE IF EXISTS school_document_categories;
DROP TABLE IF EXISTS school_appointments;
DROP TABLE IF EXISTS school_appointment_slots;
DROP TABLE IF EXISTS school_appointment_topics;
DROP TABLE IF EXISTS school_physical_risk_rules;
DROP TABLE IF EXISTS school_follow_up_items;
DROP TABLE IF EXISTS school_behavior_updates;
DROP TABLE IF EXISTS school_behavior_reports;
DROP TABLE IF EXISTS school_notifications;
DROP TABLE IF EXISTS school_staff_role_grades;
SET @has=(SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='school_workflow_settings' AND COLUMN_NAME='notification_json');
SET @sql=IF(@has=1,'ALTER TABLE school_workflow_settings DROP COLUMN notification_json','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @has=(SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='school_staff_roles' AND COLUMN_NAME='grade_scoped');
SET @sql=IF(@has=1,'ALTER TABLE school_staff_roles DROP COLUMN grade_scoped','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
UPDATE school_classroom_teachers SET role='homeroom' WHERE role='subject';
ALTER TABLE school_classroom_teachers MODIFY role ENUM('homeroom','co_homeroom','counselor') NOT NULL DEFAULT 'homeroom';
UPDATE school_staff_roles SET role_code='other' WHERE role_code='subject_teacher';
ALTER TABLE school_staff_roles MODIFY role_code ENUM('admin','counselor','homeroom','other','mental_admin','physical_admin','dorm_staff','guardian') NOT NULL DEFAULT 'other';
