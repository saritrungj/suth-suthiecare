import { usePermissions } from "./PermissionsProvider";
import { PERMISSION_ACTIONS } from "./permissionRegistry";

// Roles-page rights of one module in the active unit, e.g. useModuleActions("forms").create.
export function useModuleActions(module) {
  const { can } = usePermissions();
  return Object.fromEntries(
    PERMISSION_ACTIONS.map((action) => [action, can(`${module}.${action}`)]),
  );
}
