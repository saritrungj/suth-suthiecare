-- Reverses 20261024_student_file_actions.sql. Tasks made without a source
-- response are removed first so the column can become NOT NULL again.
DROP TABLE IF EXISTS case_referral_requests;
SET @has=(SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='school_rescreen_tasks' AND COLUMN_NAME='task_kind');
SET @sql=IF(@has=1,'ALTER TABLE school_rescreen_tasks DROP FOREIGN KEY fk_rescreen_guidance, DROP COLUMN guidance_record_id, DROP COLUMN task_kind','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
DELETE FROM school_rescreen_tasks WHERE source_response_id IS NULL;
-- MySQL refuses to change a foreign-key column, so drop its key first.
SET @fk=(SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='school_rescreen_tasks' AND COLUMN_NAME='source_response_id' AND REFERENCED_TABLE_NAME='form_responses' LIMIT 1);
SET @sql=IF(@fk IS NULL,'SELECT 1',CONCAT('ALTER TABLE school_rescreen_tasks DROP FOREIGN KEY ',@fk));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
ALTER TABLE school_rescreen_tasks MODIFY source_response_id INT NOT NULL;
ALTER TABLE school_rescreen_tasks ADD CONSTRAINT fk_rescreen_source_response FOREIGN KEY (source_response_id) REFERENCES form_responses(id);
SET @has=(SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='school_guidance_records' AND COLUMN_NAME='record_type');
SET @sql=IF(@has=1,'ALTER TABLE school_guidance_records DROP COLUMN record_type','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
