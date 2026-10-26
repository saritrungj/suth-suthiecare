-- Mental-health status per student over time. Rerunnable.
-- 1) Each academic year can carry its two semesters' dates, so every
--    assessment and care step can be filed under the semester it fell in.
-- 2) Care steps teachers record (referred to the counselor, being followed,
--    referred to hospital, closed) are kept as a history, never overwritten,
--    with the class the student was in when the step was taken.
SET @has=(SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='school_academic_years' AND COLUMN_NAME='term1_starts_on');
SET @sql=IF(@has=0,'ALTER TABLE school_academic_years ADD COLUMN term1_starts_on DATE NULL, ADD COLUMN term1_ends_on DATE NULL, ADD COLUMN term2_starts_on DATE NULL, ADD COLUMN term2_ends_on DATE NULL','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
CREATE TABLE IF NOT EXISTS school_student_care_statuses (
 id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
 school_id INT NOT NULL, student_id INT NOT NULL,
 status ENUM('counselor_referral','following','hospital_referral','closed') NOT NULL,
 effective_on DATE NOT NULL,
 academic_year SMALLINT UNSIGNED NULL, semester TINYINT UNSIGNED NULL,
 classroom_id INT NULL,
 payload_encrypted TEXT NULL,
 created_by INT NOT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 KEY idx_care_status_student (student_id,effective_on,id),
 KEY idx_care_status_school (school_id,status,effective_on),
 FOREIGN KEY(school_id) REFERENCES schools(id),
 FOREIGN KEY(student_id) REFERENCES school_students(id),
 FOREIGN KEY(classroom_id) REFERENCES school_classrooms(id) ON DELETE SET NULL,
 FOREIGN KEY(created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
