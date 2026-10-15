-- School screening and enrollment workflows. Rerunnable, no clinical defaults.
ALTER TABLE school_staff_roles MODIFY role_code ENUM('admin','counselor','homeroom','other','mental_admin','physical_admin','dorm_staff','guardian') NOT NULL DEFAULT 'other';
INSERT INTO roles (name,description) SELECT 'school_import_staff','School staff without global permissions' WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name='school_import_staff');
SET @has=(SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='school_students' AND COLUMN_NAME='is_boarder');
SET @sql=IF(@has=0,'ALTER TABLE school_students ADD COLUMN is_boarder TINYINT(1) NOT NULL DEFAULT 0, ADD COLUMN graduated_on DATE NULL, ADD COLUMN archived_at DATETIME NULL','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
CREATE TABLE IF NOT EXISTS school_enrollment_history (
 id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, student_id INT NOT NULL,
 from_classroom_id INT NULL, to_classroom_id INT NULL, changed_by INT NOT NULL,
 changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 KEY idx_enrollment_student (student_id,changed_at),
 FOREIGN KEY(student_id) REFERENCES school_students(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS school_screening_rounds (
 id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, school_id INT NOT NULL,
 name VARCHAR(180) NOT NULL, academic_year SMALLINT NOT NULL, semester TINYINT NOT NULL,
 health_domain ENUM('mental','physical') NOT NULL, form_id INT NOT NULL,
 starts_on DATE NOT NULL, ends_on DATE NOT NULL,
 status ENUM('active','closed') NOT NULL DEFAULT 'active', created_by INT NOT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(school_id) REFERENCES schools(id), FOREIGN KEY(form_id) REFERENCES forms(id),
 KEY idx_round_school (school_id,academic_year,semester)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS school_rescreen_tasks (
 id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, student_id INT NOT NULL,
 source_response_id INT NOT NULL, target_form_id INT NOT NULL,
 assigned_user_id INT NOT NULL, due_on DATE NOT NULL,
 status ENUM('pending','completed','cancelled') NOT NULL DEFAULT 'pending',
 completed_response_id INT NULL, created_by INT NOT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, completed_at DATETIME NULL,
 FOREIGN KEY(student_id) REFERENCES school_students(id),
 FOREIGN KEY(source_response_id) REFERENCES form_responses(id),
 FOREIGN KEY(target_form_id) REFERENCES forms(id), FOREIGN KEY(assigned_user_id) REFERENCES users(id),
 FOREIGN KEY(completed_response_id) REFERENCES form_responses(id),
 KEY idx_rescreen_student (student_id,status,due_on)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS school_risk_triggers (
 id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, school_id INT NOT NULL, form_id INT NOT NULL,
 question_id VARCHAR(120) NOT NULL, answer_path VARCHAR(100) NOT NULL DEFAULT '', answer_value VARCHAR(500) NOT NULL,
 enabled TINYINT(1) NOT NULL DEFAULT 1, approved_by INT NOT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(school_id) REFERENCES schools(id), FOREIGN KEY(form_id) REFERENCES forms(id),
 KEY idx_trigger_form (form_id,enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS school_workflow_settings (
 school_id INT NOT NULL PRIMARY KEY, care_advice_json JSON NULL,
 retention_years SMALLINT NULL, retention_approved_by INT NULL,
 retention_approved_at DATETIME NULL, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 FOREIGN KEY(school_id) REFERENCES schools(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
