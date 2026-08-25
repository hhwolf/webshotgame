import * as THREE from "three";
import { characterProfile } from "./character-design.js";
import { ARENAS, BOT_TYPES, CAPTAINS, UPGRADES, WEAPONS } from "./data.js";
import { challengeForArena, estimatedWinRate, normalizeArenaRecords, recordArenaResult, TARGET_WIN_RATE } from "./difficulty.js";
import { movementVelocity } from "./movement.js";

const CELL = 3.1;
const DECK_HEIGHT = 5.2;
const EYE_HEIGHT = 1.68;
const ROUND_TIME = 180;
const TAU = Math.PI * 2;
const mount = document.getElementById("gameMount");
const radar = document.getElementById("radarCanvas");
const radarCtx = radar.getContext("2d");

const ui = Object.fromEntries([
  "hud", "menu", "pausePanel", "upgradePanel", "roundPanel", "healthText", "healthBar", "ammoText", "weaponText",
  "captainText", "levelText", "arenaText", "objectiveText", "botsText", "timerText", "scoreText", "muteButton", "bossHud",
  "bossHealthBar", "bossShieldBar", "bossPhaseText", "crosshair", "hitMarker", "damageVignette", "announcement",
  "interactionPrompt", "captainChoices", "controlsPanel", "upgradeChoices", "roundKicker", "roundTitle", "roundSummary",
  "scoreboard", "benchmarkSummary", "bestStats", "reducedMotion", "qualitySelect", "startButton", "controlsButton",
  "resumeButton", "restartPauseButton", "restartButton", "copyScoreButton", "copyReportButton", "menuButton"
].map((id) => [id, document.getElementById(id)]));

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.05, 160);
camera.rotation.order = "YXZ";
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = false;
mount.appendChild(renderer.domElement);

const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const center = new THREE.Vector2(0, 0);
const world = new THREE.Group();
const actorLayer = new THREE.Group();
const effectLayer = new THREE.Group();
scene.add(world, actorLayer, effectLayer);

const hemi = new THREE.HemisphereLight(0xcaf3ff, 0x29404b, 2.35);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0c2, 4.2);
sun.position.set(-14, 26, -9);
sun.castShadow = false;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -28;
sun.shadow.camera.right = 28;
sun.shadow.camera.top = 28;
sun.shadow.camera.bottom = -28;
scene.add(sun);

const savedArenaIndex = Number.parseInt(localStorage.getItem("snapLeague.campaign") || "0", 10);
const state = {
  mode: "menu", arenaIndex: Number.isInteger(savedArenaIndex) && savedArenaIndex >= 0 ? savedArenaIndex % ARENAS.length : 0,
  nextArenaIndex: null,
  arena: ARENAS[0], keys: Object.create(null), pointerDown: false, dragX: 0, bots: [], props: [], effects: [], deckGroups: [], liftMeshes: [],
  walls: [], score: 0, kills: 0, objectiveProgress: 0, objectiveComplete: false, timeLeft: ROUND_TIME, countdown: 0,
  elapsed: 0, lastResult: null, upgradeStops: new Set(), fps: 60, frameCount: 0, fpsTime: 0, errors: 0,
  muted: localStorage.getItem("tacticalArena.muted") === "true", quality: localStorage.getItem("snapLeague.quality") || "high",
  reducedMotion: localStorage.getItem("snapLeague.reducedMotion") === "true", captainId: localStorage.getItem("snapLeague.captain") || "bolt",
  bestScore: Number(localStorage.getItem("tacticalArena.bestScore") || 0), bestTime: Number(localStorage.getItem("tacticalArena.fastestClear") || 0),
  audio: null, shootHeld: false, shake: 0, damageFlash: 0, hitFlash: 0, announcementTime: 0, floorFade: 0, matchStarts: 0, hudTimer: 0, radarTimer: 0,
  metrics: loadMetrics(), arenaRecords: loadArenaRecords(), challenge: 1
};

const player = {
  x: 1.65, z: 1.65, floor: 0, yaw: 0, pitch: 0, yOffset: 0, vy: 0, grounded: true, jumpCooldown: 0,
  vx: 0, vz: 0, health: 100, maxHealth: 100, speed: 3.05, speedBonus: 0, radius: 0.2, weapon: 0,
  ammo: [12, 30], reserve: [48, 90], cooldown: 0, reloading: 0, reloadScale: 1, damageScale: 1,
  recoil: 0, bob: 0, liftCooldown: 0, healthKits: 0, upgrades: []
};

let arenaRoot = null;
let weaponRig = null;
let muzzleFlash = null;
let viewArms = [];
let audioContext = null;

const faceUrls = [
  new URL("./assets/faces/bolt.png", import.meta.url).href,
  new URL("./assets/faces/juno.png", import.meta.url).href,
  new URL("./assets/faces/brick.png", import.meta.url).href,
  new URL("./assets/faces/flick.png", import.meta.url).href
];
const toonRamp = new THREE.DataTexture(new Uint8Array([
  86, 100, 112, 255,
  178, 188, 194, 255,
  255, 255, 255, 255
]), 3, 1, THREE.RGBAFormat);
toonRamp.minFilter = THREE.NearestFilter; toonRamp.magFilter = THREE.NearestFilter; toonRamp.needsUpdate = true;

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function captain() { return CAPTAINS.find((item) => item.id === state.captainId) || CAPTAINS[0]; }
function weapon() { return WEAPONS[player.weapon]; }
function floorY(floor) { return floor * DECK_HEIGHT; }
function toWorldX(x) { return (x - state.arena.grid[0].length / 2) * CELL; }
function toWorldZ(z) { return (z - state.arena.grid.length / 2) * CELL; }
function formatTime(value) { const s = Math.max(0, Math.ceil(value)); return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; }
function distance2D(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }
function hex(value) { return `#${value.toString(16).padStart(6, "0")}`; }

function loadMetrics() {
  try {
    return { starts: 0, completed: 0, wins: 0, replays: 0, fpsTotal: 0, fpsSamples: 0, ...(JSON.parse(localStorage.getItem("snapLeague.metrics") || "{}")) };
  } catch (_error) {
    return { starts: 0, completed: 0, wins: 0, replays: 0, fpsTotal: 0, fpsSamples: 0 };
  }
}

function saveMetrics() { localStorage.setItem("snapLeague.metrics", JSON.stringify(state.metrics)); }

function loadArenaRecords() {
  try {
    return normalizeArenaRecords(JSON.parse(localStorage.getItem("snapLeague.arenaResults") || "[]"), ARENAS.length);
  } catch (_error) {
    return normalizeArenaRecords([], ARENAS.length);
  }
}

function saveArenaRecords() { localStorage.setItem("snapLeague.arenaResults", JSON.stringify(state.arenaRecords)); }

function material(color, _roughness = 0.68, _metalness = 0.04, emissive = 0x000000) {
  return new THREE.MeshLambertMaterial({ color, emissive, emissiveIntensity: emissive ? 0.55 : 0 });
}

function characterMaterial(color, emissive = 0x000000) {
  return new THREE.MeshToonMaterial({ color, gradientMap: toonRamp, emissive, emissiveIntensity: emissive ? 0.45 : 0 });
}

function mesh(geometry, mat, parent, position = [0, 0, 0], rotation = [0, 0, 0]) {
  const item = new THREE.Mesh(geometry, mat);
  item.position.set(...position);
  item.rotation.set(...rotation);
  item.castShadow = true;
  item.receiveShadow = true;
  parent.add(item);
  return item;
}

function roundedBox(width, height, depth, radius = 0.14) {
  const shape = new THREE.Shape();
  const x = -width / 2, y = -height / 2;
  shape.moveTo(x + radius, y); shape.lineTo(x + width - radius, y); shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius); shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height); shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius); shape.quadraticCurveTo(x, y, x + radius, y);
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: radius * 0.28, bevelThickness: radius * 0.25, bevelSegments: 2 });
}

