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
  {
    name: 'Daniel Zhabotinsky',
    role: "Parked cars: Kiri '10, Milano '95, Urban '10, Shvan '92, Conquer '89 Pickup, LCT 3000 '07",
    note: 'CC-BY 4.0, sketchfab.com/DanielZhabotinsky (decimated, textures resized)',
  },
  {
    name: 'byhoangtran',
    role: 'Cyber samurai body ("Cyberpunk Samurai Robot")',
    note: 'CC-BY 4.0, sketchfab.com/3d-models/cyberpunk-samurai-robot-6b7c89af7c5b4a17a94f890e0ec3eedf (split at the joints, katana removed)',
  },
  { name: 'Bioxx', role: 'Naginata', note: 'CC0, opengameart.org/content/naginata' },
  {
    name: 'vaportrash',
    role: 'Final boss ("Gunslinger Crab Mech v1.2")',
    note: 'CC-BY 4.0, sketchfab.com/3d-models/5147619f337a45b0974f349eac27b34a (legs split at the hips, decimated, textures resized)',
  },
  {
    name: 'Lagst',
    role: 'Boss drones ("Light Assault Mech", a dragonfly flyer)',
    note: 'CC-BY 4.0, sketchfab.com/3d-models/d1ca5065b5184646bc7028597d0ce049 (armature applied, decimated, textures resized)',
  },
  {
    name: 'Chenzoss',
    role: 'Semi-truck with trailer (Yellow semi-truck with trailer)',
    note: 'CC-BY 4.0, sketchfab.com/3d-models/ee0a8763bd8941f1bc546b43332d4001 (decimated, textures resized)',
  },
  {
    name: 'louis-muir',
    role: 'Forklift (Forklift Truck)',
    note: 'CC-BY 4.0, sketchfab.com/3d-models/060f3f8bc7de4e6ca2f348d414702e9d (textures resized)',
  },
  {
    name: 'Basic Hsu (Hsu.Pei.Ge)',
    role: 'Mobile crane truck (Ural KS3574 / interior)',
    note: 'CC-BY 4.0, sketchfab.com/3d-models/317c5dbcad974d9f99efd079060d4344 (interior dropped, decimated)',
  },
  { name: 'Poly Haven', role: 'Cabinets, barrier, barrels, tyre, generator, work light', note: 'CC0, polyhaven.com' },
  { name: '3DModelsCC0', role: 'Water tower, dumpster and other yard clutter', note: 'CC0, 3dmodelscc0.itch.io' },
  { name: 'Three.js', role: '3D rendering', note: 'MIT licence, threejs.org' },
  { name: 'Rapier', role: 'Physics engine (@dimforge/rapier3d-compat)', note: 'Apache-2.0, rapier.rs' },
];
