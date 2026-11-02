import { organizationLandingPath } from './organization-landing';

describe('Organization navigation', () => {
  it('prefers company for administrators', () => {
    expect(organizationLandingPath(true, true, true)).toBe('company');
  });
  it('respects branch-scoped access when company is unavailable', () => {
    expect(organizationLandingPath(false, true, true)).toBe('branches');
  });
  it('supports users who can only manage devices', () => {
    expect(organizationLandingPath(false, false, true)).toBe('devices');
  });
  it('never sends an unauthorized user to a protected section', () => {
    expect(organizationLandingPath(false, false, false)).toBe('/workspace');
  });
});
