const AGENCY_PERMISSIONS = ["agency_entries.create", "agency_entries.view", "agency_entries.verify"];
const agencyPermissions = (keys) => keys.filter((key) => AGENCY_PERMISSIONS.includes(key));
const isAgencyOnlyRole = (keys) => keys.length > 0 && keys.every((key) => AGENCY_PERMISSIONS.includes(key));
const canAgencyAction = (keys, action) => action === "schema"
  ? keys.some((key) => ["agency_entries.create", "agency_entries.view"].includes(key))
  : AGENCY_PERMISSIONS.includes(`agency_entries.${action}`) && keys.includes(`agency_entries.${action}`);
module.exports = { AGENCY_PERMISSIONS, agencyPermissions, isAgencyOnlyRole, canAgencyAction };
