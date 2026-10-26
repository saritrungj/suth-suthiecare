-- Work done from the student file. Rerunnable.
-- 1) A guidance record says whether it is general advice, a screening or a
--    follow-up.
-- 2) A screening or follow-up task can be created from the student file before
--    the student has any assessment, so its source response is optional, and it
--    remembers its kind and the guidance record it came from.
-- 3) A school's referral to a hospital waits as a request until someone with
--    the referral_approvals right approves it, only then is the referral sent.
SET @has=(SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='school_guidance_records' AND COLUMN_NAME='record_type');
SET @sql=IF(@has=0,'ALTER TABLE school_guidance_records ADD COLUMN record_type ENUM(''guidance'',''screening'',''follow_up'') NOT NULL DEFAULT ''guidance'' AFTER student_id','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
ALTER TABLE school_rescreen_tasks MODIFY source_response_id INT NULL;
SET @has=(SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='school_rescreen_tasks' AND COLUMN_NAME='task_kind');
SET @sql=IF(@has=0,'ALTER TABLE school_rescreen_tasks ADD COLUMN task_kind ENUM(''rescreen'',''screening'',''follow_up'') NOT NULL DEFAULT ''rescreen'' AFTER student_id, ADD COLUMN guidance_record_id INT NULL AFTER task_kind, ADD CONSTRAINT fk_rescreen_guidance FOREIGN KEY (guidance_record_id) REFERENCES school_guidance_records(id) ON DELETE SET NULL','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
CREATE TABLE IF NOT EXISTS case_referral_requests (
 id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
 source_organization_id INT NOT NULL,
 destination_organization_id INT NOT NULL,
 source_response_id INT NOT NULL,
 reason_encrypted TEXT NOT NULL,
 share_name TINYINT(1) NOT NULL DEFAULT 0,
 share_form TINYINT(1) NOT NULL DEFAULT 0,
 status ENUM('pending','approved','declined','cancelled') NOT NULL DEFAULT 'pending',
 requested_by INT NOT NULL,
 decided_by INT NULL, decided_at DATETIME NULL,
 decision_note_encrypted TEXT NULL,
 referral_id INT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 open_slot TINYINT GENERATED ALWAYS AS (IF(status='pending',1,NULL)) STORED,
 UNIQUE KEY uq_open_referral_request (source_response_id,destination_organization_id,open_slot),
 KEY idx_referral_request_queue (source_organization_id,status,created_at),
 FOREIGN KEY(source_organization_id) REFERENCES organizations(id),
 FOREIGN KEY(destination_organization_id) REFERENCES organizations(id),
 FOREIGN KEY(source_response_id) REFERENCES form_responses(id),
 FOREIGN KEY(requested_by) REFERENCES users(id),
 FOREIGN KEY(decided_by) REFERENCES users(id),
 FOREIGN KEY(referral_id) REFERENCES case_referrals(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
