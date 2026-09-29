-- Roll back 20260902_form_requires_login.sql

ALTER TABLE forms DROP COLUMN requires_login;