function textTexture(text, color = "#fffdf3", background = "#143646") {
  const canvas = document.createElement("canvas");
  canvas.width = 512; canvas.height = 128;
  const context = canvas.getContext("2d");
  context.fillStyle = background; context.fillRect(0, 0, 512, 128);
  context.fillStyle = color; context.font = "900 68px Impact, sans-serif"; context.textAlign = "center"; context.textBaseline = "middle";
  context.fillText(text.toUpperCase(), 256, 69);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function clearGroup(group) {
  while (group.children.length) {
    const child = group.children.pop();
    child.traverse((item) => {
      item.geometry?.dispose?.();
      if (Array.isArray(item.material)) item.material.forEach((mat) => mat.dispose?.()); else item.material?.dispose?.();
    });
  }
}

function isWall(x, z) {
  const gx = Math.floor(x), gz = Math.floor(z);
  return gx < 0 || gz < 0 || gz >= state.arena.grid.length || gx >= state.arena.grid[0].length || state.arena.grid[gz][gx] === "1";
}

function hasLineOfSight(a, b) {
  const dist = distance2D(a, b);
  const steps = Math.max(3, Math.ceil(dist * 10));
  for (let index = 1; index < steps; index += 1) {
    const t = index / steps;
    if (isWall(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return false;
  }
  return true;
}

function moveEntity(entity, dx, dz) {
  const radius = entity.radius || 0.2;
  const nx = entity.x + dx;
  const nz = entity.z + dz;
  if (!isWall(nx + Math.sign(dx) * radius, entity.z) && !isWall(nx, entity.z + radius) && !isWall(nx, entity.z - radius)) entity.x = nx;
  if (!isWall(entity.x + radius, nz) && !isWall(entity.x - radius, nz) && !isWall(entity.x, nz + Math.sign(dz) * radius)) entity.z = nz;
}

function arenaLabel(parent, text, x, y, z, width = 7, color = "#fffdf3", background = "#143646") {
  const sign = mesh(new THREE.PlaneGeometry(width, width / 4), new THREE.MeshBasicMaterial({ map: textTexture(text, color, background) }), parent, [x, y, z]);
  sign.castShadow = false;
  return sign;
}

function createLift(parent, lift, floor, accent) {
  const group = new THREE.Group();
  group.position.set(toWorldX(lift.x), floorY(floor), toWorldZ(lift.z));
  const padMat = material(0x173b4b, 0.45, 0.22);
  const glowMat = material(accent, 0.35, 0.08, accent);
  mesh(new THREE.CylinderGeometry(1.05, 1.18, 0.22, 16), padMat, group, [0, 0.08, 0]);
  mesh(new THREE.TorusGeometry(0.78, 0.08, 8, 24), glowMat, group, [0, 0.23, 0], [Math.PI / 2, 0, 0]);
  const tower = mesh(roundedBox(0.8, 1.45, 0.32), padMat, group, [0, 0.82, 0.83]);
  tower.geometry.center();
  const arrow = mesh(new THREE.ConeGeometry(0.22, 0.45, 3), glowMat, group, [0, 1.02, 0.62], [0, 0, Math.PI]);
  arrow.castShadow = false;
  group.userData = { type: "lift", floor, lift };
  parent.add(group); state.liftMeshes.push(group);
  return group;
}

function createHealthKit(parent, data) {
  const group = new THREE.Group();
  group.position.set(toWorldX(data.x), floorY(data.floor) + 0.5, toWorldZ(data.z));
  const white = material(0xf8fff5, 0.48); const green = material(0x55dda2, 0.4, 0.05, 0x1a5c43);
  mesh(new THREE.BoxGeometry(0.9, 0.65, 0.42), white, group);
  mesh(new THREE.BoxGeometry(0.18, 0.48, 0.46), green, group, [0, 0, 0.02]);
  mesh(new THREE.BoxGeometry(0.55, 0.16, 0.46), green, group, [0, 0, 0.02]);
  group.userData = { type: "health", active: true, floor: data.floor, x: data.x, z: data.z, baseY: group.position.y };
  parent.add(group); state.props.push(group); return group;
}

function createObjective(parent, data, index = 0) {
  const group = new THREE.Group();
  group.position.set(toWorldX(data.x), floorY(data.floor) + 0.62, toWorldZ(data.z));
  const gold = material(state.arena.accent, 0.3, 0.15, state.arena.accent);
  mesh(new THREE.SphereGeometry(0.38, 16, 10), gold, group);
  mesh(new THREE.TorusGeometry(0.62, 0.055, 8, 28), gold, group, [0, 0, 0], [Math.PI / 2, 0, 0]);
  group.userData = { type: "objective", active: true, floor: data.floor, x: data.x, z: data.z, index, baseY: group.position.y };
  parent.add(group); state.props.push(group); return group;
}

function createHoldZone(parent, objective) {
  const group = new THREE.Group();
  group.position.set(toWorldX(objective.x), floorY(objective.floor) + 0.03, toWorldZ(objective.z));
  const glow = new THREE.MeshBasicMaterial({ color: state.arena.accent, transparent: true, opacity: 0.28, side: THREE.DoubleSide });
  mesh(new THREE.CircleGeometry(1.45, 32), glow, group, [0, 0, 0], [-Math.PI / 2, 0, 0]);
  const beacon = material(0x163b4b, 0.4, 0.2);
  mesh(new THREE.CylinderGeometry(0.16, 0.22, 1.8, 10), beacon, group, [0, 0.9, 0]);
  const lamp = mesh(new THREE.SphereGeometry(0.22, 12, 8), material(state.arena.accent, 0.25, 0, state.arena.accent), group, [0, 1.82, 0]);
  group.userData = { type: "zone", active: true, floor: objective.floor, x: objective.x, z: objective.z, lamp };
  parent.add(group); state.props.push(group); return group;
}

function addCargoLandmark(parent, baseY, floor) {
  const colors = [0xf06a5e, 0x41b9cc, 0xf2b94d];
  for (let index = 0; index < 3; index += 1) {
    const x = toWorldX(3.4 + index * 4.2);
    const z = toWorldZ(index % 2 ? 10.8 : 5.5);
    const group = new THREE.Group();
    group.position.set(x, baseY + 0.75, z);
    const box = mesh(new THREE.BoxGeometry(3.1, 1.45, 1.45), material(colors[index], 0.5), group);
    for (let rib = -1; rib <= 1; rib += 1) mesh(new THREE.BoxGeometry(0.07, 1.5, 1.5), material(0x153847, 0.6), group, [rib * 0.9, 0, 0]);
    parent.add(group);
  }
  if (floor === state.arena.floors - 1) {
    arenaLabel(parent, "SNAP LEAGUE", 0, baseY + 4.35, toWorldZ(12.1), 9, "#102938", "#ffd85c");
  }
}

function addMarketLandmark(parent, baseY, floor) {
  const kioskColors = [0xef675d, 0x55cdda, 0x8a75df, 0xf2b94d];
  for (let index = 0; index < 4; index += 1) {
    const group = new THREE.Group();
    group.position.set(toWorldX(2.1 + index * 3.7), baseY, toWorldZ(index % 2 ? 10.9 : 5.5));
    mesh(new THREE.BoxGeometry(2.2, 0.85, 1.25), material(0x173d4c, 0.6), group, [0, 0.43, 0]);
    mesh(new THREE.BoxGeometry(2.45, 0.16, 1.55), material(kioskColors[index], 0.5), group, [0, 1.1, 0]);
    const awning = mesh(new THREE.BoxGeometry(2.5, 0.18, 0.75), material(kioskColors[index], 0.45), group, [0, 1.62, -0.25], [-0.18, 0, 0]);
    awning.castShadow = true;
    parent.add(group);
  }
  arenaLabel(parent, floor ? "PRIZE DECK" : "METRO MARKET", toWorldX(8), baseY + 3.5, toWorldZ(11.9), 7.5, "#fffdf3", floor ? "#8a6bd1" : "#ef675d");
}

function addFoundryLandmark(parent, baseY, floor) {
  const hot = material(0xff6d4f, 0.25, 0.1, 0xff3d22);
  for (let index = 0; index < 3; index += 1) {
    const x = toWorldX(3.5 + index * 4.4);
    const z = toWorldZ(index % 2 ? 10.5 : 5.5);
    mesh(new THREE.CylinderGeometry(0.85, 1.05, 2.4, 12), material(0x313f4b, 0.34, 0.35), parent, [x, baseY + 1.2, z]);
    mesh(new THREE.TorusGeometry(0.73, 0.12, 8, 20), hot, parent, [x, baseY + 1.3, z], [Math.PI / 2, 0, 0]);
  }
  if (floor === state.arena.floors - 1) {
    arenaLabel(parent, "CHAMPIONSHIP", 0, baseY + 4.2, toWorldZ(12.05), 9, "#fffdf3", "#b93e52");
    const spotA = new THREE.SpotLight(0xff6d59, 14, 24, 0.55, 0.5, 1.2);
    spotA.position.set(-9, baseY + 4.4, -6); spotA.target.position.set(0, baseY, 0); parent.add(spotA, spotA.target);
    const spotB = new THREE.SpotLight(0x55dce5, 12, 24, 0.55, 0.5, 1.2);
    spotB.position.set(9, baseY + 4.4, -6); spotB.target.position.set(0, baseY, 0); parent.add(spotB, spotB.target);
  }
}

function addStandardLandmarks(parent, baseY, floor) {
  const accent = material(state.arena.accent, 0.5, 0.05);
  for (let index = 0; index < 4; index += 1) {
    const x = toWorldX(3 + index * 3.2);
    const z = toWorldZ(index % 2 ? 10.7 : 5.5);
    mesh(new THREE.CylinderGeometry(0.5, 0.58, 1.15, 12), accent, parent, [x, baseY + 0.58, z]);
  }
  arenaLabel(parent, `${state.arena.subtitle} ${floor + 1}`, toWorldX(8), baseY + 3.5, toWorldZ(12.05), 7, "#fffdf3", hex(state.arena.wallColors[floor % state.arena.wallColors.length]));
}

function buildArena(index) {
  state.arenaIndex = ((index % ARENAS.length) + ARENAS.length) % ARENAS.length;
  state.arena = ARENAS[state.arenaIndex];
  state.props = []; state.walls = []; state.bots = []; state.deckGroups = []; state.liftMeshes = [];
  if (arenaRoot) scene.remove(arenaRoot);
  clearGroup(world); clearGroup(actorLayer); clearGroup(effectLayer);
  arenaRoot = new THREE.Group();
  world.add(arenaRoot);
  scene.background = new THREE.Color(state.arena.sky);
  scene.fog = new THREE.Fog(state.arena.fog, 32, 82);
  hemi.color.set(state.arena.sky);

  const width = state.arena.grid[0].length * CELL;
  const depth = state.arena.grid.length * CELL;
  const wallGeo = new THREE.BoxGeometry(CELL, 3.9, CELL);
  const floorMat = material(state.arena.floorColor, 0.76);
  const ceilingMat = material(0x466873, 0.78, 0.02, 0x213b44);

  for (let floor = 0; floor < state.arena.floors; floor += 1) {
    const baseY = floorY(floor);
    const deckGroup = new THREE.Group();
    deckGroup.userData.floor = floor; arenaRoot.add(deckGroup); state.deckGroups.push(deckGroup);
    const deckFloor = mesh(new THREE.BoxGeometry(width, 0.45, depth), floorMat, deckGroup, [0, baseY - 0.23, 0]);
    deckFloor.receiveShadow = true;
    if (floor < state.arena.floors - 1) {
      const ceiling = mesh(new THREE.BoxGeometry(width, 0.22, depth), ceilingMat, deckGroup, [0, baseY + 4.28, 0]);
      ceiling.receiveShadow = true;
      for (let lightIndex = -2; lightIndex <= 2; lightIndex += 1) {
        mesh(new THREE.BoxGeometry(3.8, 0.08, 0.22), material(0xffeab0, 0.35, 0, 0xffd978), deckGroup, [lightIndex * 6.2, baseY + 4.13, 0]);
      }
    }
    const wallBuckets = state.arena.wallColors.map(() => []);
    state.arena.grid.forEach((row, z) => row.split("").forEach((cell, x) => {
      if (cell !== "1") return;
      const district = Math.abs(x * 7 + z * 11 + floor) % state.arena.wallColors.length;
      wallBuckets[district].push([toWorldX(x + 0.5), baseY + 1.95, toWorldZ(z + 0.5)]);
    }));
    wallBuckets.forEach((positions, colorIndex) => {
      if (!positions.length) return;
      const walls = new THREE.InstancedMesh(wallGeo, material(state.arena.wallColors[colorIndex], 0.64), positions.length);
      const matrix = new THREE.Matrix4();
      positions.forEach((position, positionIndex) => { matrix.makeTranslation(...position); walls.setMatrixAt(positionIndex, matrix); });
      walls.instanceMatrix.needsUpdate = true; walls.castShadow = true; walls.receiveShadow = true; walls.userData.wall = true;
      deckGroup.add(walls); state.walls.push(walls);
    });
    const deckLight = new THREE.PointLight(0xffe8b0, floor < state.arena.floors - 1 ? 7 : 2.5, 28, 1.35);
    deckLight.position.set(0, baseY + 3.75, 0); deckLight.castShadow = false; deckGroup.add(deckLight);
    state.arena.lifts.forEach((lift) => createLift(deckGroup, lift, floor, state.arena.accent));
    if (state.arena.name === "Cargo Court") addCargoLandmark(deckGroup, baseY, floor);
    else if (state.arena.name === "Metro Market") addMarketLandmark(deckGroup, baseY, floor);
    else if (state.arena.name === "Apex Foundry") addFoundryLandmark(deckGroup, baseY, floor);
    else addStandardLandmarks(deckGroup, baseY, floor);
  }

  state.arena.health.forEach((item) => createHealthKit(arenaRoot, item));
  state.arena.pickups?.forEach((item, index2) => createObjective(arenaRoot, item, index2));
  if (state.arena.objective.type === "hold") createHoldZone(arenaRoot, state.arena.objective);
  state.arena.botSpawns.forEach((spawn, botIndex) => state.bots.push(createBot(botIndex, spawn)));
  syncFloorVisibility();
  createWeaponRig();
}

function syncFloorVisibility() {
  state.deckGroups.forEach((group, floor) => { group.visible = floor === player.floor; });
  state.props.forEach((prop) => { prop.visible = prop.userData.active && prop.userData.floor === player.floor; });
  state.bots.forEach((bot) => { bot.figure.visible = bot.alive && bot.floor === player.floor; });
}

function addCartoonFace(root, profile, palette, faceIndex, isBoss) {
  const radius = profile.headRadius;
  const faceRoot = new THREE.Group(); faceRoot.position.y = 2.17; root.add(faceRoot);
  const skin = characterMaterial(palette.skin);
  const dark = characterMaterial(palette.dark);
  const white = characterMaterial(0xfffbeb, 0x24211e);
  const head = mesh(new THREE.SphereGeometry(radius, 16, 12), skin, faceRoot);
  head.scale.set(profile.headWidth, 1.04, 0.92);
  const hair = mesh(new THREE.SphereGeometry(radius * 1.025, 14, 8, 0, TAU, 0, Math.PI / 2), dark, faceRoot, [0, 0.035, -0.005]);
  hair.scale.set(profile.headWidth, 1.04, 0.94);

  const eyeY = 0.035;
  const eyeZ = radius * 0.84;
  [-1, 1].forEach((side) => {
    const eye = mesh(new THREE.SphereGeometry(radius * 0.105, 10, 7), white, faceRoot, [side * radius * 0.34, eyeY, eyeZ]);
    eye.scale.x = 1.18;
    mesh(new THREE.SphereGeometry(radius * 0.05, 8, 6), characterMaterial(faceIndex % 2 ? 0x173f5a : 0x174f43), faceRoot, [side * radius * 0.34, eyeY, eyeZ + radius * 0.09]);
    mesh(new THREE.BoxGeometry(radius * 0.28, radius * 0.055, radius * 0.07), dark, faceRoot,
      [side * radius * 0.32, eyeY + radius * 0.22, eyeZ + radius * 0.035], [0, 0, side * (faceIndex % 2 ? -0.11 : 0.08)]);
  });
  mesh(new THREE.ConeGeometry(radius * 0.085, radius * 0.24, 8), skin, faceRoot,
    [0, -radius * 0.06, eyeZ + radius * 0.05], [Math.PI / 2, 0, 0]);
  const smile = mesh(new THREE.TorusGeometry(radius * 0.13, radius * 0.025, 5, 10, Math.PI), dark, faceRoot,
    [0, -radius * 0.29, eyeZ + radius * 0.06], [0, 0, Math.PI]);
  smile.scale.y = faceIndex % 3 === 2 ? 0.55 : 0.8;
  [-1, 1].forEach((side) => mesh(new THREE.SphereGeometry(radius * 0.16, 9, 7), skin, faceRoot, [side * radius * profile.headWidth, 0, 0]));

  const visor = mesh(new THREE.BoxGeometry(radius * (isBoss ? 1.5 : 1.15), radius * 0.12, radius * 0.16), characterMaterial(palette.accent, palette.accent), faceRoot,
    [0, radius * 0.68, radius * 0.35]);
  return { faceRoot, head, hair, visor };
}

function articulatedArm(parent, profile, palette, side) {
  const upperLength = profile.armLength * 0.54;
  const forearmLength = profile.armLength * 0.46;
  const pivot = new THREE.Group(); pivot.position.set(side * profile.shoulderX, 1.72, 0); parent.add(pivot);
  mesh(new THREE.CapsuleGeometry(profile.armRadius, Math.max(0.06, upperLength - profile.armRadius * 1.5), 4, 8), characterMaterial(palette.body), pivot, [0, -upperLength * 0.5, 0]);
  const elbow = new THREE.Group(); elbow.position.y = -upperLength; pivot.add(elbow);
  mesh(new THREE.CapsuleGeometry(profile.armRadius * 0.9, Math.max(0.05, forearmLength - profile.armRadius * 1.35), 4, 8), characterMaterial(palette.body), elbow, [0, -forearmLength * 0.5, 0]);
  const hand = mesh(new THREE.SphereGeometry(profile.armRadius * 0.96, 9, 7), characterMaterial(palette.skin), elbow, [0, -forearmLength, 0]);
  return { pivot, elbow, hand };
}

function articulatedLeg(parent, profile, palette, side) {
  const thighLength = profile.legLength * 0.52;
  const shinLength = profile.legLength * 0.48;
  const pivot = new THREE.Group(); pivot.position.set(side * profile.legX, 0.94, 0); parent.add(pivot);
  mesh(new THREE.CapsuleGeometry(profile.legRadius, Math.max(0.07, thighLength - profile.legRadius * 1.45), 4, 8), characterMaterial(palette.dark), pivot, [0, -thighLength * 0.5, 0]);
  const knee = new THREE.Group(); knee.position.y = -thighLength; pivot.add(knee);
  mesh(new THREE.CapsuleGeometry(profile.legRadius * 0.9, Math.max(0.06, shinLength - profile.legRadius * 1.35), 4, 8), characterMaterial(palette.dark), knee, [0, -shinLength * 0.5, 0]);
  const boot = mesh(new THREE.BoxGeometry(profile.bootWidth, 0.2, profile.bootWidth * 1.42), characterMaterial(palette.accent), knee, [0, -shinLength, 0.1]);
  return { pivot, knee, boot };
}

function addRoleGear(root, role, profile, palette) {
  const accent = characterMaterial(palette.accent, palette.accent);
  const dark = characterMaterial(palette.dark);
  if (role === "rusher") {
    mesh(new THREE.TorusGeometry(0.34, 0.075, 7, 16), accent, root, [0, 1.78, 0], [Math.PI / 2, 0, 0]);
    [-1, 1].forEach((side) => mesh(new THREE.ConeGeometry(0.12, 0.46, 4), accent, root, [side * 0.35, 1.3, -0.25], [Math.PI / 2, 0, side * 0.28]));
  } else if (role === "heavy") {
    mesh(new THREE.BoxGeometry(0.88, 0.52, 0.22), dark, root, [0, 1.38, -0.45]);
    mesh(new THREE.BoxGeometry(0.48, 0.48, 0.12), accent, root, [0, 1.45, 0.52], [0, 0, Math.PI / 4]);
  } else if (role === "scout") {
    mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.1, 12), dark, root, [0, 2.48, 0]);
    mesh(new THREE.BoxGeometry(0.42, 0.06, 0.22), accent, root, [0, 2.46, 0.31]);
    mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.42, 8), accent, root, [-0.28, 2.47, -0.08], [0, 0, -0.2]);
  } else if (role === "boss") {
    [-1, 0, 1].forEach((offset) => mesh(new THREE.ConeGeometry(0.12, 0.38 + Math.abs(offset) * -0.08, 5), accent, root, [offset * 0.24, 2.7 - Math.abs(offset) * 0.04, -0.05]));
    mesh(new THREE.TorusGeometry(0.51, 0.06, 8, 20), accent, root, [0, 1.38, 0.48]);
  } else {
    mesh(new THREE.BoxGeometry(0.16, 0.34, 0.14), accent, root, [-profile.shoulderX - 0.03, 2.04, 0]);
    mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.35, 6), accent, root, [-profile.shoulderX - 0.03, 2.31, 0]);
  }
}

