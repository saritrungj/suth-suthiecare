-- Rollback keeps patient_account_id data intact. It only removes constraints and
-- indexes, so clinical ownership can be restored by redeploying the prior code.
-- Do not drop patient_account_id columns: doing so would destroy ownership data.

ALTER TABLE mastercases DROP FOREIGN KEY fk_mastercases_patient_account;
ALTER TABLE form_responses DROP FOREIGN KEY fk_form_responses_patient_account;
ALTER TABLE mastercases DROP INDEX idx_mastercases_account_clinic_status;
ALTER TABLE form_responses DROP INDEX idx_form_responses_patient_account;
