-- Back-office customization of the assessment result page.
-- Extra pictures an organization uploads so each scoring range of a form can
-- show its own image (forms reference them as "asset:<id>").
CREATE TABLE IF NOT EXISTS organization_result_image_assets (
  id INT NOT NULL AUTO_INCREMENT,
  organization_id INT NOT NULL,
  image MEDIUMTEXT NOT NULL,
  filename VARCHAR(255) NULL,
  updated_by INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_result_image_assets_organization (organization_id),
  CONSTRAINT fk_result_image_assets_organization FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Wording of the result page per organization. Missing keys use the app text.
CREATE TABLE IF NOT EXISTS organization_result_page_settings (
  organization_id INT NOT NULL,
  texts JSON NOT NULL,
  updated_by INT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (organization_id),
  CONSTRAINT fk_result_page_settings_organization FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
