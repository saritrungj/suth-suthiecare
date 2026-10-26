-- Reverses 20261021_school_care_phase2.sql. Cancelled reports become closed.
SET @has=(SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='school_workflow_settings' AND COLUMN_NAME='care_guidance_json');
SET @sql=IF(@has=1,'ALTER TABLE school_workflow_settings DROP COLUMN care_guidance_json','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @has=(SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='school_behavior_reports');
SET @sql=IF(@has=1,'UPDATE school_behavior_reports SET status=''closed'' WHERE status=''cancelled''','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql=IF(@has=1,'UPDATE school_behavior_updates SET status=''closed'' WHERE status=''cancelled''','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql=IF(@has=1,'ALTER TABLE school_behavior_reports MODIFY status ENUM(''new'',''acknowledged'',''following'',''closed'') NOT NULL DEFAULT ''new''','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql=IF(@has=1,'ALTER TABLE school_behavior_updates MODIFY status ENUM(''new'',''acknowledged'',''following'',''closed'') NOT NULL','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
