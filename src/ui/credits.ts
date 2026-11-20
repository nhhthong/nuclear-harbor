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
    name: 'skudgee (Willy Decarpentrie)',
    role: 'Biped robot (infantry "Biped robot")',
    note: 'CC-BY 4.0, sketchfab.com/3d-models/801d2a245e4a4405a0c2152b35b5e486 (display base removed, decimated, run, crouch, leap and claw clips added)',
  },
  {
    name: 'MSGDI',
    role: 'Medium Mech Striker (army robot)',
    note: 'CC-BY 4.0, sketchfab.com/3d-models/27ba717c173a40b7841d2f2c6a89d823 (decimated, textures resized, three of its clips used)',
  },
  {
    name: 'reececreoplan (CreoPlan Ltd)',
    role: 'Walking Robotic Dog (Spot dog)',
    note: 'CC-BY 4.0, sketchfab.com/3d-models/cb8157f40d39456d9f37865b4e6e7477 (decimated, textures resized, leg clips merged)',
  },
  {
    name: 'vaportrash',
    role: 'Final boss ("Gunslinger Crab Mech v1.2")',
    note: 'CC-BY 4.0, sketchfab.com/3d-models/5147619f337a45b0974f349eac27b34a (legs split at the hips, decimated, textures resized)',
  },
  {
    name: 'Mirandanimator',
    role: 'Semi-boss STINGER-7 ("Scorpion Robot")',
    note: 'CC-BY 4.0, sketchfab.com/3d-models/e44be9a622af4e85b4b10cf59b25de1a (split into body, four legs and a tail chain, decimated, recoloured gunmetal with green glow parts)',
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
  {
    name: 'Monke (cosmiccobra)',
    role: 'Warehouse pallet jack ("Low Poly Pallet Jack")',
    note: 'CC-BY 4.0, sketchfab.com/3d-models/5b0b9b7b1e1640cf9804588a763cc9f1 (decimated, textures resized)',
  },
  {
    name: 'DartleDyan',
    role: 'Warehouse ibc tank ("IBC Tank")',
    note: 'CC-BY 4.0, sketchfab.com/3d-models/55723c0e512242e989dbb996fbef095e (decimated, textures resized)',
  },
  {
    name: 'YadroGames',
    role: 'Warehouse wooden pallet ("Wooden Pallets")',
    note: 'CC-BY 4.0, sketchfab.com/3d-models/dba5c00928cd400796d9f6fffdd724b3 (decimated, textures resized)',
  },
  {
    name: 'Glowbox 3D',
    role: 'Warehouse computer desk set ("Low Poly Computer Desk")',
    note: 'CC-BY 4.0, sketchfab.com/3d-models/c67f61fa444044bcb88ec3e28f0ca7ac (decimated, textures resized)',
  },
  { name: 'Poly Haven', role: 'Cabinets, barrier, barrels, tyre, generator, work light; warehouse crates, boxes, tools, office furniture, lamps, concrete floor and asphalt textures', note: 'CC0, polyhaven.com' },
  { name: '3DModelsCC0', role: 'Water tower, dumpster and other yard clutter', note: 'CC0, 3dmodelscc0.itch.io' },
  {
    name: 'Joseph SARDIN - BigSoundBank.com',
    role: 'Sound effects: rifle, reload, casings, footsteps, impacts, voice, heartbeat, breathing, robots, drone, sword, alarms, gate, wind and sea',
    note: 'CC0, bigsoundbank.com (ids in CREDITS.md)',
  },
  {
    name: 'congusbongus',
    role: 'Sound: metal footsteps ("Footsteps on different surfaces")',
    note: 'CC-BY 3.0, opengameart.org/content/footsteps-on-different-surfaces (derived from "fboots on aluminum ladder 01" by Eelke, CC-BY 3.0, freesound.org/people/Eelke/sounds/462598)',
  },
  { name: 'Eelke', role: 'Sound: boots on an aluminium ladder (source of the metal footsteps)', note: 'CC-BY 3.0, freesound.org/people/Eelke/sounds/462598' },
  { name: 'Kenney', role: 'Sound: enemy lasers, robot explosions, boss defeat, medkit and hit-marker UI', note: 'CC0, opengameart.org/content/sci-fi-sounds, /content/interface-sounds' },
  { name: 'rubberduck', role: 'Sound: armour and concrete hits, boss cannon', note: 'CC0, opengameart.org (75 breaking/falling/hit sfx, 25 bang/firework sfx)' },
  { name: 'hc', role: 'Sound: boss stomp ("Mech Stomp / Step Sound")', note: 'CC0, opengameart.org/content/mech-stomp-step-sound' },
  { name: 'celestialghost8', role: 'Sound: boss laser ("Laser weapon burst fire")', note: 'CC0, opengameart.org/content/laser-weapon-burst-fire' },
  { name: 'Three.js', role: '3D rendering', note: 'MIT licence, threejs.org' },
  { name: 'Rapier', role: 'Physics engine (@dimforge/rapier3d-compat)', note: 'Apache-2.0, rapier.rs' },
];