function createFigure(role, type, palette, isBoss = false, faceIndex = 0) {
  const root = new THREE.Group();
  const profile = characterProfile(role);
  const scale = type.scale;
  root.scale.setScalar(scale);
  const torso = mesh(new THREE.CapsuleGeometry(profile.chestRadius, profile.chestLength, 5, 10), characterMaterial(palette.body), root, [0, 1.38, 0]);
  torso.scale.set(profile.chestWidth, 1, profile.chestDepth);
  const hips = mesh(new THREE.CapsuleGeometry(profile.chestRadius * 0.72, 0.14, 4, 8), characterMaterial(palette.dark), root, [0, 0.94, 0]);
  hips.rotation.z = Math.PI / 2; hips.scale.z = profile.chestDepth;
  const vest = mesh(new THREE.BoxGeometry(profile.chestRadius * profile.chestWidth * 1.45, 0.42, profile.chestRadius * profile.chestDepth * 1.78), characterMaterial(palette.dark), root, [0, 1.43, 0.04]);
  mesh(new THREE.BoxGeometry(profile.chestRadius * profile.chestWidth * 1.05, 0.11, profile.chestRadius * profile.chestDepth * 1.92), characterMaterial(palette.accent, palette.accent), root, [0, 1.55, 0.05]);
  const { faceRoot, head, hair, visor } = addCartoonFace(root, profile, palette, faceIndex, isBoss);
  addRoleGear(root, role, profile, palette);

  const leftArm = articulatedArm(root, profile, palette, -1);
  const rightArm = articulatedArm(root, profile, palette, 1);
  const leftShoulder = mesh(new THREE.SphereGeometry(profile.armRadius * 1.4, 10, 7), characterMaterial(palette.accent), root, [-profile.shoulderX, 1.72, 0]);
  const rightShoulder = mesh(new THREE.SphereGeometry(profile.armRadius * 1.4, 10, 7), characterMaterial(palette.accent), root, [profile.shoulderX, 1.72, 0]);

  const leftLeg = articulatedLeg(root, profile, palette, -1);
  const rightLeg = articulatedLeg(root, profile, palette, 1);

  const weaponGroup = new THREE.Group();
  weaponGroup.position.set(0.08, 1.45, 0.49); root.add(weaponGroup);
  mesh(new THREE.BoxGeometry(profile.weaponWidth, role === "heavy" || isBoss ? 0.25 : 0.18, profile.weaponLength), characterMaterial(0x193b4b), weaponGroup, [0, 0, profile.weaponLength * 0.2]);
  mesh(new THREE.BoxGeometry(profile.weaponWidth * 0.62, 0.12, profile.weaponLength * 0.48), characterMaterial(palette.accent, palette.accent), weaponGroup, [0, 0.13, profile.weaponLength * 0.05]);
  if (role === "scout") mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.28, 10), characterMaterial(0x102b38), weaponGroup, [0, 0.24, 0], [0, 0, Math.PI / 2]);
  if (role === "heavy" || isBoss) [-1, 1].forEach((side) => mesh(new THREE.CylinderGeometry(0.055, 0.055, profile.weaponLength * 0.72, 8), characterMaterial(0x102b38), weaponGroup, [side * profile.weaponWidth * 0.28, 0, profile.weaponLength * 0.48], [Math.PI / 2, 0, 0]));
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0, profile.weaponLength * 0.75); weaponGroup.add(muzzle);
  const botMuzzleFlash = mesh(new THREE.IcosahedronGeometry(isBoss ? 0.15 : 0.1, 0), new THREE.MeshBasicMaterial({ color: 0xffdf72, transparent: true, opacity: 0 }), weaponGroup, [0, 0, profile.weaponLength * 0.78]);
  root.userData.rig = {
    torso, torsoBaseScale: torso.scale.clone(), hips, vest, faceRoot, head, hair, visor, leftShoulder, rightShoulder,
    leftArm: leftArm.pivot, rightArm: rightArm.pivot, leftElbow: leftArm.elbow, rightElbow: rightArm.elbow,
    leftLeg: leftLeg.pivot, rightLeg: rightLeg.pivot, leftKnee: leftLeg.knee, rightKnee: rightLeg.knee,
    weapon: weaponGroup, weaponBaseZ: weaponGroup.position.z, muzzle, botMuzzleFlash, profile
  };
  return root;
}

