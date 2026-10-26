-- Phase 2 of school care: a cancelled state for behaviour reports and the
-- step-by-step teacher guidance per risk level. Rerunnable.
ALTER TABLE school_behavior_reports MODIFY status ENUM('new','acknowledged','following','closed','cancelled') NOT NULL DEFAULT 'new';
ALTER TABLE school_behavior_updates MODIFY status ENUM('new','acknowledged','following','closed','cancelled') NOT NULL;
SET @has=(SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='school_workflow_settings' AND COLUMN_NAME='care_guidance_json');
SET @sql=IF(@has=0,'ALTER TABLE school_workflow_settings ADD COLUMN care_guidance_json JSON NULL','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
