-- Service-recipient type (school student, university student, general).
-- Only the answer side is stored here. The school roster side is read live from
-- school_students, so imports, graduations and archiving apply without hooks.
-- answer_* is the latest status or faculty answer found in the member's cases,
-- declared_* is what the member chose on their own page. Faculty is encrypted.
-- Idempotent and MySQL 8 safe. Comments must not contain semicolons.
CREATE TABLE IF NOT EXISTS patient_member_profiles (
  patient_account_id INT NOT NULL,
  answer_type ENUM('school_student','university_student','general') NULL,
  answer_faculty_encrypted TEXT NULL,
  answer_at DATETIME NULL,
  answer_response_id INT NULL,
  declared_type ENUM('school_student','university_student','general') NULL,
  declared_faculty_encrypted TEXT NULL,
  declared_at DATETIME NULL,
  refreshed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (patient_account_id),
  KEY idx_member_profiles_answer_type (answer_type),
  KEY idx_member_profiles_declared_type (declared_type),
  CONSTRAINT fk_member_profiles_account FOREIGN KEY (patient_account_id) REFERENCES patient_accounts (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