function createBot(index, spawn) {
  const role = state.arena.roles[index];
  const type = BOT_TYPES[role];
  const isBoss = role === "boss";
  const floor = isBoss ? state.arena.floors - 1 : index % state.arena.floors;
  const palettes = [
    { body: type.color, dark: 0x263c54, accent: 0xffda64, skin: 0xf0b88b },
    { body: type.color, dark: 0x46344d, accent: 0x5be1b0, skin: 0xb87557 },
    { body: type.color, dark: 0x263e4e, accent: 0x55d6e8, skin: 0xe5a376 }
  ];
  const figure = createFigure(role, type, palettes[index % palettes.length], isBoss, isBoss ? 2 : index % faceUrls.length);
  actorLayer.add(figure);
  const bot = {
    id: index, name: isBoss ? "Atlas" : ["Rook", "Vex", "Pico", "Dash", "Mako"][index], role, type, figure,
    x: spawn.x, z: spawn.z, floor, hp: type.hp, maxHp: type.hp, shield: type.shield || 0, maxShield: type.shield || 0,
    alive: true, death: 0, phase: 1, state: "patrol", target: { x: spawn.x, z: spawn.z }, patrolAngle: index * 1.2,
    shootTimer: (0.6 + Math.random() * 0.65) / (1 + (state.challenge - 1) * 0.8),
    hurt: 0, flash: 0, anim: Math.random() * TAU, radius: 0.23, aiming: false
  };
  figure.traverse((child) => { if (child.isMesh) child.userData.bot = bot; });
  positionBot(bot);
  if (isBoss) {
    const shield = mesh(new THREE.SphereGeometry(1.5, 24, 16), new THREE.MeshPhysicalMaterial({ color: 0x55dce8, transparent: true, opacity: 0.22, roughness: 0.1, metalness: 0.05, side: THREE.DoubleSide }), figure, [0, 1.25, 0]);
    shield.scale.y = 1.22; shield.castShadow = false; bot.shieldMesh = shield;
  }
  return bot;
}

function positionBot(bot) {
  bot.figure.position.set(toWorldX(bot.x), floorY(bot.floor), toWorldZ(bot.z));
}

function createWeaponRig() {
  if (weaponRig) camera.remove(weaponRig);
  weaponRig = new THREE.Group();
  const cap = captain();
  const armMat = material(cap.skin, 0.65);
  const sleeveMat = material(Number(cap.body.replace("#", "0x")), 0.52);
  viewArms = [];
  [-1, 1].forEach((side) => {
    const arm = new THREE.Group();
    arm.position.set(side * 0.31, -0.34, -0.61);
    mesh(new THREE.CapsuleGeometry(0.105, 0.35, 5, 8), sleeveMat, arm, [0, 0, 0], [0.34, 0, side * -0.12]);
    mesh(new THREE.SphereGeometry(0.115, 12, 8), armMat, arm, [side * -0.02, -0.24, -0.03]);
    weaponRig.add(arm); viewArms.push(arm);
  });
  const gun = new THREE.Group();
  const long = player.weapon === 1;
  gun.position.set(0.18, -0.24, -0.66);
  mesh(new THREE.BoxGeometry(0.24, 0.23, long ? 0.82 : 0.52), material(0x244f60, 0.28, 0.32, 0x0b1b22), gun);
  mesh(new THREE.BoxGeometry(0.255, 0.12, long ? 0.45 : 0.3), material(Number(cap.accent.replace("#", "0x")), 0.3, 0.12, Number(cap.accent.replace("#", "0x"))), gun, [0, 0.11, -0.08]);
  mesh(new THREE.BoxGeometry(0.19, 0.36, 0.15), material(0x21303d, 0.5), gun, [0, -0.2, 0.08], [0.12, 0, 0]);
  muzzleFlash = mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe596, transparent: true, opacity: 0 }), gun, [0, 0, long ? -0.47 : -0.32]);
  muzzleFlash.scale.set(1.8, 0.8, 0.8); muzzleFlash.castShadow = false;
  weaponRig.add(gun); weaponRig.userData.gun = gun;
  weaponRig.scale.setScalar(0.4);
  weaponRig.position.set(0.08, -0.18, -0.56);
  camera.add(weaponRig);
  if (!camera.parent) scene.add(camera);
}

function setMode(mode) {
  state.mode = mode;
  ui.menu.classList.toggle("hidden", mode !== "menu");
  ui.pausePanel.classList.toggle("hidden", mode !== "paused");
  ui.upgradePanel.classList.toggle("hidden", mode !== "upgrade");
  ui.roundPanel.classList.toggle("hidden", !["won", "lost"].includes(mode));
  ui.hud.classList.toggle("hidden", !["playing", "upgrade"].includes(mode));
  ui.crosshair.classList.toggle("hidden", mode !== "playing");
  if (mode !== "playing") ui.interactionPrompt.classList.add("hidden");
}

function announce(title, subtitle = "", duration = 1.2) {
  ui.announcement.innerHTML = `${title}${subtitle ? `<span>${subtitle}</span>` : ""}`;
  ui.announcement.classList.remove("hidden");
  state.announcementTime = duration;
}

function resetRound() {
  state.challenge = challengeForArena(state.arenaIndex, state.arenaRecords[state.arenaIndex]);
  buildArena(state.arenaIndex);
  Object.assign(player, {
    x: state.arena.spawn.x, z: state.arena.spawn.z, floor: 0, yaw: state.arena.spawn.yaw, pitch: 0, yOffset: 0, vy: 0,
    grounded: true, jumpCooldown: 0, vx: 0, vz: 0, health: 100, maxHealth: 100, speedBonus: 0, weapon: 0,
    ammo: WEAPONS.map((item) => item.mag), reserve: WEAPONS.map((item) => item.reserve), cooldown: 0, reloading: 0,
    reloadScale: 1, damageScale: 1, recoil: 0, bob: 0, liftCooldown: 0, healthKits: 0, upgrades: []
  });
  state.score = 0; state.kills = 0; state.objectiveProgress = 0; state.objectiveComplete = false;
  state.timeLeft = ROUND_TIME; state.elapsed = 0; state.countdown = 2.6; state.upgradeStops = new Set(); state.effects = [];
  state.shake = 0; state.damageFlash = 0; state.hitFlash = 0; state.floorFade = 0;
  state.hudTimer = 0; state.radarTimer = 0; syncFloorVisibility(); createWeaponRig(); updateCamera(); updateHud(); drawRadar();
}

function startRound() {
  initAudio();
  if (state.nextArenaIndex !== null) { state.arenaIndex = state.nextArenaIndex; state.nextArenaIndex = null; }
  resetRound();
  if (state.matchStarts > 0) state.metrics.replays += 1;
  state.matchStarts += 1; state.metrics.starts += 1; saveMetrics();
  setMode("playing");
  announce("3", `${state.arena.subtitle} · ${state.arena.name}`, 2.6);
  requestPointer();
}

function requestPointer() {
  if (document.pointerLockElement !== renderer.domElement) renderer.domElement.requestPointerLock?.().catch?.(() => {});
}

function pauseGame() {
  if (state.mode !== "playing") return;
  state.keys = Object.create(null); state.shootHeld = false;
  document.exitPointerLock?.(); setMode("paused");
}

function resumeGame() {
  if (state.mode !== "paused") return;
  setMode("playing"); requestPointer();
}

function currentLift() {
  return state.arena.lifts.find((lift) => Math.hypot(player.x - lift.x, player.z - lift.z) < 0.82) || null;
}

function useLift() {
  if (state.mode !== "playing" || player.liftCooldown > 0 || !player.grounded || !currentLift()) return false;
  player.floor = (player.floor + 1) % state.arena.floors;
  player.liftCooldown = 0.75; player.vx = 0; player.vz = 0; state.floorFade = 0.7;
  announce(`Deck ${player.floor + 1}`, state.arena.name, 0.85); playTone("lift");
  syncFloorVisibility(); updateCamera(); updateHud(); drawRadar(); return true;
}

function jump() {
  if (state.mode !== "playing" || !player.grounded || player.jumpCooldown > 0) return false;
  player.grounded = false; player.vy = 5.2; player.jumpCooldown = 0.18; playTone("jump"); return true;
}

function switchWeapon(index) {
  if (state.mode !== "playing" || !WEAPONS[index]) return;
  player.weapon = index; player.reloading = 0; player.cooldown = Math.min(player.cooldown, 0.12); createWeaponRig(); playTone("switch"); updateHud();
}

function reload() {
  const current = weapon();
  if (state.mode !== "playing" || player.reloading > 0 || player.ammo[player.weapon] >= current.mag || player.reserve[player.weapon] <= 0) return;
  player.reloading = current.reload * player.reloadScale; playTone("reload"); updateHud();
}

function finishReload() {
  const current = weapon(); const needed = current.mag - player.ammo[player.weapon]; const amount = Math.min(needed, player.reserve[player.weapon]);
  player.ammo[player.weapon] += amount; player.reserve[player.weapon] -= amount; player.reloading = 0; updateHud();
}

function shoot() {
  if (state.mode !== "playing" || state.countdown > 0 || player.cooldown > 0 || player.reloading > 0) return false;
  const current = weapon();
  if (player.ammo[player.weapon] <= 0) { reload(); playTone("empty"); return false; }
  player.ammo[player.weapon] -= 1; player.cooldown = current.interval; player.recoil = Math.min(0.16, player.recoil + current.recoil);
  state.shake = state.reducedMotion ? 0 : (player.weapon ? 0.055 : 0.035); muzzleFlash.material.opacity = 1; muzzleFlash.scale.setScalar(1 + Math.random() * 1.4);
  playTone(current.id);
  camera.updateMatrixWorld(); raycaster.setFromCamera(center, camera);
  const spread = current.spread + player.recoil * 0.05;
  raycaster.ray.direction.x += (Math.random() - 0.5) * spread;
  raycaster.ray.direction.y += (Math.random() - 0.5) * spread;
  raycaster.ray.direction.z += (Math.random() - 0.5) * spread;
  raycaster.ray.direction.normalize();
  const shootables = [...state.walls, ...state.bots.filter((bot) => bot.alive && bot.floor === player.floor).flatMap((bot) => {
    const items = []; bot.figure.traverse((child) => { if (child.isMesh) items.push(child); }); return items;
  })];
  const hit = raycaster.intersectObjects(shootables, false)[0];
  const wallHit = raycaster.intersectObjects(state.walls, false)[0];
  let volumeTarget = null; let volumeDistance = wallHit?.distance ?? 35;
  for (const candidate of state.bots) {
    if (!candidate.alive || candidate.floor !== player.floor || !hasLineOfSight(player, candidate)) continue;
    const targetPoint = candidate.figure.position.clone().add(new THREE.Vector3(0, candidate.role === "boss" ? 1.9 : 1.35, 0));
    const along = targetPoint.clone().sub(raycaster.ray.origin).dot(raycaster.ray.direction);
    const radius = (candidate.role === "boss" ? 1.05 : 0.62) * candidate.type.scale;
    if (along > 0 && along < volumeDistance && raycaster.ray.distanceSqToPoint(targetPoint) < radius * radius) { volumeTarget = candidate; volumeDistance = along; }
  }
  const start = new THREE.Vector3(); const end = new THREE.Vector3();
  camera.getWorldPosition(start); end.copy(hit?.point || raycaster.ray.at(35, new THREE.Vector3()));
  const bot = volumeTarget || hit?.object?.userData?.bot;
  if (volumeTarget) end.copy(raycaster.ray.at(volumeDistance, new THREE.Vector3()));
  createTracer(start, end, bot ? 0x66f1b9 : 0xffdc72);
  if (bot?.alive && bot.floor === player.floor) {
    damageBot(bot, (current.damage + Math.random() * 5) * player.damageScale);
    burstAt(end, bot.shield > 0 ? 0x62dbe7 : 0xffd96b); return true;
  }
  burstAt(end, 0xffc85d, 4); return false;
}

