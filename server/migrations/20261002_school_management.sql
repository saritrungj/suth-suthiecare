-- School organizations. An organization is the root of a hierarchy: a hospital
-- has clinics, a school organization has schools. Schools hold grade levels,
-- classrooms, teachers (linked to staff users) and students (linked to patient
-- accounts and to their person record). Idempotent and MySQL 8 safe. Comments
-- must not contain semicolons because the Node runner splits on them.

-- organizations.org_type
SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='organizations' AND COLUMN_NAME='org_type');
SET @sql := IF(@has=0, 'ALTER TABLE organizations ADD COLUMN org_type ENUM(''hospital'',''school'') NOT NULL DEFAULT ''hospital'' AFTER name', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- forms.health_domain tags an assessment as mental or physical health
SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='forms' AND COLUMN_NAME='health_domain');
SET @sql := IF(@has=0, 'ALTER TABLE forms ADD COLUMN health_domain ENUM(''mental'',''physical'',''general'') NULL DEFAULT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- patient_accounts.must_change_password for imported student accounts
SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='patient_accounts' AND COLUMN_NAME='must_change_password');
SET @sql := IF(@has=0, 'ALTER TABLE patient_accounts ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS schools (
  id INT NOT NULL AUTO_INCREMENT,
  organization_id INT NOT NULL,
  code VARCHAR(32) NOT NULL,
  name VARCHAR(255) NOT NULL,
  address TEXT NULL,
  phone VARCHAR(32) NULL,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_schools_code (code),
  KEY idx_schools_organization (organization_id, status),
  CONSTRAINT fk_schools_organization FOREIGN KEY (organization_id) REFERENCES organizations (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS school_grade_levels (
  id INT NOT NULL AUTO_INCREMENT,
  school_id INT NOT NULL,
  name VARCHAR(50) NOT NULL,
  level_order INT NOT NULL DEFAULT 0,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_grade_levels_school_name (school_id, name),
  CONSTRAINT fk_grade_levels_school FOREIGN KEY (school_id) REFERENCES schools (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS school_classrooms (
  id INT NOT NULL AUTO_INCREMENT,
  school_id INT NOT NULL,
  grade_level_id INT NOT NULL,
  name VARCHAR(50) NOT NULL,
  academic_year SMALLINT NOT NULL,
  capacity INT NULL,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_classrooms_grade_name_year (grade_level_id, name, academic_year),
  KEY idx_classrooms_school (school_id, academic_year),
  CONSTRAINT fk_classrooms_school FOREIGN KEY (school_id) REFERENCES schools (id),
  CONSTRAINT fk_classrooms_grade FOREIGN KEY (grade_level_id) REFERENCES school_grade_levels (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS school_teacher_types (
  id INT NOT NULL AUTO_INCREMENT,
  organization_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(255) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_teacher_types_org_name (organization_id, name),
  CONSTRAINT fk_teacher_types_organization FOREIGN KEY (organization_id) REFERENCES organizations (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS school_student_types (
  id INT NOT NULL AUTO_INCREMENT,
  organization_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(255) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_student_types_org_name (organization_id, name),
  CONSTRAINT fk_student_types_organization FOREIGN KEY (organization_id) REFERENCES organizations (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS school_teachers (
  id INT NOT NULL AUTO_INCREMENT,
  school_id INT NOT NULL,
  user_id INT NOT NULL,
  teacher_type_id INT NULL,
  employee_code VARCHAR(50) NULL,
  position VARCHAR(100) NULL,
  phone_encrypted TEXT NULL,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_teachers_school_user (school_id, user_id),
  KEY idx_teachers_user (user_id, status),
  CONSTRAINT fk_teachers_school FOREIGN KEY (school_id) REFERENCES schools (id),
  CONSTRAINT fk_teachers_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_teachers_type FOREIGN KEY (teacher_type_id) REFERENCES school_teacher_types (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS school_classroom_teachers (
  classroom_id INT NOT NULL,
  teacher_id INT NOT NULL,
  role ENUM('homeroom','co_homeroom','counselor') NOT NULL DEFAULT 'homeroom',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (classroom_id, teacher_id),
  KEY idx_classroom_teachers_teacher (teacher_id),
  CONSTRAINT fk_classroom_teachers_classroom FOREIGN KEY (classroom_id) REFERENCES school_classrooms (id) ON DELETE CASCADE,
  CONSTRAINT fk_classroom_teachers_teacher FOREIGN KEY (teacher_id) REFERENCES school_teachers (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS school_students (
  id INT NOT NULL AUTO_INCREMENT,
  school_id INT NOT NULL,
  classroom_id INT NULL,
  student_type_id INT NULL,
  student_code VARCHAR(32) NOT NULL,
  prefix VARCHAR(30) NULL,
  first_name_encrypted TEXT NULL,
  last_name_encrypted TEXT NULL,
  nickname_encrypted TEXT NULL,
  gender ENUM('male','female','other') NULL,
  birth_date_encrypted TEXT NULL,
  person_id INT NULL,
  patient_account_id INT NULL,
  status ENUM('active','graduated','transferred','inactive') NOT NULL DEFAULT 'active',
  created_by INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_students_school_code (school_id, student_code),
  UNIQUE KEY uq_students_patient_account (patient_account_id),
  KEY idx_students_classroom (classroom_id, status),
  KEY idx_students_person (person_id),
  CONSTRAINT fk_students_school FOREIGN KEY (school_id) REFERENCES schools (id),
  CONSTRAINT fk_students_classroom FOREIGN KEY (classroom_id) REFERENCES school_classrooms (id) ON DELETE SET NULL,
  CONSTRAINT fk_students_type FOREIGN KEY (student_type_id) REFERENCES school_student_types (id),
  CONSTRAINT fk_students_person FOREIGN KEY (person_id) REFERENCES persons (id) ON DELETE SET NULL,
  CONSTRAINT fk_students_patient_account FOREIGN KEY (patient_account_id) REFERENCES patient_accounts (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS school_student_health_profiles (
  student_id INT NOT NULL,
  blood_type ENUM('A','B','AB','O','unknown') NOT NULL DEFAULT 'unknown',
  chronic_conditions_encrypted TEXT NULL,
  allergies_encrypted TEXT NULL,
  medications_encrypted TEXT NULL,
  emergency_contact_name_encrypted TEXT NULL,
  emergency_contact_phone_encrypted TEXT NULL,
  notes_encrypted TEXT NULL,
  updated_by INT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (student_id),
  CONSTRAINT fk_health_profiles_student FOREIGN KEY (student_id) REFERENCES school_students (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS school_student_physical_records (
  id INT NOT NULL AUTO_INCREMENT,
  student_id INT NOT NULL,
  measured_at DATE NOT NULL,
  weight_kg DECIMAL(5,2) NULL,
  height_cm DECIMAL(5,1) NULL,
  bmi DECIMAL(4,1) NULL,
  systolic SMALLINT NULL,
  diastolic SMALLINT NULL,
  pulse SMALLINT NULL,
  vision_left VARCHAR(10) NULL,
  vision_right VARCHAR(10) NULL,
  hearing_left ENUM('normal','abnormal','not_tested') NOT NULL DEFAULT 'not_tested',
  hearing_right ENUM('normal','abnormal','not_tested') NOT NULL DEFAULT 'not_tested',
  note_encrypted TEXT NULL,
  recorded_by INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_physical_records_student (student_id, measured_at),
  CONSTRAINT fk_physical_records_student FOREIGN KEY (student_id) REFERENCES school_students (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
