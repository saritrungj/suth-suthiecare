CREATE TABLE IF NOT EXISTS school_academic_years (
  school_id INT NOT NULL,
  academic_year SMALLINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (school_id, academic_year),
  CONSTRAINT fk_academic_year_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
);
INSERT IGNORE INTO school_academic_years (school_id, academic_year)
SELECT DISTINCT school_id, academic_year FROM school_classrooms;