function createTracer(start, end, color) {
  const direction = end.clone().sub(start); const length = direction.length();
  const tracer = mesh(new THREE.CylinderGeometry(0.018, 0.018, Math.min(length, 18), 5), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 }), effectLayer);
  const midpoint = start.clone().add(end).multiplyScalar(0.5); tracer.position.copy(midpoint);
  tracer.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  tracer.userData.effect = { life: 0.07, type: "fade" }; state.effects.push(tracer);
}

function burstAt(position, color, count = 7) {
  for (let index = 0; index < count; index += 1) {
    const particle = mesh(new THREE.IcosahedronGeometry(0.045 + Math.random() * 0.04, 0), new THREE.MeshBasicMaterial({ color }), effectLayer);
    particle.position.copy(position);
    particle.userData.effect = { life: 0.3 + Math.random() * 0.15, type: "particle", velocity: new THREE.Vector3((Math.random() - 0.5) * 2.5, Math.random() * 2, (Math.random() - 0.5) * 2.5) };
    state.effects.push(particle);
  }
}

function damageBot(bot, amount) {
  if (!bot.alive) return;
  if (bot.shield > 0) {
    const absorbed = Math.min(bot.shield, amount); bot.shield -= absorbed; amount -= absorbed;
    if (bot.shield <= 0) { bot.shieldMesh.visible = false; announce("Shield shattered", "Atlas exposed", 1); playTone("shield"); }
  }
  bot.hp -= amount; bot.hurt = 0.18; state.hitFlash = 0.12; state.score += 15; playTone("hit");
  if (bot.role === "boss" && bot.hp > 0) {
    const phase = bot.hp < bot.maxHp * 0.34 ? 3 : bot.hp < bot.maxHp * 0.67 ? 2 : 1;
    if (phase > bot.phase) { bot.phase = phase; announce(`Atlas phase ${phase}`, phase === 3 ? "Final form" : "Armor released", 1.1); playTone("phase"); }
  }
  if (bot.hp <= 0) defeatBot(bot);
  updateHud();
}

function defeatBot(bot) {
  bot.alive = false; bot.hp = 0; bot.death = 1; state.kills += 1; state.score += bot.role === "boss" ? 350 : 100;
  toyBurst(bot); playTone("death");
  if (state.arena.objective.type === "eliminate") state.objectiveProgress = state.kills;
  checkWin();
  if (state.mode === "playing" && [2, 4].includes(state.kills) && !state.upgradeStops.has(state.kills)) offerUpgrade();
}

function toyBurst(bot) {
  const position = bot.figure.position.clone().add(new THREE.Vector3(0, 1.1, 0));
  [0xef675d, 0x173d4c, 0xffd85c, 0x55dce8, 0xffffff].forEach((color, index) => {
    const part = mesh(index % 2 ? new THREE.BoxGeometry(0.28, 0.28, 0.28) : new THREE.SphereGeometry(0.18, 8, 6), material(color, 0.5), effectLayer);
    part.position.copy(position); part.position.x += (index - 2) * 0.12;
    part.userData.effect = { life: 1.1, type: "toy", velocity: new THREE.Vector3((Math.random() - 0.5) * 3, 2 + Math.random() * 2.5, (Math.random() - 0.5) * 3), spin: new THREE.Vector3(Math.random() * 5, Math.random() * 5, Math.random() * 5) };
    state.effects.push(part);
  });
}

function damagePlayer(amount, source = null) {
  if (state.mode !== "playing" || state.countdown > 0) return;
  player.health = Math.max(0, player.health - amount); state.damageFlash = 0.28; state.shake = state.reducedMotion ? 0 : 0.1; playTone("hurt");
  if (player.health <= 0) finishRound(false, "Your captain was knocked out of the match.");
  updateHud();
}

function offerUpgrade() {
  state.upgradeStops.add(state.kills);
  const available = UPGRADES.filter((item) => !player.upgrades.includes(item.id)).sort(() => Math.random() - 0.5).slice(0, 3);
  ui.upgradeChoices.innerHTML = available.map((item) => `<button class="upgrade-choice" data-upgrade="${item.id}"><strong>${item.name}</strong><span>${item.detail}</span></button>`).join("");
  document.exitPointerLock?.(); setMode("upgrade");
}

function chooseUpgrade(id) {
  if (state.mode !== "upgrade") return;
  if (id === "overcharge") player.damageScale *= 1.25;
  if (id === "quick") player.reloadScale *= 0.7;
  if (id === "reinforced") { player.maxHealth += 25; player.health += 25; }
  if (id === "fleet") player.speedBonus += 0.48;
  if (id === "deep") player.reserve = player.reserve.map((amount) => amount + Math.ceil(amount * 0.5));
  player.upgrades.push(id); setMode("playing"); announce(UPGRADES.find((item) => item.id === id)?.name || "Upgrade", "Captain perk equipped", 0.9); checkWin();
  if (state.mode === "playing") requestPointer(); updateHud();
}

function updatePlayer(dt) {
  player.cooldown = Math.max(0, player.cooldown - dt);
  player.jumpCooldown = Math.max(0, player.jumpCooldown - dt);
  player.liftCooldown = Math.max(0, player.liftCooldown - dt);
  player.recoil = Math.max(0, player.recoil - dt * 0.15);
  if (player.reloading > 0) { player.reloading -= dt; if (player.reloading <= 0) finishReload(); }
  if (!player.grounded) {
    player.vy -= 13.5 * dt; player.yOffset += player.vy * dt;
    if (player.yOffset <= 0) { player.yOffset = 0; player.vy = 0; player.grounded = true; playTone("land"); state.shake = state.reducedMotion ? 0 : 0.045; }
  }
  const forward = (state.keys.KeyW ? 1 : 0) - (state.keys.KeyS ? 1 : 0);
  const strafe = (state.keys.KeyD ? 1 : 0) - (state.keys.KeyA ? 1 : 0);
  const speed = player.speed + player.speedBonus;
  const velocity = movementVelocity(player.yaw, forward, strafe, speed);
  player.vx = velocity.x; player.vz = velocity.z;
  moveEntity(player, player.vx * dt, player.vz * dt);
  if (Math.hypot(player.vx, player.vz) > 0.2 && player.grounded) player.bob += dt * 11;
  if (state.shootHeld && weapon().auto) shoot();
  collectProps(dt); updateCamera();
}

function updateCamera() {
  const bob = player.grounded && !state.reducedMotion ? Math.sin(player.bob) * Math.min(0.045, Math.hypot(player.vx, player.vz) * 0.012) : 0;
  camera.position.set(toWorldX(player.x), floorY(player.floor) + EYE_HEIGHT + player.yOffset + bob, toWorldZ(player.z));
  camera.rotation.y = player.yaw; camera.rotation.x = player.pitch + player.recoil * 0.16;
  if (weaponRig) {
    const moving = Math.min(1, Math.hypot(player.vx, player.vz) / 3);
    weaponRig.position.x = 0.08 + Math.sin(player.bob * 0.5) * 0.018 * moving;
    weaponRig.position.y = -0.18 + Math.abs(Math.cos(player.bob * 0.5)) * -0.012 * moving - player.recoil * 0.55;
    weaponRig.rotation.z = Math.sin(player.bob * 0.5) * 0.015 * moving;
    if (player.reloading > 0) weaponRig.rotation.z += Math.sin((player.reloading / Math.max(0.1, weapon().reload * player.reloadScale)) * Math.PI) * 0.55;
  }
}

function collectProps(dt) {
  for (const prop of state.props) {
    if (!prop.userData.active || prop.userData.floor !== player.floor) continue;
    prop.rotation.y += dt * 1.4;
    if (prop.userData.baseY) prop.position.y = prop.userData.baseY + Math.sin(performance.now() * 0.003 + (prop.userData.index || 0)) * 0.08;
    const dist = Math.hypot(player.x - prop.userData.x, player.z - prop.userData.z);
    if (prop.userData.type === "health" && dist < 0.58 && player.health < player.maxHealth) {
      player.health = Math.min(player.maxHealth, player.health + 40); player.healthKits += 1; prop.userData.active = false; prop.visible = false; state.score += 30; playTone("heal"); announce("Integrity restored", "+40 shell strength", 0.65);
    }
    if (prop.userData.type === "objective" && dist < 0.62) {
      prop.userData.active = false; prop.visible = false; state.objectiveProgress += 1; state.score += 75; playTone("objective"); announce("Prize captured", `${state.objectiveProgress}/${state.arena.objective.goal}`, 0.65);
      if (state.objectiveProgress >= state.arena.objective.goal) state.objectiveComplete = true;
    }
    if (prop.userData.type === "zone") {
      prop.userData.lamp.material.emissiveIntensity = 0.8 + Math.sin(performance.now() * 0.006) * 0.35;
      if (dist < 1.05 && player.floor === prop.userData.floor && state.countdown <= 0) {
        state.objectiveProgress = Math.min(state.arena.objective.goal, state.objectiveProgress + dt);
        if (state.objectiveProgress >= state.arena.objective.goal && !state.objectiveComplete) { state.objectiveComplete = true; state.score += 200; announce("Relay secured", "Hold complete", 0.9); playTone("objective"); }
      }
    }
  }
  if (state.arena.objective.type === "collect" && state.objectiveProgress >= state.arena.objective.goal) state.objectiveComplete = true;
  checkWin();
}

