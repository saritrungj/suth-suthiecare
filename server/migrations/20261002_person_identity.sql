-- One person record per human. Every response and per-clinic master case points
-- at it so a case view can show every assessment of the same person.
-- Stable keys are patient_account_id and identity_hash (HMAC of the 13 digit
-- national ID, digits only). Idempotent and MySQL 8 safe. Comments must not
-- contain semicolons because the Node runner splits statements on them.

CREATE TABLE IF NOT EXISTS persons (
  id INT NOT NULL AUTO_INCREMENT,
  patient_account_id INT NULL,
  identity_hash VARCHAR(64) NULL,
  identity_value_encrypted TEXT NULL,
  first_name_encrypted TEXT NULL,
  last_name_encrypted TEXT NULL,
  merged_into_person_id INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_persons_patient_account (patient_account_id),
  UNIQUE KEY uq_persons_identity_hash (identity_hash),
  KEY idx_persons_merged_into (merged_into_person_id),
  CONSTRAINT fk_persons_patient_account FOREIGN KEY (patient_account_id) REFERENCES patient_accounts (id) ON DELETE SET NULL,
  CONSTRAINT fk_persons_merged_into FOREIGN KEY (merged_into_person_id) REFERENCES persons (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- mastercases.person_id
SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='mastercases' AND COLUMN_NAME='person_id');
SET @sql := IF(@has=0, 'ALTER TABLE mastercases ADD COLUMN person_id INT NULL, ADD INDEX idx_mastercases_person_clinic_status (person_id, clinicType, status)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @hasfk := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='mastercases' AND CONSTRAINT_NAME='fk_mastercases_person');
SET @sql := IF(@hasfk=0, 'ALTER TABLE mastercases ADD CONSTRAINT fk_mastercases_person FOREIGN KEY (person_id) REFERENCES persons (id) ON DELETE SET NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- mastercases.identity_hash had no index
SET @hasidx := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='mastercases' AND INDEX_NAME='idx_mastercases_identity_hash');
SET @sql := IF(@hasidx=0, 'CREATE INDEX idx_mastercases_identity_hash ON mastercases (identity_hash)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- form_responses.person_id
SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='form_responses' AND COLUMN_NAME='person_id');
SET @sql := IF(@has=0, 'ALTER TABLE form_responses ADD COLUMN person_id INT NULL, ADD INDEX idx_form_responses_person (person_id, submitted_at)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @hasfk := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='form_responses' AND CONSTRAINT_NAME='fk_form_responses_person');
SET @sql := IF(@hasfk=0, 'ALTER TABLE form_responses ADD CONSTRAINT fk_form_responses_person FOREIGN KEY (person_id) REFERENCES persons (id) ON DELETE SET NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
