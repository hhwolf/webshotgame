export const CAPTAINS = [
  { id: "bolt", name: "Bolt", role: "Field Engineer", body: "#37c6d6", dark: "#183d50", accent: "#ffd85c", skin: "#f1b889", shape: "compact" },
  { id: "juno", name: "Juno", role: "League Pilot", body: "#8b79ed", dark: "#29315c", accent: "#55e6a5", skin: "#9b674e", shape: "aero" },
  { id: "brick", name: "Brick", role: "Deck Defender", body: "#f06a5f", dark: "#54303e", accent: "#8ee6ff", skin: "#d89168", shape: "broad" },
  { id: "flick", name: "Flick", role: "Trickshot Star", body: "#f5a23f", dark: "#49374f", accent: "#ee79bd", skin: "#efc09b", shape: "nimble" }
];

export const WEAPONS = [
  { id: "pistol", name: "Snap Pistol", damage: 30, mag: 12, reserve: 48, interval: 0.3, reload: 1.05, spread: 0.006, recoil: 0.026, auto: false },
  { id: "rifle", name: "Rivet Rifle", damage: 19, mag: 30, reserve: 90, interval: 0.095, reload: 1.5, spread: 0.017, recoil: 0.018, auto: true }
];

export const BOT_TYPES = {
  rifleman: { label: "Striker", hp: 100, speed: 1.05, cadence: 1.0, damage: 10, accuracy: 0.72, scale: 1, color: "#ef625c" },
  rusher: { label: "Sprinter", hp: 78, speed: 1.5, cadence: 0.8, damage: 8, accuracy: 0.6, scale: 0.9, color: "#ff8c48" },
  heavy: { label: "Anchor", hp: 160, speed: 0.72, cadence: 1.25, damage: 15, accuracy: 0.67, scale: 1.18, color: "#9b75df" },
  scout: { label: "Spotter", hp: 70, speed: 1.28, cadence: 1.45, damage: 12, accuracy: 0.82, scale: 0.88, color: "#e75e9b" },
  boss: { label: "Champion", hp: 540, shield: 190, speed: 0.82, cadence: 0.72, damage: 17, accuracy: 0.76, scale: 1.55, color: "#de4456" }
};

const GRID_A = [
  "1111111111111111", "1000000001000001", "1011110101001101", "1000010100000101",
  "1011010111110101", "1010000000010001", "1010111111011111", "1000100001000001",
  "1110101101011101", "1000001101000001", "1011100000010111", "1000001110000001", "1111111111111111"
];
const GRID_B = [
  "1111111111111111", "1000000000000001", "1011110011110101", "1000010000010001",
  "1010011110011101", "1010000000000001", "1011100111100101", "1000000100000101",
  "1011110101110101", "1000000001000001", "1011011101011101", "1000000000000001", "1111111111111111"
];
const GRID_C = [
  "1111111111111111", "1000000000000001", "1011011110111101", "1001000010000001",
  "1101011010110101", "1000010010000101", "1011110011110101", "1000000000000001",
  "1011011110101101", "1001000010000001", "1011111011110101", "1000000000000001", "1111111111111111"
];
const GRID_D = [
  "1111111111111111", "1000000000000001", "1011101110111101", "1000100000100001",
  "1100101110101101", "1000001000000001", "1011101011110101", "1000001000000101",
  "1010111110110101", "1010000000010001", "1011101011111101", "1000000000000001", "1111111111111111"
];
const GRID_E = [
  "1111111111111111", "1000000000000001", "1011110110111101", "1000010101000001",
  "1010010101011101", "1010000001000001", "1011101101110101", "1000000000000101",
  "1010111111100101", "1000000000000001", "1011101110111101", "1000000000000001", "1111111111111111"
];

const commonSpawns = [
  { x: 13.5, z: 1.5 }, { x: 13.5, z: 5.5 }, { x: 1.5, z: 11 }, { x: 8.5, z: 7.5 }, { x: 12.5, z: 9.5 }
];