function updateBots(dt) {
  const speedScale = clamp(1 + (state.challenge - 1) * 0.6, 0.95, 1.32);
  const cadenceScale = clamp(1 + (state.challenge - 1) * 0.8, 0.94, 1.44);
  const detectionRange = clamp(9.5 + (state.challenge - 1) * 5, 9.1, 12.25);
  for (const bot of state.bots) {
    bot.anim += dt * (bot.alive ? 5 : 2); bot.hurt = Math.max(0, bot.hurt - dt); bot.flash = Math.max(0, bot.flash - dt);
    const rig = bot.figure.userData.rig;
    if (!bot.alive) {
      bot.death = Math.max(0, bot.death - dt * 0.95);
      const fall = 1 - bot.death;
      const baseScale = bot.type.scale;
      bot.figure.scale.set(baseScale * (1 + fall * 0.08), baseScale * Math.max(0.5, 1 - fall * 0.45), baseScale * (1 + fall * 0.08));
      bot.figure.rotation.z = (bot.id % 2 ? -1 : 1) * Math.min(1, fall * 1.35) * 1.25;
      bot.figure.rotation.x = -Math.min(1, fall * 1.6) * 0.28;
      if (bot.death <= 0) bot.figure.visible = false;
      continue;
    }
    const sameFloor = bot.floor === player.floor;
    const dist = Math.hypot(bot.x - player.x, bot.z - player.z);
    const sees = sameFloor && dist < detectionRange && hasLineOfSight(bot, player);
    let moving = false;
    if (sees && state.countdown <= 0) {
      bot.state = "attack";
      const phasePower = bot.role === "boss" ? 1 + (bot.phase - 1) * 0.2 : 1;
      const desired = bot.role === "rusher" ? 1.7 : bot.role === "scout" ? 5 : 3.6;
      if (dist > desired) {
        const dx = (player.x - bot.x) / Math.max(dist, 0.001); const dz = (player.z - bot.z) / Math.max(dist, 0.001);
        moveEntity(bot, dx * bot.type.speed * speedScale * phasePower * dt, dz * bot.type.speed * speedScale * phasePower * dt); moving = true;
      } else {
        const orbit = (bot.id % 2 ? 1 : -1) * bot.type.speed * speedScale * 0.35 * dt;
        moveEntity(bot, -(player.z - bot.z) / Math.max(dist, .01) * orbit, (player.x - bot.x) / Math.max(dist, .01) * orbit); moving = true;
      }
      bot.figure.rotation.y = Math.atan2(player.x - bot.x, player.z - bot.z);
      bot.shootTimer -= dt;
      if (bot.shootTimer <= 0) { botShoot(bot, dist); bot.shootTimer = bot.type.cadence / (phasePower * cadenceScale) * (0.75 + Math.random() * 0.45); }
    } else {
      bot.state = "patrol"; bot.patrolAngle += dt * 0.45;
      const home = state.arena.botSpawns[bot.id];
      const tx = home.x + Math.cos(bot.patrolAngle) * 1.1; const tz = home.z + Math.sin(bot.patrolAngle) * 1.1;
      const pd = Math.hypot(tx - bot.x, tz - bot.z);
      if (pd > 0.12) { moveEntity(bot, (tx - bot.x) / pd * bot.type.speed * 0.42 * dt, (tz - bot.z) / pd * bot.type.speed * 0.42 * dt); moving = true; bot.figure.rotation.y = Math.atan2(tx - bot.x, tz - bot.z); }
    }
    positionBot(bot);
    const profile = rig.profile;
    const hit = clamp(bot.hurt / 0.18, 0, 1);
    const stride = moving ? Math.sin(bot.anim) * profile.gait : 0;
    const aiming = sees && state.countdown <= 0;
    const baseScale = bot.type.scale;
    bot.figure.scale.set(baseScale * (1 + hit * 0.06), baseScale * (1 - hit * 0.08), baseScale * (1 + hit * 0.06));
    bot.figure.rotation.z = (bot.id % 2 ? -1 : 1) * hit * 0.07;
    bot.figure.rotation.x = 0;

    rig.leftLeg.rotation.x = stride;
    rig.rightLeg.rotation.x = -stride;
    rig.leftKnee.rotation.x = 0.08 + Math.max(0, -stride) * 0.5;
    rig.rightKnee.rotation.x = 0.08 + Math.max(0, stride) * 0.5;
    if (aiming) {
      rig.leftArm.rotation.set(-0.78, 0, 0.38);
      rig.rightArm.rotation.set(-0.78, 0, -0.38);
      rig.leftElbow.rotation.set(-0.62, 0, -0.08);
      rig.rightElbow.rotation.set(-0.62, 0, 0.08);
    } else {
      rig.leftArm.rotation.set(-stride * 0.45, 0, 0.12);
      rig.rightArm.rotation.set(stride * 0.45, 0, -0.12);
      rig.leftElbow.rotation.set(0.08 + Math.abs(stride) * 0.12, 0, 0);
      rig.rightElbow.rotation.set(0.08 + Math.abs(stride) * 0.12, 0, 0);
    }
    const breath = Math.sin(bot.anim * 0.42) * 0.012;
    rig.torso.scale.copy(rig.torsoBaseScale); rig.torso.scale.y *= 1 + breath;
    rig.torso.rotation.z = hit * (bot.id % 2 ? -0.12 : 0.12) + Math.sin(bot.anim * 0.3) * 0.012;
    rig.hips.rotation.y = moving ? Math.sin(bot.anim) * 0.08 : 0;
    rig.faceRoot.position.y = 2.17 + (moving ? Math.abs(Math.sin(bot.anim)) * 0.025 : breath * 0.7);
    rig.faceRoot.rotation.z = hit * (bot.id % 2 ? 0.16 : -0.16);
    rig.weapon.position.z = rig.weaponBaseZ - (bot.flash > 0 ? 0.07 : 0);
    rig.weapon.rotation.x = bot.flash > 0 ? -0.1 : 0;
    rig.botMuzzleFlash.material.opacity = clamp(bot.flash * 12, 0, 1);
    rig.botMuzzleFlash.scale.setScalar(0.8 + clamp(bot.flash * 10, 0, 1) * 1.6);
    if (bot.shieldMesh) { bot.shieldMesh.visible = bot.shield > 0; bot.shieldMesh.rotation.y += dt * 0.45; }
    if (bot.role === "boss") {
      const phaseColor = [0xde4456, 0xf07843, 0xffcf55][bot.phase - 1];
      rig.torso.material.color.setHex(phaseColor); rig.visor.material.emissive.setHex(phaseColor); rig.visor.material.emissiveIntensity = 0.8 + bot.phase * 0.35;
      rig.leftShoulder.visible = bot.phase < 3; rig.rightShoulder.visible = bot.phase < 2; rig.vest.rotation.z = bot.phase === 3 ? 0.06 : 0;
    }
  }
}

function botShoot(bot, dist) {
  bot.flash = 0.1; playTone("bot");
  const start = new THREE.Vector3(); bot.figure.userData.rig.muzzle.getWorldPosition(start);
  const target = camera.position.clone(); createTracer(start, target, bot.role === "boss" ? 0xff6b59 : 0xf4a654);
  const mercy = player.health < 30 ? 0.72 : 1;
  const accuracyBonus = (state.challenge - 1) * 0.16;
  const damageScale = clamp(1 + (state.challenge - 1) * 0.65, 0.95, 1.36);
  const chance = clamp((bot.type.accuracy + accuracyBonus - dist * 0.045) * mercy, 0.2, 0.87);
  if (Math.random() < chance) damagePlayer(Math.round(bot.type.damage * damageScale * (0.82 + Math.random() * 0.36) * (bot.role === "boss" ? 1 + (bot.phase - 1) * 0.16 : 1)), bot);
}

function updateEffects(dt) {
  for (const effect of state.effects) {
    const data = effect.userData.effect; if (!data) continue; data.life -= dt;
    if (data.type === "fade") effect.material.opacity = clamp(data.life / 0.07, 0, 1);
    if (data.velocity) { data.velocity.y -= 8 * dt; effect.position.addScaledVector(data.velocity, dt); }
    if (data.spin) { effect.rotation.x += data.spin.x * dt; effect.rotation.y += data.spin.y * dt; effect.rotation.z += data.spin.z * dt; }
    if (data.type === "toy" && effect.position.y < floorY(player.floor) + 0.12) { effect.position.y = floorY(player.floor) + 0.12; data.velocity.y *= -0.35; data.velocity.x *= 0.7; data.velocity.z *= 0.7; }
  }
  state.effects = state.effects.filter((effect) => {
    if (effect.userData.effect?.life > 0) return true;
    effectLayer.remove(effect); effect.geometry?.dispose?.(); effect.material?.dispose?.(); return false;
  });
  if (muzzleFlash) muzzleFlash.material.opacity = Math.max(0, muzzleFlash.material.opacity - dt * 20);
}

function checkWin() {
  if (state.mode !== "playing") return;
  const botsCleared = state.bots.every((bot) => !bot.alive);
  if (state.arena.objective.type === "eliminate") state.objectiveComplete = botsCleared;
  if (botsCleared && state.objectiveComplete) finishRound(true, `${state.arena.objective.label} complete.`);
}

function finishRound(won, reason) {
  if (state.mode !== "playing") return;
  document.exitPointerLock?.(); setMode(won ? "won" : "lost"); playTone(won ? "win" : "lose");
  state.metrics.completed += 1; if (won) state.metrics.wins += 1; state.metrics.fpsTotal += state.fps; state.metrics.fpsSamples += 1; saveMetrics();
  state.arenaRecords = recordArenaResult(state.arenaRecords, state.arenaIndex, won); saveArenaRecords();
  const finalScore = state.score + (won ? 250 + Math.ceil(state.timeLeft) * 3 : 0);
  if (finalScore > state.bestScore) { state.bestScore = finalScore; localStorage.setItem("tacticalArena.bestScore", String(finalScore)); }
  if (won && (!state.bestTime || state.elapsed < state.bestTime)) { state.bestTime = state.elapsed; localStorage.setItem("tacticalArena.fastestClear", String(state.bestTime)); }
  if (won) { state.nextArenaIndex = (state.arenaIndex + 1) % ARENAS.length; localStorage.setItem("snapLeague.campaign", String(state.nextArenaIndex)); }
  state.lastResult = { won, score: finalScore, arena: state.arena.name, level: state.arenaIndex + 1, kills: state.kills, time: state.elapsed, captain: captain().name };
  ui.roundKicker.textContent = won ? "League result · Victory" : "League result · Knockout";
  ui.roundTitle.textContent = won ? (state.nextArenaIndex === 0 ? "League Champion" : "Match Won") : "Match Lost";
  ui.roundSummary.textContent = reason;
  ui.scoreboard.innerHTML = [
    ["Captain", captain().name], ["Arena", state.arena.name], ["Rivals", `${state.kills} / ${state.bots.length}`], ["Score", finalScore],
    ["Clear time", `${state.elapsed.toFixed(1)}s`], ["Challenge", `${state.challenge.toFixed(2)}x`], ["Average FPS", state.fps]
  ].map(([label, value]) => `<div>${label}<strong>${value}</strong></div>`).join("");
  const arenaRecord = state.arenaRecords[state.arenaIndex];
  const arenaWinRate = arenaRecord.attempts ? Math.round(arenaRecord.wins / arenaRecord.attempts * 100) : 0;
  ui.benchmarkSummary.textContent = `Arena record ${arenaRecord.wins}-${arenaRecord.attempts - arenaRecord.wins} · ${arenaWinRate}% wins · target ${TARGET_WIN_RATE * 100}% · ${Math.round(state.metrics.fpsTotal / Math.max(1, state.metrics.fpsSamples))} average FPS`;
  ui.restartButton.textContent = won ? (state.nextArenaIndex === 0 ? "Restart League" : "Next Match") : "Retry Match";
  updateBestStats();
}

