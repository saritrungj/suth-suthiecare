-- Shared referral workflow between two operational organizations.
-- Only the deliberately shared summary is stored here, never form answers.
CREATE TABLE IF NOT EXISTS case_referrals (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  source_organization_id INT NOT NULL,
  destination_organization_id INT NOT NULL,
  source_response_id INT NOT NULL,
  source_master_case_id INT NULL,
  display_name_encrypted TEXT NULL,
  form_title VARCHAR(255) NULL,
  reason_encrypted TEXT NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'pending',
  version INT UNSIGNED NOT NULL DEFAULT 1,
  created_by INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  source_case_key VARCHAR(64) GENERATED ALWAYS AS
    (CONCAT(IF(source_master_case_id IS NULL, 'response:', 'master:'), COALESCE(source_master_case_id, source_response_id))) STORED,
  active_slot TINYINT GENERATED ALWAYS AS
    (IF(status IN ('pending', 'accepted', 'in_progress'), 1, NULL)) STORED,
  UNIQUE KEY uq_active_case_referral (source_organization_id, source_case_key, destination_organization_id, active_slot),
  KEY idx_referral_inbox (destination_organization_id, status, updated_at),
  KEY idx_referral_outbox (source_organization_id, status, updated_at),
  CONSTRAINT fk_referral_source_org FOREIGN KEY (source_organization_id) REFERENCES organizations(id) ON DELETE RESTRICT,
  CONSTRAINT fk_referral_destination_org FOREIGN KEY (destination_organization_id) REFERENCES organizations(id) ON DELETE RESTRICT,
  CONSTRAINT fk_referral_response FOREIGN KEY (source_response_id) REFERENCES form_responses(id) ON DELETE RESTRICT,
  CONSTRAINT fk_referral_master_case FOREIGN KEY (source_master_case_id) REFERENCES mastercases(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS case_referral_updates (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  referral_id INT NOT NULL,
  organization_id INT NOT NULL,
  actor_name_encrypted TEXT NULL,
  kind VARCHAR(16) NOT NULL,
  status VARCHAR(24) NULL,
  summary_encrypted TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_referral_update_history (referral_id, id),
  CONSTRAINT fk_referral_update_referral FOREIGN KEY (referral_id) REFERENCES case_referrals(id) ON DELETE CASCADE,
  CONSTRAINT fk_referral_update_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
