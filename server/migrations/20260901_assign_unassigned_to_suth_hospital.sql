-- Move every legacy record without an organization to the SUT Hospital organization.
-- Safe to run repeatedly. Prefer an existing organization with the canonical
-- hospital name so an auto-generated organization code does not create a
-- duplicate hospital record.

INSERT INTO organizations (code, name, description, status)
SELECT
  'SUTH-HOSPITAL',
  'โรงพยาบาลมหาวิทยาลัยเทคโนโลยีสุรนารี',
  'หน่วยงานหลักสำหรับข้อมูลเดิมของระบบและบริการโรงพยาบาลมหาวิทยาลัยเทคโนโลยีสุรนารี',
  'active'
WHERE NOT EXISTS (
  SELECT 1 FROM organizations
  WHERE name = 'โรงพยาบาลมหาวิทยาลัยเทคโนโลยีสุรนารี'
);

SET @suth_hospital_organization_id := (
  SELECT MIN(id) FROM organizations
  WHERE name = 'โรงพยาบาลมหาวิทยาลัยเทคโนโลยีสุรนารี'
);

UPDATE clinics
SET organization_id = @suth_hospital_organization_id
WHERE organization_id IS NULL
   OR organization_id IN (
     SELECT id FROM organizations
     WHERE name = 'โรงพยาบาลมหาวิทยาลัยเทคโนโลยีสุรนารี'
   );

UPDATE forms
SET organization_id = @suth_hospital_organization_id
WHERE organization_id IS NULL
   OR organization_id IN (
     SELECT id FROM organizations
     WHERE name = 'โรงพยาบาลมหาวิทยาลัยเทคโนโลยีสุรนารี'
   );

-- Form ownership follows the clinic selected in clinic_type. This also repairs
-- any legacy form whose previous organization did not match its clinic.
UPDATE forms f
JOIN clinics c ON c.slug = f.clinic_type
SET f.organization_id = c.organization_id
WHERE c.organization_id IS NOT NULL;

UPDATE mastercases
SET organization_id = @suth_hospital_organization_id
WHERE organization_id IS NULL
   OR organization_id IN (
     SELECT id FROM organizations
     WHERE name = 'โรงพยาบาลมหาวิทยาลัยเทคโนโลยีสุรนารี'
   );

UPDATE form_responses
SET organization_id = @suth_hospital_organization_id
WHERE organization_id IS NULL
   OR organization_id IN (
     SELECT id FROM organizations
     WHERE name = 'โรงพยาบาลมหาวิทยาลัยเทคโนโลยีสุรนารี'
   );

-- Preserve duplicate rows for auditability, but remove them from active
-- selectors after all operational ownership has been consolidated.
UPDATE organizations
SET status = 'inactive'
WHERE name = 'โรงพยาบาลมหาวิทยาลัยเทคโนโลยีสุรนารี'
  AND id <> @suth_hospital_organization_id;

UPDATE organizations
SET status = 'active'
WHERE id = @suth_hospital_organization_id;