function updateHud() {
  const current = weapon();
  ui.healthText.textContent = String(Math.ceil(player.health));
  ui.healthBar.style.width = `${clamp(player.health / player.maxHealth, 0, 1) * 100}%`;
  ui.healthBar.style.background = player.health < 30 ? "#ef675d" : "#58e2aa";
  ui.ammoText.textContent = player.reloading > 0 ? "RELOADING" : `${player.ammo[player.weapon]} / ${player.reserve[player.weapon]}`;
  ui.weaponText.textContent = current.name;
  ui.captainText.textContent = captain().name;
  ui.levelText.textContent = `Match ${state.arenaIndex + 1}/${ARENAS.length} · Deck ${player.floor + 1}/${state.arena.floors}`;
  ui.arenaText.textContent = state.arena.name;
  ui.botsText.textContent = String(state.bots.filter((bot) => bot.alive).length);
  ui.timerText.textContent = formatTime(state.timeLeft);
  ui.scoreText.textContent = String(state.score);
  const objective = state.arena.objective;
  ui.objectiveText.textContent = objective.type === "eliminate" ? `${objective.label} · ${state.kills}/${state.bots.length}` : objective.type === "collect" ? `${objective.label} · ${state.objectiveProgress}/${objective.goal}` : `${objective.label} · ${Math.floor(state.objectiveProgress)}/${objective.goal}s`;
  const nearLift = state.mode === "playing" && player.liftCooldown <= 0 && currentLift();
  ui.interactionPrompt.classList.toggle("hidden", !nearLift);
  if (nearLift) ui.interactionPrompt.querySelector("span").textContent = `Lift to deck ${(player.floor + 1) % state.arena.floors + 1}`;
  ui.muteButton.textContent = state.muted ? "×" : "♪";
  ui.muteButton.title = state.muted ? "Unmute audio" : "Mute audio";
  const boss = state.bots.find((bot) => bot.role === "boss");
  ui.bossHud.classList.toggle("hidden", !boss || !boss.alive || !["playing", "upgrade"].includes(state.mode));
  if (boss) {
    ui.bossHealthBar.style.width = `${clamp(boss.hp / boss.maxHp, 0, 1) * 100}%`;
    ui.bossShieldBar.style.width = `${clamp(boss.shield / Math.max(1, boss.maxShield), 0, 1) * 100}%`;
    ui.bossPhaseText.textContent = boss.shield > 0 ? "Shielded" : `Phase ${boss.phase}`;
  }
}

function drawRadar() {
  const size = radar.width; const width = state.arena.grid[0].length; const height = state.arena.grid.length; const scale = Math.min(size / width, size / height);
  radarCtx.clearRect(0, 0, size, size); radarCtx.fillStyle = "#071e29"; radarCtx.fillRect(0, 0, size, size);
  radarCtx.save(); radarCtx.translate((size - width * scale) / 2, (size - height * scale) / 2);
  for (let z = 0; z < height; z += 1) for (let x = 0; x < width; x += 1) {
    radarCtx.fillStyle = state.arena.grid[z][x] === "1" ? "#466371" : "#102f3c";
    radarCtx.fillRect(x * scale, z * scale, scale - 0.5, scale - 0.5);
  }
  state.arena.lifts.forEach((lift) => { radarCtx.strokeStyle = "#70e3eb"; radarCtx.lineWidth = 2; radarCtx.strokeRect(lift.x * scale - 3, lift.z * scale - 3, 6, 6); });
  state.props.forEach((prop) => {
    if (!prop.userData.active || prop.userData.floor !== player.floor) return;
    radarCtx.fillStyle = prop.userData.type === "health" ? "#58e2aa" : prop.userData.type === "objective" ? "#ffd85c" : "#8d79ec";
    radarCtx.beginPath(); radarCtx.arc(prop.userData.x * scale, prop.userData.z * scale, 3, 0, TAU); radarCtx.fill();
  });
  state.bots.forEach((bot) => {
    if (!bot.alive || bot.floor !== player.floor) return;
    radarCtx.fillStyle = bot.role === "boss" ? "#ff4057" : "#ef7a63"; radarCtx.beginPath(); radarCtx.arc(bot.x * scale, bot.z * scale, bot.role === "boss" ? 4.5 : 3, 0, TAU); radarCtx.fill();
  });
  radarCtx.fillStyle = "#fffdf3"; radarCtx.beginPath(); radarCtx.arc(player.x * scale, player.z * scale, 3.6, 0, TAU); radarCtx.fill();
  radarCtx.strokeStyle = "#ffd85c"; radarCtx.lineWidth = 2; radarCtx.beginPath(); radarCtx.moveTo(player.x * scale, player.z * scale); radarCtx.lineTo((player.x + Math.sin(player.yaw) * 0.8) * scale, (player.z - Math.cos(player.yaw) * 0.8) * scale); radarCtx.stroke();
  radarCtx.restore(); radarCtx.fillStyle = "#a4e6eb"; radarCtx.font = "800 10px system-ui"; radarCtx.fillText(`D${player.floor + 1}/${state.arena.floors}`, 7, 13);
}

function update(dt) {
  state.frameCount += 1; state.fpsTime += dt;
  if (state.fpsTime >= 0.5) { state.fps = Math.round(state.frameCount / state.fpsTime); state.frameCount = 0; state.fpsTime = 0; }
  state.announcementTime = Math.max(0, state.announcementTime - dt);
  if (state.announcementTime <= 0) ui.announcement.classList.add("hidden");
  state.damageFlash = Math.max(0, state.damageFlash - dt); state.hitFlash = Math.max(0, state.hitFlash - dt);
  state.floorFade = Math.max(0, state.floorFade - dt); state.shake = Math.max(0, state.shake - dt * 0.35);
  ui.damageVignette.classList.toggle("hidden", state.damageFlash <= 0);
  ui.hitMarker.classList.toggle("hidden", state.hitFlash <= 0);
  if (state.mode !== "playing") { updateEffects(dt); animateEnvironment(dt); return; }
  if (state.countdown > 0) {
    const previous = Math.ceil(state.countdown); state.countdown = Math.max(0, state.countdown - dt); const next = Math.ceil(state.countdown);
    if (next !== previous && next > 0) announce(String(next), `${state.arena.subtitle} · ${state.arena.name}`, next === 1 ? 0.8 : 1);
    if (state.countdown === 0 && previous > 0) { announce("Snap!", state.arena.objective.label, 0.9); playTone("start"); }
  } else {
    state.timeLeft -= dt; state.elapsed += dt;
    if (state.timeLeft <= 0) { finishRound(false, "The league clock expired."); return; }
  }
  updatePlayer(dt); if (state.countdown <= 0) updateBots(dt); updateEffects(dt); animateEnvironment(dt);
  state.hudTimer -= dt; state.radarTimer -= dt;
  if (state.hudTimer <= 0) { updateHud(); state.hudTimer = 0.05; }
  if (state.radarTimer <= 0) { drawRadar(); state.radarTimer = 0.1; }
}

function animateEnvironment(dt) {
  const time = performance.now() * 0.001;
  state.props.forEach((prop) => { if (prop.userData.type === "zone") prop.rotation.y += dt * 0.2; });
  state.liftMeshes.forEach((item) => { item.rotation.y = Math.sin(time * 0.7 + item.userData.floor) * 0.015; });
}

function render() {
  const baseX = camera.position.x, baseY = camera.position.y;
  if (state.shake > 0 && state.mode === "playing") { camera.position.x += (Math.random() - 0.5) * state.shake; camera.position.y += (Math.random() - 0.5) * state.shake; }
  renderer.render(scene, camera); camera.position.x = baseX; camera.position.y = baseY;
}

function frame() {
  const dt = Math.min(0.05, clock.getDelta()); update(dt); render();
}

function renderCaptainChoices() {
  ui.captainChoices.innerHTML = CAPTAINS.map((item, index) => `<button class="captain-card${item.id === state.captainId ? " is-selected" : ""}" data-captain="${item.id}" style="--cap:${item.body};--cap-dark:${item.dark};--face:url('${faceUrls[index]}')"><i class="captain-avatar"></i><strong>${item.name}</strong><span>${item.role}</span></button>`).join("");
}

function selectCaptain(id) {
  if (!CAPTAINS.some((item) => item.id === id)) return;
  state.captainId = id; localStorage.setItem("snapLeague.captain", id); renderCaptainChoices(); createWeaponRig(); updateHud(); playTone("select");
}

function updateBestStats() {
  ui.bestStats.textContent = `Best score ${state.bestScore}${state.bestTime ? ` · Fastest clear ${state.bestTime.toFixed(1)}s` : ""}`;
  const continueIndex = state.nextArenaIndex ?? state.arenaIndex;
  ui.startButton.textContent = continueIndex > 0 ? `Continue · Match ${continueIndex + 1}` : "Enter the League";
}

function buildReport() {
  return JSON.stringify({
    game: "Tactical Arena: The Snap League", build: "3.0-threejs", captain: captain().name, recordedAt: new Date().toISOString(),
    roundsStarted: state.metrics.starts, roundsCompleted: state.metrics.completed, wins: state.metrics.wins, replays: state.metrics.replays,
    completionRate: state.metrics.starts ? Math.round(state.metrics.completed / state.metrics.starts * 100) : 0,
    winRate: state.metrics.completed ? Math.round(state.metrics.wins / state.metrics.completed * 100) : 0,
    replayRate: state.metrics.starts ? Math.round(state.metrics.replays / state.metrics.starts * 100) : 0,
    averageFps: state.metrics.fpsSamples ? Math.round(state.metrics.fpsTotal / state.metrics.fpsSamples) : state.fps,
    targetWinRate: TARGET_WIN_RATE,
    arenas: ARENAS.map((arena, index) => ({
      name: arena.name, ...state.arenaRecords[index], estimatedWinRate: Number(estimatedWinRate(state.arenaRecords[index]).toFixed(3)),
      nextChallenge: challengeForArena(index, state.arenaRecords[index])
    })),
    errors: state.errors, viewport: `${innerWidth}x${innerHeight}`, quality: state.quality, reducedMotion: state.reducedMotion
  }, null, 2);
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); } catch (_error) {
    const area = document.createElement("textarea"); area.value = text; document.body.appendChild(area); area.select(); document.execCommand("copy"); area.remove();
  }
}

function initAudio() {
  if (audioContext) { audioContext.resume?.(); return; }
  const Context = window.AudioContext || window.webkitAudioContext; if (Context) audioContext = new Context();
}