export const ARENAS = [
  {
    name: "Cargo Court", subtitle: "Qualifier Stadium", tier: "gold", floors: 2, grid: GRID_A,
    sky: 0x8eddf0, fog: 0xa9d7d6, floorColor: 0x49767e, wallColors: [0x3e9caf, 0xf17859, 0x596db0, 0xe5b84e], accent: 0xffd85c,
    objective: { type: "eliminate", label: "Clear the rival squad", goal: 5 },
    spawn: { x: 1.65, z: 1.65, yaw: -1.5708 }, lifts: [{ x: 8.5, z: 1.5 }, { x: 12.5, z: 11 }], botSpawns: commonSpawns,
    roles: ["rifleman", "rifleman", "scout", "rusher", "rifleman"],
    health: [{ x: 5.5, z: 1.5, floor: 0 }, { x: 2.5, z: 9.5, floor: 1 }]
  },
  {
    name: "Sunset Yard", subtitle: "West Division", tier: "standard", floors: 2, grid: GRID_B,
    sky: 0xf3ac7a, fog: 0xd7b4b1, floorColor: 0x755f77, wallColors: [0x8a6cd1, 0xed7f63, 0x4eb7bf, 0xe0b453], accent: 0xffd16a,
    objective: { type: "collect", label: "Recover league badges", goal: 2 },
    spawn: { x: 1.65, z: 1.65, yaw: -1.5708 }, lifts: [{ x: 6.5, z: 1.5 }, { x: 12.5, z: 11 }], botSpawns: commonSpawns,
    roles: ["rusher", "rifleman", "scout", "rusher", "rifleman"],
    health: [{ x: 7.5, z: 1.5, floor: 0 }, { x: 2.5, z: 9.5, floor: 1 }],
    pickups: [{ x: 6.5, z: 1.5, floor: 0 }, { x: 10.5, z: 7.5, floor: 1 }]
  },
  {
    name: "Canal Works", subtitle: "Hydro Circuit", tier: "standard", floors: 2, grid: GRID_C,
    sky: 0x65cdd8, fog: 0x9ed4c5, floorColor: 0x3d6872, wallColors: [0x48a998, 0x3f86a6, 0xe1b64e, 0xe1705c], accent: 0x58e0ba,
    objective: { type: "hold", label: "Charge the relay", goal: 8, floor: 1, x: 10.5, z: 7.5 },
    spawn: { x: 1.65, z: 1.65, yaw: -1.5708 }, lifts: [{ x: 5.5, z: 1.5 }, { x: 10.5, z: 11 }], botSpawns: [{ x: 13.5, z: 1.5 }, { x: 14.2, z: 3.5 }, { x: 1.5, z: 11 }, { x: 8.5, z: 7.5 }, { x: 5.5, z: 9.5 }],
    roles: ["heavy", "rifleman", "scout", "rusher", "rifleman"],
    health: [{ x: 7.5, z: 7.5, floor: 0 }, { x: 2.5, z: 9.5, floor: 1 }]
  },
  {
    name: "Metro Market", subtitle: "All-Star Concourse", tier: "gold", floors: 2, grid: GRID_D,
    sky: 0x80c9ec, fog: 0xc4d9db, floorColor: 0x59636f, wallColors: [0xee6c60, 0x55a9ca, 0xf0bc4e, 0x8a6bd1], accent: 0xffcf5a,
    objective: { type: "collect", label: "Claim prize capsules", goal: 3 },
    spawn: { x: 1.65, z: 1.65, yaw: -1.5708 }, lifts: [{ x: 5.5, z: 1.5 }, { x: 12.5, z: 11 }], botSpawns: commonSpawns,
    roles: ["heavy", "rusher", "scout", "rusher", "rifleman"],
    health: [{ x: 5.5, z: 11, floor: 0 }, { x: 13.5, z: 1.5, floor: 1 }],
    pickups: [{ x: 5.5, z: 1.5, floor: 0 }, { x: 3.5, z: 7.5, floor: 1 }, { x: 12.5, z: 11, floor: 0 }]
  },
  {
    name: "Beacon District", subtitle: "Night Showcase", tier: "standard", floors: 2, grid: GRID_E,
    sky: 0x6c9bd1, fog: 0x9fb8c8, floorColor: 0x404f68, wallColors: [0x3e8ca5, 0xe17270, 0x8d74d9, 0x4bb792], accent: 0xb896ff,
    objective: { type: "hold", label: "Power the show beacon", goal: 12, floor: 1, x: 7.5, z: 7.5 },
    spawn: { x: 1.65, z: 1.65, yaw: -1.5708 }, lifts: [{ x: 6.5, z: 1.5 }, { x: 10.5, z: 11 }], botSpawns: commonSpawns,
    roles: ["heavy", "heavy", "scout", "rusher", "rifleman"],
    health: [{ x: 5.5, z: 11, floor: 0 }, { x: 13.5, z: 1.5, floor: 1 }]
  },
  {
    name: "Apex Foundry", subtitle: "Championship Final", tier: "gold", floors: 3, grid: GRID_E,
    sky: 0x77c9da, fog: 0xb4c7bd, floorColor: 0x4d5159, wallColors: [0xb94b58, 0x3f829b, 0xd49d3f, 0x6858a3], accent: 0xff6b59,
    objective: { type: "eliminate", label: "Defeat Atlas", goal: 5 },
    spawn: { x: 1.65, z: 1.65, yaw: -1.5708 }, lifts: [{ x: 6.5, z: 1.5 }, { x: 12.5, z: 11 }], botSpawns: commonSpawns,
    roles: ["boss", "rusher", "scout", "heavy", "rusher"],
    health: [{ x: 5.5, z: 11, floor: 0 }, { x: 13.5, z: 1.5, floor: 1 }, { x: 8.5, z: 9.5, floor: 2 }]
  }
];

export const UPGRADES = [
  { id: "overcharge", name: "Power Rivets", detail: "+25% blaster damage" },
  { id: "quick", name: "Quick-Swap Hands", detail: "30% faster reloads" },
  { id: "reinforced", name: "Reinforced Shell", detail: "+25 integrity" },
  { id: "fleet", name: "Roller Soles", detail: "+15% movement speed" },
  { id: "deep", name: "Deep Pockets", detail: "+50% reserve ammo" }
];
