/**
 * Central AFS / role permission logic for the Equipment Store frontend.
 *
 * IMPORTANT — this is a UI-layer convenience only. It hides/disables actions
 * for legitimate users going through the normal app, but it is NOT a
 * security boundary: the frontend calls Supabase directly with the shared
 * anon key (see services/supabaseClient.js), so a technically capable user
 * could still call Supabase directly and bypass every check here. Real
 * enforcement requires RLS policies keyed to a verified identity — see
 * backend/database/rls_afs_design_PROPOSAL.sql for the (not yet applied)
 * design. Do not treat this module as sufficient protection on its own.
 */

const MANAGER_ROLES = ['admin', 'manager'];

export function isAdminOrManager(operatorRole) {
  return !!operatorRole && MANAGER_ROLES.includes(operatorRole.toLowerCase());
}

/**
 * Only admin/manager may create or change serial numbers, regardless of
 * division (ARC or AFS) — this closes a previously ungated capability.
 */
export function canManageSerialNumbers(operatorRole) {
  return isAdminOrManager(operatorRole);
}

/**
 * A "normal AFS employee" is someone whose canonical personnel.division is
 * AFS and who does not hold an admin/manager application role. Supervisors
 * promoted to manager (e.g. Jaco Venter) are governed by the manager role
 * instead, per least-privilege — see PHASE13 notes.
 */
export function isRestrictedAfsEmployee(operator, operatorRole) {
  return !!operator && operator.division === 'AFS' && !isAdminOrManager(operatorRole);
}

/**
 * Effective permission set for the current operator. This is the single
 * source of truth the UI should consult instead of re-deriving role logic
 * per-component.
 */
export function getEffectivePermissions(operator, operatorRole) {
  const restrictedAfs = isRestrictedAfsEmployee(operator, operatorRole);
  const managerPlus = isAdminOrManager(operatorRole);

  return {
    isRestrictedAfs: restrictedAfs,
    // View: restricted AFS employees may only see equipment currently
    // allocated to them; everyone else sees the full inventory (subject to
    // whatever other filters already exist).
    canViewAllEquipment: !restrictedAfs,
    canViewOwnEquipmentOnly: restrictedAfs,
    // Checkout / allocation: restricted AFS employees may not check
    // equipment out at all (to themselves or anyone else). Non-restricted
    // users keep existing checkout behaviour; only manager/admin may issue
    // equipment to a DIFFERENT person (allocate).
    canCheckout: !restrictedAfs,
    canAllocateToOthers: managerPlus,
    // Serial numbers: manager/admin only, regardless of division.
    canAddSerialNumber: managerPlus,
    canEditSerialNumber: managerPlus,
  };
}

/**
 * Client-side filter for an equipment list: when the operator is a
 * restricted AFS employee, only equipment currently held by them should be
 * shown. No-op for everyone else.
 */
export function filterEquipmentForOperator(equipmentList, operator, operatorRole) {
  const perms = getEffectivePermissions(operator, operatorRole);
  if (!perms.canViewOwnEquipmentOnly) return equipmentList;
  return (equipmentList || []).filter((e) => e.current_holder_id === operator.id);
}