function playTone(type) {
  if (state.muted || !audioContext) return;
  const now = audioContext.currentTime; const osc = audioContext.createOscillator(); const gain = audioContext.createGain();
  const settings = {
    pistol: [145, .08, .09, "square"], rifle: [100, .055, .075, "sawtooth"], bot: [120, .05, .04, "square"], hit: [760, .04, .05, "sine"],
    death: [95, .24, .07, "sawtooth"], hurt: [72, .16, .08, "sawtooth"], reload: [410, .14, .04, "triangle"], empty: [900, .03, .03, "triangle"],
    lift: [190, .3, .055, "sine"], jump: [240, .08, .03, "triangle"], land: [85, .06, .03, "sine"], heal: [550, .22, .05, "sine"],
    objective: [620, .22, .05, "sine"], shield: [680, .28, .06, "sawtooth"], phase: [130, .35, .07, "square"], win: [520, .34, .07, "sine"],
    lose: [120, .32, .06, "triangle"], start: [340, .16, .05, "sine"], switch: [480, .06, .03, "triangle"], select: [640, .08, .035, "sine"]
  }[type] || [280, .07, .04, "sine"];
  osc.type = settings[3]; osc.frequency.setValueAtTime(settings[0], now);
  if (["lift", "heal", "objective", "win", "select"].includes(type)) osc.frequency.exponentialRampToValueAtTime(settings[0] * 1.7, now + settings[1]);
  if (["death", "lose", "shield"].includes(type)) osc.frequency.exponentialRampToValueAtTime(Math.max(45, settings[0] * .45), now + settings[1]);
  gain.gain.setValueAtTime(.0001, now); gain.gain.exponentialRampToValueAtTime(settings[2], now + .006); gain.gain.exponentialRampToValueAtTime(.0001, now + settings[1]);
  osc.connect(gain); gain.connect(audioContext.destination); osc.start(now); osc.stop(now + settings[1] + .02);
}

function handleLook(dx, dy = 0) {
  if (state.mode !== "playing") return;
  player.yaw -= dx * 0.00225;
  player.pitch = clamp(player.pitch - dy * 0.0019, -1.05, 1.05);
}

document.addEventListener("keydown", (event) => {
  state.keys[event.code] = true;
  if (event.code === "Space") event.preventDefault();
  if (event.code === "Escape" && state.mode === "playing") pauseGame();
  else if (event.code === "Escape" && state.mode === "paused") resumeGame();
  else if (event.code === "Space" && !event.repeat) jump();
  else if (event.code === "KeyE" && !event.repeat) useLift();
  else if (event.code === "KeyR") reload();
  else if (event.code === "Digit1") switchWeapon(0);
  else if (event.code === "Digit2") switchWeapon(1);
});
document.addEventListener("keyup", (event) => { state.keys[event.code] = false; });
document.addEventListener("mousemove", (event) => {
  if (document.pointerLockElement === renderer.domElement) handleLook(event.movementX, event.movementY);
  else if (state.pointerDown) { handleLook(event.clientX - state.dragX, event.movementY || 0); state.dragX = event.clientX; }
});
renderer.domElement.addEventListener("mousedown", (event) => {
  if (state.mode !== "playing" || event.button !== 0) return;
  initAudio(); requestPointer(); state.pointerDown = true; state.dragX = event.clientX; state.shootHeld = true; shoot();
});
document.addEventListener("mouseup", () => { state.pointerDown = false; state.shootHeld = false; });
renderer.domElement.addEventListener("touchstart", (event) => {
  if (state.mode !== "playing") return; const touch = event.touches[0]; state.pointerDown = true; state.shootHeld = true; state.dragX = touch.clientX; shoot(); event.preventDefault();
}, { passive: false });
renderer.domElement.addEventListener("touchmove", (event) => { const touch = event.touches[0]; handleLook(touch.clientX - state.dragX, 0); state.dragX = touch.clientX; event.preventDefault(); }, { passive: false });
renderer.domElement.addEventListener("touchend", () => { state.pointerDown = false; state.shootHeld = false; });
document.addEventListener("pointerlockchange", () => {
  if (state.mode === "playing" && document.pointerLockElement !== renderer.domElement && !state.pointerDown) pauseGame();
});

ui.startButton.addEventListener("click", startRound);
ui.controlsButton.addEventListener("click", () => ui.controlsPanel.classList.toggle("hidden"));
ui.resumeButton.addEventListener("click", resumeGame);
ui.restartPauseButton.addEventListener("click", startRound);
ui.restartButton.addEventListener("click", startRound);
ui.menuButton.addEventListener("click", () => { setMode("menu"); updateBestStats(); });
ui.captainChoices.addEventListener("click", (event) => { const button = event.target.closest("[data-captain]"); if (button) selectCaptain(button.dataset.captain); });
ui.upgradeChoices.addEventListener("click", (event) => { const button = event.target.closest("[data-upgrade]"); if (button) chooseUpgrade(button.dataset.upgrade); });
ui.muteButton.addEventListener("click", () => { state.muted = !state.muted; localStorage.setItem("tacticalArena.muted", String(state.muted)); updateHud(); });
ui.reducedMotion.checked = state.reducedMotion;
ui.reducedMotion.addEventListener("change", () => { state.reducedMotion = ui.reducedMotion.checked; localStorage.setItem("snapLeague.reducedMotion", String(state.reducedMotion)); });
ui.qualitySelect.value = state.quality;
applyQuality();
ui.qualitySelect.addEventListener("change", () => {
  state.quality = ui.qualitySelect.value; localStorage.setItem("snapLeague.quality", state.quality);
  applyQuality();
});

function applyQuality() {
  const ratio = state.quality === "high" ? Math.min(devicePixelRatio, 1) : Math.min(devicePixelRatio, 0.75);
  renderer.setPixelRatio(Math.max(0.65, ratio)); renderer.shadowMap.enabled = false; renderer.setSize(innerWidth, innerHeight);
}
ui.copyReportButton.addEventListener("click", async () => { await copyText(buildReport()); ui.copyReportButton.textContent = "Report Copied"; });
ui.copyScoreButton.addEventListener("click", async () => {
  if (!state.lastResult) return; const item = state.lastResult;
  await copyText(["THE SNAP LEAGUE", `${item.captain} · ${item.arena}`, item.won ? "MATCH WON" : "MATCH LOST", `Score ${item.score} · ${item.kills} rivals · ${item.time.toFixed(1)}s`].join("\n"));
  ui.copyScoreButton.textContent = "Score Copied";
});

window.addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight);
});
window.addEventListener("error", () => { state.errors += 1; });
window.addEventListener("unhandledrejection", () => { state.errors += 1; });

function arenaValidation() {
  return ARENAS.map((arena) => {
    const errors = []; const wall = (x, z) => arena.grid[Math.floor(z)]?.[Math.floor(x)] !== "0";
    if (arena.floors < 2) errors.push("requires multiple decks");
    if (!arena.lifts.length) errors.push("requires a lift");
    [arena.spawn, ...arena.lifts, ...arena.botSpawns, ...arena.health, ...(arena.pickups || [])].forEach((point) => { if (wall(point.x, point.z)) errors.push(`blocked point ${point.x},${point.z}`); });
    return { name: arena.name, floors: arena.floors, tier: arena.tier, valid: errors.length === 0, errors };
  });
}

window.__TACTICAL_ARENA_DEBUG__ = {
  startRound, pauseGame, resumeGame, shoot, reload, switchWeapon, jump, useLift, chooseUpgrade, selectCaptain,
  setArena(index) { state.arenaIndex = clamp(Math.floor(Number(index) || 0), 0, ARENAS.length - 1); state.nextArenaIndex = null; startRound(); },
  setFloor(floor) { player.floor = clamp(Math.floor(Number(floor) || 0), 0, state.arena.floors - 1); syncFloorVisibility(); updateCamera(); updateHud(); drawRadar(); },
  setPlayerPosition(x, z, yaw = player.yaw) { if (!isWall(x, z)) { player.x = x; player.z = z; player.yaw = yaw; updateCamera(); } },
  setBotPosition(index, x, z, floor = null) { const bot = state.bots[index]; if (bot && !isWall(x, z)) { bot.x = x; bot.z = z; if (floor !== null) bot.floor = clamp(Number(floor), 0, state.arena.floors - 1); positionBot(bot); syncFloorVisibility(); } },
  readyCombat() { state.countdown = 0; player.cooldown = 0; player.reloading = 0; player.health = player.maxHealth; state.announcementTime = 0; ui.announcement.classList.add("hidden"); updateHud(); },
  damagePlayer,
  hitBot(index, amount) { const bot = state.bots[index]; if (bot) damageBot(bot, Number(amount) || 0); },
  killBot(index) { const bot = state.bots[index]; if (bot) damageBot(bot, 9999); },
  killAllBots() { state.bots.forEach((bot) => { if (bot.alive) damageBot(bot, 9999); }); },
  completeObjective() { state.objectiveProgress = state.arena.objective.goal; state.objectiveComplete = true; state.props.filter((prop) => prop.userData.type === "objective").forEach((prop) => { prop.userData.active = false; prop.visible = false; }); checkWin(); updateHud(); },
  listArenas: arenaValidation,
  getPlaytestReport: buildReport,
  getState() {
    const boss = state.bots.find((bot) => bot.role === "boss");
    return {
      mode: state.mode, arena: state.arena.name, level: state.arenaIndex + 1, floors: state.arena.floors, fps: state.fps, errors: state.errors,
      challenge: state.challenge, targetWinRate: TARGET_WIN_RATE, arenaRecord: state.arenaRecords[state.arenaIndex],
      objective: { type: state.arena.objective.type, progress: Number(state.objectiveProgress.toFixed(2)), goal: state.arena.objective.goal, complete: state.objectiveComplete },
      player: { x: Number(player.x.toFixed(2)), z: Number(player.z.toFixed(2)), floor: player.floor, y: Number(player.yOffset.toFixed(2)), grounded: player.grounded, health: player.health, captain: state.captainId },
      weapon: weapon().id, ammo: [...player.ammo], reserve: [...player.reserve], botsAlive: state.bots.filter((bot) => bot.alive).length,
      bots: state.bots.map((bot) => ({ name: bot.name, role: bot.role, floor: bot.floor, hp: Math.ceil(Math.max(0, bot.hp)), maxHp: bot.maxHp, shield: Math.ceil(bot.shield), phase: bot.phase, state: bot.state })),
      boss: boss ? { hp: boss.hp, shield: boss.shield, phase: boss.phase, floor: boss.floor } : null,
      props: state.props.filter((prop) => prop.userData.active).map((prop) => ({ type: prop.userData.type, floor: prop.userData.floor, x: prop.userData.x, z: prop.userData.z })),
      score: state.score, timeLeft: state.timeLeft, canvas: { width: renderer.domElement.width, height: renderer.domElement.height }, renderer: { kind: "threejs", calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }
    };
  }
};

renderCaptainChoices();
buildArena(state.arenaIndex);
Object.assign(player, { x: state.arena.spawn.x, z: state.arena.spawn.z, yaw: state.arena.spawn.yaw });
updateCamera(); updateHud(); updateBestStats(); setMode("menu");
renderer.setAnimationLoop(frame);
