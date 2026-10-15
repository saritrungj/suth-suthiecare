-- Preserve historical enrollment codes and add the five current choices.
ALTER TABLE school_students MODIFY status ENUM('active','graduated','on_leave','withdrawn','waived','transferred','inactive') NOT NULL DEFAULT 'active';
CREATE TABLE IF NOT EXISTS school_staff_roles (
 school_id INT NOT NULL, user_id INT NOT NULL,
 role_code ENUM('admin','counselor','homeroom','other') NOT NULL DEFAULT 'other',
 status ENUM('active','inactive') NOT NULL DEFAULT 'active',
 updated_by INT NULL, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 PRIMARY KEY(school_id,user_id),
 FOREIGN KEY(school_id) REFERENCES schools(id), FOREIGN KEY(user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS school_student_insights (
 student_id INT NOT NULL PRIMARY KEY, payload_encrypted TEXT NOT NULL,
 updated_by INT NULL, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 FOREIGN KEY(student_id) REFERENCES school_students(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS school_guidance_records (
 id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, student_id INT NOT NULL,
 recorded_at DATE NOT NULL, follow_up_at DATE NULL, payload_encrypted TEXT NOT NULL,
 recorded_by INT NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(student_id) REFERENCES school_students(id), KEY(student_id,recorded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS master_data_options (
 id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, organization_id INT NOT NULL,
 category VARCHAR(64) NOT NULL, code VARCHAR(64) NOT NULL, label VARCHAR(255) NOT NULL,
 sort_order INT NOT NULL DEFAULT 0, is_active TINYINT NOT NULL DEFAULT 1,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 UNIQUE KEY(organization_id,category,code), FOREIGN KEY(organization_id) REFERENCES organizations(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @has=(SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='service_types' AND COLUMN_NAME='sort_order');
SET @sql=IF(@has=0,'ALTER TABLE service_types ADD COLUMN sort_order INT NOT NULL DEFAULT 0','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @has=(SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='service_types' AND COLUMN_NAME='is_active');
SET @sql=IF(@has=0,'ALTER TABLE service_types ADD COLUMN is_active TINYINT NOT NULL DEFAULT 1','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @has=(SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='case_statuses' AND COLUMN_NAME='sort_order');
SET @sql=IF(@has=0,'ALTER TABLE case_statuses ADD COLUMN sort_order INT NOT NULL DEFAULT 0','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @has=(SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='case_statuses' AND COLUMN_NAME='is_active');
SET @sql=IF(@has=0,'ALTER TABLE case_statuses ADD COLUMN is_active TINYINT NOT NULL DEFAULT 1','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @has=(SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='note_templates' AND COLUMN_NAME='sort_order');
SET @sql=IF(@has=0,'ALTER TABLE note_templates ADD COLUMN sort_order INT NOT NULL DEFAULT 0','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @has=(SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='note_templates' AND COLUMN_NAME='is_active');
SET @sql=IF(@has=0,'ALTER TABLE note_templates ADD COLUMN is_active TINYINT NOT NULL DEFAULT 1','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
INSERT IGNORE INTO master_data_options (organization_id,category,code,label,sort_order) SELECT id,'student_status','active','กำลังศึกษา',0 FROM organizations;
INSERT IGNORE INTO master_data_options (organization_id,category,code,label,sort_order) SELECT id,'student_status','graduated','จบการศึกษา',1 FROM organizations;
INSERT IGNORE INTO master_data_options (organization_id,category,code,label,sort_order) SELECT id,'student_status','on_leave','ลาพัก',2 FROM organizations;
INSERT IGNORE INTO master_data_options (organization_id,category,code,label,sort_order) SELECT id,'student_status','withdrawn','ลาออก',3 FROM organizations;
INSERT IGNORE INTO master_data_options (organization_id,category,code,label,sort_order) SELECT id,'student_status','waived','สละสิทธิ์',4 FROM organizations;
INSERT IGNORE INTO master_data_options (organization_id,category,code,label,sort_order) SELECT id,'risk_level','high','เสี่ยงสูง',0 FROM organizations;
INSERT IGNORE INTO master_data_options (organization_id,category,code,label,sort_order) SELECT id,'risk_level','medium','เสี่ยงปานกลาง',1 FROM organizations;
INSERT IGNORE INTO master_data_options (organization_id,category,code,label,sort_order) SELECT id,'risk_level','normal','ปกติ',2 FROM organizations;
INSERT IGNORE INTO master_data_options (organization_id,category,code,label,sort_order) SELECT id,'risk_level','none','ยังไม่มีผล',3 FROM organizations;
INSERT IGNORE INTO master_data_options (organization_id,category,code,label,sort_order) SELECT id,'gender','male','ชาย',0 FROM organizations;
INSERT IGNORE INTO master_data_options (organization_id,category,code,label,sort_order) SELECT id,'gender','female','หญิง',1 FROM organizations;
INSERT IGNORE INTO master_data_options (organization_id,category,code,label,sort_order) SELECT id,'gender','other','อื่น ๆ',2 FROM organizations;
INSERT IGNORE INTO master_data_options (organization_id,category,code,label,sort_order) SELECT id,'blood_type','A','A',0 FROM organizations;
INSERT IGNORE INTO master_data_options (organization_id,category,code,label,sort_order) SELECT id,'blood_type','B','B',1 FROM organizations;
INSERT IGNORE INTO master_data_options (organization_id,category,code,label,sort_order) SELECT id,'blood_type','AB','AB',2 FROM organizations;
INSERT IGNORE INTO master_data_options (organization_id,category,code,label,sort_order) SELECT id,'blood_type','O','O',3 FROM organizations;
INSERT IGNORE INTO master_data_options (organization_id,category,code,label,sort_order) SELECT id,'blood_type','unknown','ไม่ทราบ',4 FROM organizations;
INSERT IGNORE INTO master_data_options (organization_id,category,code,label,sort_order) SELECT id,'hearing','normal','ปกติ',0 FROM organizations;
INSERT IGNORE INTO master_data_options (organization_id,category,code,label,sort_order) SELECT id,'hearing','abnormal','ผิดปกติ',1 FROM organizations;
INSERT IGNORE INTO master_data_options (organization_id,category,code,label,sort_order) SELECT id,'hearing','not_tested','ยังไม่ได้ตรวจ',2 FROM organizations;
INSERT IGNORE INTO master_data_options (organization_id,category,code,label,sort_order) SELECT id,'prefix','boy','ด.ช.',0 FROM organizations;
INSERT IGNORE INTO master_data_options (organization_id,category,code,label,sort_order) SELECT id,'prefix','girl','ด.ญ.',1 FROM organizations;
INSERT IGNORE INTO master_data_options (organization_id,category,code,label,sort_order) SELECT id,'prefix','mr','นาย',2 FROM organizations;
INSERT IGNORE INTO master_data_options (organization_id,category,code,label,sort_order) SELECT id,'prefix','miss','นางสาว',3 FROM organizations;
INSERT IGNORE INTO master_data_options (organization_id,category,code,label,sort_order) SELECT id,'prefix','mrs','นาง',4 FROM organizations;
INSERT IGNORE INTO master_data_options (organization_id,category,code,label,sort_order) SELECT id,'guardian_relationship','father','บิดา',0 FROM organizations;
INSERT IGNORE INTO master_data_options (organization_id,category,code,label,sort_order) SELECT id,'guardian_relationship','mother','มารดา',1 FROM organizations;
INSERT IGNORE INTO master_data_options (organization_id,category,code,label,sort_order) SELECT id,'guardian_relationship','relative','ญาติ',2 FROM organizations;
INSERT IGNORE INTO master_data_options (organization_id,category,code,label,sort_order) SELECT id,'guardian_relationship','other','อื่น ๆ',3 FROM organizations;
INSERT IGNORE INTO master_data_options (organization_id,category,code,label,sort_order) SELECT id,'living_with','parents','บิดามารดา',0 FROM organizations;
INSERT IGNORE INTO master_data_options (organization_id,category,code,label,sort_order) SELECT id,'living_with','guardian','ผู้ปกครอง',1 FROM organizations;
INSERT IGNORE INTO master_data_options (organization_id,category,code,label,sort_order) SELECT id,'living_with','dormitory','หอพัก',2 FROM organizations;
INSERT IGNORE INTO master_data_options (organization_id,category,code,label,sort_order) SELECT id,'living_with','other','อื่น ๆ',3 FROM organizations;
INSERT IGNORE INTO master_data_options (organization_id,category,code,label,sort_order) SELECT id,'family_status','together','อยู่ร่วมกัน',0 FROM organizations;
INSERT IGNORE INTO master_data_options (organization_id,category,code,label,sort_order) SELECT id,'family_status','separated','แยกกันอยู่',1 FROM organizations;
INSERT IGNORE INTO master_data_options (organization_id,category,code,label,sort_order) SELECT id,'family_status','single_parent','ผู้ปกครองคนเดียว',2 FROM organizations;
INSERT IGNORE INTO master_data_options (organization_id,category,code,label,sort_order) SELECT id,'family_status','other','อื่น ๆ',3 FROM organizations;
INSERT IGNORE INTO master_data_options (organization_id,category,code,label,sort_order) SELECT id,'support_needs','education','การศึกษา',0 FROM organizations;
INSERT IGNORE INTO master_data_options (organization_id,category,code,label,sort_order) SELECT id,'support_needs','financial','ทุน/ค่าใช้จ่าย',1 FROM organizations;
INSERT IGNORE INTO master_data_options (organization_id,category,code,label,sort_order) SELECT id,'support_needs','health','สุขภาพ',2 FROM organizations;
INSERT IGNORE INTO master_data_options (organization_id,category,code,label,sort_order) SELECT id,'support_needs','family','ครอบครัว',3 FROM organizations;
INSERT IGNORE INTO master_data_options (organization_id,category,code,label,sort_order) SELECT id,'support_needs','other','อื่น ๆ',4 FROM organizations;

INSERT IGNORE INTO master_data_options (organization_id,category,code,label,sort_order) SELECT id,'faculty','faculty_0','(1) สำนักวิชาวิทยาศาสตร์',0 FROM organizations;
INSERT IGNORE INTO master_data_options (organization_id,category,code,label,sort_order) SELECT id,'faculty','faculty_1','(2) สำนักวิชาเทคโนโลยีสังคม',1 FROM organizations;
INSERT IGNORE INTO master_data_options (organization_id,category,code,label,sort_order) SELECT id,'faculty','faculty_2','(3) สำนักวิชาเทคโนโลยีการเกษตร',2 FROM organizations;
INSERT IGNORE INTO master_data_options (organization_id,category,code,label,sort_order) SELECT id,'faculty','faculty_3','(4) สำนักวิชาวิศวกรรมศาสตร์',3 FROM organizations;
INSERT IGNORE INTO master_data_options (organization_id,category,code,label,sort_order) SELECT id,'faculty','faculty_4','(5) สำนักวิชาแพทยศาสตร์',4 FROM organizations;
INSERT IGNORE INTO master_data_options (organization_id,category,code,label,sort_order) SELECT id,'faculty','faculty_5','(6) สำนักวิชาพยาบาลศาสตร์',5 FROM organizations;
INSERT IGNORE INTO master_data_options (organization_id,category,code,label,sort_order) SELECT id,'faculty','faculty_6','(7) สำนักวิชาทันตแพทยศาสตร์',6 FROM organizations;
INSERT IGNORE INTO master_data_options (organization_id,category,code,label,sort_order) SELECT id,'faculty','faculty_7','(8) สำนักวิชาสาธารณสุขศาสตร์',7 FROM organizations;
INSERT IGNORE INTO master_data_options (organization_id,category,code,label,sort_order) SELECT id,'faculty','faculty_8','(9) สำนักวิชาศาสตร์และศิลป์ดิจิทัล',8 FROM organizations;
INSERT IGNORE INTO master_data_options (organization_id,category,code,label,sort_order) SELECT id,'faculty','faculty_9','อื่นๆ',9 FROM organizations;
INSERT IGNORE INTO master_data_options (organization_id,category,code,label,sort_order) SELECT id,'user_status','student','นักศึกษา',0 FROM organizations;
INSERT IGNORE INTO master_data_options (organization_id,category,code,label,sort_order) SELECT id,'user_status','general','บุคคลทั่วไป',1 FROM organizations;
INSERT IGNORE INTO master_data_options (organization_id,category,code,label,sort_order) SELECT id,'publication_status','published','เผยแพร่',0 FROM organizations;
INSERT IGNORE INTO master_data_options (organization_id,category,code,label,sort_order) SELECT id,'publication_status','draft','ร่าง',1 FROM organizations;
INSERT IGNORE INTO master_data_options (organization_id,category,code,label,sort_order) SELECT id,'publication_status','hidden','ซ่อน',2 FROM organizations;
