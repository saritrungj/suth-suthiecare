-- Shared base for school care work (behavior reports, notifications,
-- appointments, physical risk follow-up, documents). Rerunnable, no clinical
-- defaults: physical risk rules, appointment topics and document categories
-- are created by each school.
ALTER TABLE school_staff_roles MODIFY role_code ENUM('admin','counselor','homeroom','other','mental_admin','physical_admin','dorm_staff','guardian','subject_teacher') NOT NULL DEFAULT 'other';
ALTER TABLE school_classroom_teachers MODIFY role ENUM('homeroom','co_homeroom','counselor','subject') NOT NULL DEFAULT 'homeroom';
-- A grade-scoped counselor sees only the grades listed in
-- school_staff_role_grades, and with none left they see no students.
-- (No semicolons in comments: the runner splits statements on them.)
SET @has=(SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='school_staff_roles' AND COLUMN_NAME='grade_scoped');
SET @sql=IF(@has=0,'ALTER TABLE school_staff_roles ADD COLUMN grade_scoped TINYINT(1) NOT NULL DEFAULT 0','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @has=(SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='school_workflow_settings' AND COLUMN_NAME='notification_json');
SET @sql=IF(@has=0,'ALTER TABLE school_workflow_settings ADD COLUMN notification_json JSON NULL','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
CREATE TABLE IF NOT EXISTS school_staff_role_grades (
 school_id INT NOT NULL, user_id INT NOT NULL, grade_level_id INT NOT NULL,
 created_by INT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(school_id,user_id,grade_level_id),
 KEY idx_role_grades_grade (grade_level_id),
 FOREIGN KEY(school_id) REFERENCES schools(id), FOREIGN KEY(user_id) REFERENCES users(id),
 FOREIGN KEY(grade_level_id) REFERENCES school_grade_levels(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS school_notifications (
 id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, school_id INT NOT NULL,
 recipient_user_id INT NOT NULL, student_id INT NULL, kind VARCHAR(40) NOT NULL,
 source_type VARCHAR(40) NULL, source_id INT NULL, payload_encrypted TEXT NULL,
 dedupe_key VARCHAR(120) NOT NULL, read_at DATETIME NULL, acknowledged_at DATETIME NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY uq_notification_dedupe (recipient_user_id,dedupe_key),
 KEY idx_notification_inbox (recipient_user_id,read_at,created_at),
 FOREIGN KEY(school_id) REFERENCES schools(id), FOREIGN KEY(recipient_user_id) REFERENCES users(id),
 FOREIGN KEY(student_id) REFERENCES school_students(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS school_behavior_reports (
 id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, school_id INT NOT NULL, student_id INT NOT NULL,
 classroom_id INT NULL, reported_by INT NOT NULL, category VARCHAR(40) NOT NULL,
 concern_level ENUM('low','medium','high') NOT NULL DEFAULT 'low', observed_on DATE NOT NULL,
 payload_encrypted TEXT NULL,
 status ENUM('new','acknowledged','following','closed') NOT NULL DEFAULT 'new',
 assigned_to INT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 KEY idx_behavior_student (student_id,observed_on), KEY idx_behavior_status (school_id,status),
 FOREIGN KEY(school_id) REFERENCES schools(id), FOREIGN KEY(student_id) REFERENCES school_students(id),
 FOREIGN KEY(reported_by) REFERENCES users(id), FOREIGN KEY(assigned_to) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS school_behavior_updates (
 id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, report_id INT NOT NULL,
 status ENUM('new','acknowledged','following','closed') NOT NULL,
 payload_encrypted TEXT NULL, created_by INT NOT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 KEY idx_behavior_update_report (report_id,created_at),
 FOREIGN KEY(report_id) REFERENCES school_behavior_reports(id) ON DELETE CASCADE,
 FOREIGN KEY(created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS school_follow_up_items (
 id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, school_id INT NOT NULL, student_id INT NOT NULL,
 domain ENUM('physical','behavior','mental') NOT NULL, source_type VARCHAR(40) NOT NULL,
 source_id INT NULL, assigned_to INT NULL, due_on DATE NULL,
 status ENUM('open','in_progress','done','cancelled') NOT NULL DEFAULT 'open',
 payload_encrypted TEXT NULL, created_by INT NULL, closed_at DATETIME NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 KEY idx_follow_up_student (student_id,status), KEY idx_follow_up_school (school_id,domain,status,due_on),
 FOREIGN KEY(school_id) REFERENCES schools(id), FOREIGN KEY(student_id) REFERENCES school_students(id),
 FOREIGN KEY(assigned_to) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS school_physical_risk_rules (
 id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, school_id INT NOT NULL,
 metric VARCHAR(40) NOT NULL, comparator ENUM('lt','lte','gt','gte','outside') NOT NULL,
 threshold_low DECIMAL(8,2) NULL, threshold_high DECIMAL(8,2) NULL,
 age_min TINYINT UNSIGNED NULL, age_max TINYINT UNSIGNED NULL, sex ENUM('male','female') NULL,
 label VARCHAR(160) NOT NULL, follow_up_days SMALLINT UNSIGNED NULL,
 status ENUM('active','inactive') NOT NULL DEFAULT 'active', created_by INT NOT NULL,
 approved_by INT NULL, approved_at DATETIME NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 KEY idx_physical_rule_school (school_id,metric,status),
 FOREIGN KEY(school_id) REFERENCES schools(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS school_appointment_topics (
 id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, school_id INT NOT NULL,
 label VARCHAR(120) NOT NULL, sort_order SMALLINT NOT NULL DEFAULT 0,
 status ENUM('active','inactive') NOT NULL DEFAULT 'active',
 KEY idx_appointment_topic_school (school_id,status,sort_order),
 FOREIGN KEY(school_id) REFERENCES schools(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS school_appointment_slots (
 id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, school_id INT NOT NULL, staff_user_id INT NOT NULL,
 starts_at DATETIME NOT NULL, ends_at DATETIME NOT NULL, capacity TINYINT UNSIGNED NOT NULL DEFAULT 1,
 status ENUM('open','closed') NOT NULL DEFAULT 'open',
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 KEY idx_appointment_slot_staff (staff_user_id,starts_at), KEY idx_appointment_slot_school (school_id,starts_at),
 FOREIGN KEY(school_id) REFERENCES schools(id), FOREIGN KEY(staff_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS school_appointments (
 id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, school_id INT NOT NULL, student_id INT NOT NULL,
 staff_user_id INT NOT NULL, slot_id INT NULL, topic_id INT NULL, payload_encrypted TEXT NULL,
 status ENUM('requested','confirmed','rescheduled','cancelled','completed','no_show') NOT NULL DEFAULT 'requested',
 requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, confirmed_at DATETIME NULL,
 cancelled_by INT NULL, guidance_record_id INT NULL, referral_id INT NULL,
 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 KEY idx_appointment_student (student_id,status), KEY idx_appointment_staff (staff_user_id,status),
 FOREIGN KEY(school_id) REFERENCES schools(id), FOREIGN KEY(student_id) REFERENCES school_students(id),
 FOREIGN KEY(staff_user_id) REFERENCES users(id),
 FOREIGN KEY(slot_id) REFERENCES school_appointment_slots(id) ON DELETE SET NULL,
 FOREIGN KEY(topic_id) REFERENCES school_appointment_topics(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS school_document_categories (
 id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, school_id INT NOT NULL,
 name VARCHAR(120) NOT NULL, sort_order SMALLINT NOT NULL DEFAULT 0,
 status ENUM('active','inactive') NOT NULL DEFAULT 'active',
 KEY idx_document_category_school (school_id,status,sort_order),
 FOREIGN KEY(school_id) REFERENCES schools(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS school_documents (
 id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, school_id INT NOT NULL, category_id INT NULL,
 title VARCHAR(200) NOT NULL, description TEXT NULL, kind ENUM('file','link') NOT NULL,
 storage_key VARCHAR(255) NULL, url VARCHAR(1000) NULL, mime VARCHAR(120) NULL,
 size_bytes INT UNSIGNED NULL, audience JSON NULL,
 status ENUM('active','hidden') NOT NULL DEFAULT 'active',
 uploaded_by INT NOT NULL, updated_by INT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 KEY idx_document_school (school_id,status,category_id),
 FOREIGN KEY(school_id) REFERENCES schools(id),
 FOREIGN KEY(category_id) REFERENCES school_document_categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
