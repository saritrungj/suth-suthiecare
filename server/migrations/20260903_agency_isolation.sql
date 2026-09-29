-- Independent Agency domain. It deliberately has no foreign keys to
-- organizations, clinics, forms, cases, or form responses.
CREATE TABLE IF NOT EXISTS agencies (
  id INT NOT NULL AUTO_INCREMENT,
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_agencies_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS agency_memberships (
  id BIGINT NOT NULL AUTO_INCREMENT,
  agency_id INT NOT NULL,
  user_id INT NOT NULL,
  role ENUM('encoder','verifier') NOT NULL DEFAULT 'encoder',
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_agency_member (agency_id, user_id),
  KEY idx_am_user_status (user_id, status),
  CONSTRAINT fk_am_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
  CONSTRAINT fk_am_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS agency_masters (
  id BIGINT NOT NULL AUTO_INCREMENT,
  agency_id INT NOT NULL,
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  field_schema JSON NOT NULL,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_agency_master_code (agency_id, code),
  KEY idx_agency_master_active (agency_id, status),
  CONSTRAINT fk_agency_master_agency FOREIGN KEY (agency_id) REFERENCES agencies(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS agency_entry_records_v2 (
  id BIGINT NOT NULL AUTO_INCREMENT,
  agency_id INT NOT NULL,
  master_id BIGINT NOT NULL,
  source_record_id VARCHAR(128) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_aer_source (agency_id, master_id, source_record_id),
  KEY idx_aer_agency_master (agency_id, master_id),
  CONSTRAINT fk_aer_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
  CONSTRAINT fk_aer_master FOREIGN KEY (master_id) REFERENCES agency_masters(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS agency_entry_revisions_v2 (
  id BIGINT NOT NULL AUTO_INCREMENT,
  record_id BIGINT NOT NULL,
  entered_by_user_id INT NOT NULL,
  entry_method ENUM('single','import') NOT NULL,
  data JSON NOT NULL,
  verification_status ENUM('pending','verified','rejected') NOT NULL DEFAULT 'pending',
  reviewed_by_user_id INT NULL,
  reviewed_at TIMESTAMP NULL,
  review_note TEXT NULL,
  replaces_revision_id BIGINT NULL,
  superseded_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_aerv_record_current (record_id, superseded_at),
  KEY idx_aerv_status (verification_status, created_at),
  CONSTRAINT fk_aerv_record FOREIGN KEY (record_id) REFERENCES agency_entry_records_v2(id),
  CONSTRAINT fk_aerv_entered_by FOREIGN KEY (entered_by_user_id) REFERENCES users(id),
  CONSTRAINT fk_aerv_reviewed_by FOREIGN KEY (reviewed_by_user_id) REFERENCES users(id),
  CONSTRAINT fk_aerv_replaces FOREIGN KEY (replaces_revision_id) REFERENCES agency_entry_revisions_v2(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
