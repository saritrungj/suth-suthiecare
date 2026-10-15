-- Guardian access is explicit per student, never inferred from contact details.
INSERT INTO roles (name,description) SELECT 'school_guardian','Guardian account without organization-wide permissions' WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name='school_guardian');
ALTER TABLE school_staff_roles MODIFY role_code ENUM('admin','counselor','homeroom','other','mental_admin','physical_admin','dorm_staff','guardian') NOT NULL DEFAULT 'other';
CREATE TABLE IF NOT EXISTS school_student_guardians (
 student_id INT NOT NULL, user_id INT NOT NULL,
 status ENUM('active','inactive') NOT NULL DEFAULT 'active', updated_by INT NOT NULL,
 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 PRIMARY KEY(student_id,user_id), KEY idx_guardian_user(user_id,status),
 FOREIGN KEY(student_id) REFERENCES school_students(id) ON DELETE CASCADE,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
