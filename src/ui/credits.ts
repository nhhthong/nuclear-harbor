/** Credits shown from the main menu (T-17). Pure data so it can be unit-tested. */
export interface CreditEntry {
  readonly name: string;
  readonly role: string;
  readonly note?: string;
}

export const CREDITS: readonly CreditEntry[] = [
  {
    name: 'funnky',
    role: 'G36C first-person view model',
    note: 'Used with the permission of the project owner (see docs/ASSETS.md).',
  },
  { name: 'Three.js', role: '3D rendering', note: 'MIT licence, threejs.org' },
  { name: 'Rapier', role: 'Physics engine (@dimforge/rapier3d-compat)', note: 'Apache-2.0, rapier.rs' },
];
