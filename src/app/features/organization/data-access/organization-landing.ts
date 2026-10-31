/** Preferred first section for the user; never redirect to a forbidden screen. */
export function organizationLandingPath(
  canCompany: boolean,
  canBranches: boolean,
  canDevices: boolean,
): 'company' | 'branches' | 'devices' | '/workspace' {
  if (canCompany) return 'company';
  if (canBranches) return 'branches';
  if (canDevices) return 'devices';
  return '/workspace';
}
