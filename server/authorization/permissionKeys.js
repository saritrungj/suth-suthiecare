// Every grantable key: the unit matrix plus system-wide banner rights.
const { UNIT_KEYS, SYSTEM_KEYS } = require("./permissionMatrix");

module.exports = [...UNIT_KEYS, ...SYSTEM_KEYS];
