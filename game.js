(() => {
  "use strict";

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  const radar = document.getElementById("radarCanvas");
  const rctx = radar.getContext("2d");

  const ui = {
    hud: document.getElementById("hud"),
    menu: document.getElementById("menu"),
    pause: document.getElementById("pausePanel"),
    round: document.getElementById("roundPanel"),
    health: document.getElementById("healthText"),
    ammo: document.getElementById("ammoText"),
    weapon: document.getElementById("weaponText"),
    bots: document.getElementById("botsText"),
    timer: document.getElementById("timerText"),
    score: document.getElementById("scoreText"),
    best: document.getElementById("bestStats"),
    controls: document.getElementById("controlsPanel"),
    crosshair: document.getElementById("crosshair"),
    hitMarker: document.getElementById("hitMarker"),
    damage: document.getElementById("damageVignette"),
    mute: document.getElementById("muteButton"),
    roundTitle: document.getElementById("roundTitle"),
    roundSummary: document.getElementById("roundSummary"),
    scoreboard: document.getElementById("scoreboard")
  };

  const buttons = {
    start: document.getElementById("startButton"),
    controls: document.getElementById("controlsButton"),
    resume: document.getElementById("resumeButton"),
    restartPause: document.getElementById("restartPauseButton"),
    restart: document.getElementById("restartButton"),
    menu: document.getElementById("menuButton")
  };

  const MAP = [
    "1111111111111111",
    "1000000001000001",
    "1011110101001101",
    "1000010100000101",
    "1011010111110101",
    "1010000000010001",
    "1010111111011111",
    "1000100001000001",
    "1110101101011101",
    "1000001101000001",
    "1011100000010111",
    "1000001110000001",
    "1111111111111111"
  ];

  const mapH = MAP.length;
  const mapW = MAP[0].length;
  const spawn = { x: 1.7, y: 1.7, a: 0.1 };
  const botSpawns = [
    { x: 13.2, y: 1.7 },
    { x: 13.2, y: 9.4 },
    { x: 2.0, y: 11.0 },
    { x: 8.7, y: 5.4 },
    { x: 5.5, y: 9.5 }
  ];
  const patrolRoutes = [
    [{ x: 12.5, y: 1.5 }, { x: 10.5, y: 5.3 }, { x: 13.5, y: 5.3 }],
    [{ x: 13.5, y: 9.5 }, { x: 11.5, y: 11.0 }, { x: 8.5, y: 9.5 }],
    [{ x: 2.0, y: 11.0 }, { x: 5.0, y: 11.0 }, { x: 5.5, y: 9.5 }],
    [{ x: 8.5, y: 5.5 }, { x: 4.5, y: 5.5 }, { x: 3.5, y: 7.5 }],
    [{ x: 5.5, y: 9.5 }, { x: 9.5, y: 11.0 }, { x: 12.5, y: 11.0 }]
  ];
  const coverPoints = [
    { x: 8.5, y: 1.5 },
    { x: 4.5, y: 3.5 },
    { x: 12.5, y: 5.4 },
    { x: 3.5, y: 7.4 },
    { x: 10.5, y: 9.5 },
    { x: 5.5, y: 11.0 },
    { x: 12.5, y: 11.0 }
  ];

  const arenaProps = [
    { x: 7.55, y: 1.55, type: "crate", color: "#f2b84b", label: "A" },
    { x: 10.5, y: 3.45, type: "barrel", color: "#4cc3d9" },
    { x: 2.45, y: 5.5, type: "crate", color: "#ec6d5f", label: "B" },
    { x: 7.5, y: 7.45, type: "barrel", color: "#f2b84b" },
    { x: 13.45, y: 7.5, type: "sign", color: "#65d18e", label: "EAST" },
    { x: 4.5, y: 9.5, type: "crate", color: "#4cc3d9", label: "C" },
    { x: 9.5, y: 11.0, type: "cone", color: "#ff8a4c" },
    { x: 1.55, y: 8.5, type: "lamp", color: "#ffe88a" }
  ];

  const botPalettes = [
    { suit: "#e9625b", dark: "#8c3340", vest: "#263b52", trim: "#ffd166", skin: "#f2bd8f" },
    { suit: "#f08a4b", dark: "#9a4936", vest: "#32485b", trim: "#65d18e", skin: "#c9825c" },
    { suit: "#d85472", dark: "#81324f", vest: "#284251", trim: "#4cc3d9", skin: "#f4c6a0" },
    { suit: "#e36f45", dark: "#893a38", vest: "#2f3b55", trim: "#ffd166", skin: "#9f5f44" },
    { suit: "#da5e58", dark: "#7d3240", vest: "#2b4854", trim: "#8ce99a", skin: "#e3a578" }
  ];

  const weapons = [
    {
      id: "pistol",
      name: "Pistol",
      damage: 28,
      magSize: 12,
      reserve: 48,
      interval: 0.32,
      reload: 1.1,
      spread: 0.012,
      recoil: 0.018,
      auto: false,
      shake: 2.5
    },
    {
      id: "rifle",
      name: "Rifle",
      damage: 18,
      magSize: 30,
      reserve: 90,
      interval: 0.09,
      reload: 1.55,
      spread: 0.032,
      recoil: 0.028,
      auto: true,
      shake: 3.6
    }
  ];

  const state = {
    mode: "menu",
    keys: Object.create(null),
    pointerDown: false,
    lastPointerX: 0,
    touchLook: false,
    lastTime: performance.now(),
    zBuffer: [],
    wallHits: [],
    bots: [],
    effects: [],
    score: 0,
    kills: 0,
    roundDuration: 150,
    timeLeft: 150,
    elapsed: 0,
    bestScore: Number(localStorage.getItem("tacticalArena.bestScore") || 0),
    bestTime: Number(localStorage.getItem("tacticalArena.fastestClear") || 0),
    muted: localStorage.getItem("tacticalArena.muted") === "true",
    lastShotHeld: false,
    pointerSupported: "pointerLockElement" in document,
    audio: null
  };

  const player = {
    x: spawn.x,
    y: spawn.y,
    a: spawn.a,
    health: 100,
    radius: 0.18,
    speed: 2.6,
    recoil: 0,
    shake: 0,
    damageFlash: 0,
    hitMarker: 0,
    muzzle: 0,
    weaponIndex: 0,
    ammo: [12, 30],
    reserve: [48, 90],
    cooldown: 0,
    reloading: 0,
    bob: 0,
    z: 0,
    vz: 0,
    grounded: true,
    landing: 0,
    jumpCooldown: 0,
    damageAngle: 0
  };

  const TAU = Math.PI * 2;
  const FOV = Math.PI / 3;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function normalizeAngle(angle) {
    while (angle <= -Math.PI) angle += TAU;
    while (angle > Math.PI) angle -= TAU;
    return angle;
  }

  function distance(a, b, c, d) {
    const dx = c - a;
    const dy = d - b;
    return Math.hypot(dx, dy);
  }

  function formatTime(seconds) {
    const s = Math.max(0, Math.ceil(seconds));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  }

  function isWall(x, y) {
    const gx = Math.floor(x);
    const gy = Math.floor(y);
    return gx < 0 || gy < 0 || gx >= mapW || gy >= mapH || MAP[gy][gx] === "1";
  }

  function hasLineOfSight(x1, y1, x2, y2) {
    const dist = distance(x1, y1, x2, y2);
    const steps = Math.max(2, Math.ceil(dist * 12));
    for (let i = 1; i < steps; i += 1) {
      const t = i / steps;
      if (isWall(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t)) return false;
    }
    return true;
  }

  function moveEntity(entity, dx, dy, radius) {
    const nx = entity.x + dx;
    const ny = entity.y + dy;
    if (!isWall(nx + Math.sign(dx) * radius, entity.y) && !isWall(nx, entity.y + radius) && !isWall(nx, entity.y - radius)) {
      entity.x = nx;
    }
    if (!isWall(entity.x + radius, ny) && !isWall(entity.x - radius, ny) && !isWall(entity.x, ny + Math.sign(dy) * radius)) {
      entity.y = ny;
    }
  }

  function cellKey(x, y) {
    return `${x},${y}`;
  }

  function findPath(fromX, fromY, toX, toY) {
    const start = { x: Math.floor(fromX), y: Math.floor(fromY) };
    const goal = { x: Math.floor(toX), y: Math.floor(toY) };
    if (MAP[goal.y]?.[goal.x] === "1") return [];
    const queue = [start];
    const came = new Map([[cellKey(start.x, start.y), null]]);
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];

    for (let index = 0; index < queue.length; index += 1) {
      const cur = queue[index];
      if (cur.x === goal.x && cur.y === goal.y) break;
      for (const [dx, dy] of dirs) {
        const nx = cur.x + dx;
        const ny = cur.y + dy;
        const key = cellKey(nx, ny);
        if (nx < 0 || ny < 0 || nx >= mapW || ny >= mapH || MAP[ny][nx] === "1" || came.has(key)) continue;
        came.set(key, cur);
        queue.push({ x: nx, y: ny });
      }
    }

    const goalKey = cellKey(goal.x, goal.y);
    if (!came.has(goalKey)) return [];
    const path = [];
    let cur = goal;
    while (cur) {
      path.push({ x: cur.x + 0.5, y: cur.y + 0.5 });
      cur = came.get(cellKey(cur.x, cur.y));
    }
    path.reverse();
    path.shift();
    return path;
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(320, Math.floor(window.innerWidth * dpr));
    const h = Math.max(240, Math.floor(window.innerHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }

  function showOnly(mode) {
    state.mode = mode;
    ui.menu.classList.toggle("hidden", mode !== "menu");
    ui.pause.classList.toggle("hidden", mode !== "paused");
    ui.round.classList.toggle("hidden", mode !== "won" && mode !== "lost");
    ui.hud.classList.toggle("hidden", mode !== "playing");
    ui.crosshair.classList.toggle("hidden", mode !== "playing");
  }

  function updateBestStats() {
    const time = state.bestTime > 0 ? ` | Fastest clear: ${state.bestTime.toFixed(1)}s` : "";
    ui.best.textContent = `Best score: ${state.bestScore}${time}`;
  }

  function makeBot(index, spot) {
    return {
      id: index + 1,
      x: spot.x,
      y: spot.y,
      hp: 100,
      alive: true,
      death: 0,
      state: "patrol",
      route: patrolRoutes[index % patrolRoutes.length],
      patrolIndex: 0,
      path: [],
      pathTimer: 0,
      target: patrolRoutes[index % patrolRoutes.length][0],
      shootTimer: 0.6 + Math.random() * 0.8,
      flash: 0,
      alert: 0,
      coverCooldown: 0,
      palette: botPalettes[index % botPalettes.length],
      facing: Math.random() * TAU,
      moveSpeed: 0,
      anim: Math.random() * TAU,
      hurt: 0,
      z: 0,
      vz: 0,
      grounded: true,
      jumpTimer: 1.5 + Math.random() * 3
    };
  }

  function resetRound() {
    Object.assign(player, {
      x: spawn.x,
      y: spawn.y,
      a: spawn.a,
      health: 100,
      recoil: 0,
      shake: 0,
      damageFlash: 0,
      hitMarker: 0,
      muzzle: 0,
      weaponIndex: 0,
      ammo: [weapons[0].magSize, weapons[1].magSize],
      reserve: [weapons[0].reserve, weapons[1].reserve],
      cooldown: 0,
      reloading: 0,
      bob: 0,
      z: 0,
      vz: 0,
      grounded: true,
      landing: 0,
      jumpCooldown: 0,
      damageAngle: 0
    });
    state.bots = botSpawns.map((spot, index) => makeBot(index, spot));
    state.effects = [];
    state.score = 0;
    state.kills = 0;
    state.timeLeft = state.roundDuration;
    state.elapsed = 0;
    state.lastShotHeld = false;
    ui.hitMarker.classList.add("hidden");
    ui.damage.classList.add("hidden");
    updateHud();
  }

  function startRound() {
    initAudio();
    resetRound();
    showOnly("playing");
    playTone("round");
    requestPointer();
  }

  function requestPointer() {
    if (state.pointerSupported && document.pointerLockElement !== canvas) {
      canvas.requestPointerLock?.();
    }
  }

  function pauseGame() {
    if (state.mode !== "playing") return;
    document.exitPointerLock?.();
    showOnly("paused");
  }

  function resumeGame() {
    if (state.mode !== "paused") return;
    showOnly("playing");
    requestPointer();
  }

  function finishRound(won, reason) {
    if (state.mode !== "playing") return;
    showOnly(won ? "won" : "lost");
    document.exitPointerLock?.();
    playTone(won ? "win" : "lose");

    const timeUsed = state.elapsed;
    const timeBonus = won ? Math.ceil(state.timeLeft) * 3 : 0;
    const finalScore = state.score + timeBonus + (won ? 250 : 0);
    if (finalScore > state.bestScore) {
      state.bestScore = finalScore;
      localStorage.setItem("tacticalArena.bestScore", String(finalScore));
    }
    if (won && (state.bestTime === 0 || timeUsed < state.bestTime)) {
      state.bestTime = timeUsed;
      localStorage.setItem("tacticalArena.fastestClear", String(timeUsed.toFixed(1)));
    }

    ui.roundTitle.textContent = won ? "Round Won" : "Round Lost";
    ui.roundSummary.textContent = reason;
    ui.scoreboard.innerHTML = [
      `<div>Kills: ${state.kills} / ${state.bots.length}</div>`,
      `<div>Base score: ${state.score}</div>`,
      `<div>Time bonus: ${timeBonus}</div>`,
      `<div>Final score: ${finalScore}</div>`,
      `<div>Clear time: ${timeUsed.toFixed(1)}s</div>`
    ].join("");
    updateBestStats();
  }

  function currentWeapon() {
    return weapons[player.weaponIndex];
  }

  function switchWeapon(index) {
    if (index < 0 || index >= weapons.length || player.weaponIndex === index) return;
    player.weaponIndex = index;
    player.reloading = 0;
    player.cooldown = Math.min(player.cooldown, 0.12);
    playTone("switch");
    updateHud();
  }

  function reload() {
    const weapon = currentWeapon();
    const index = player.weaponIndex;
    if (player.reloading > 0 || player.ammo[index] >= weapon.magSize || player.reserve[index] <= 0) return;
    player.reloading = weapon.reload;
    playTone("reload");
    updateHud();
  }

  function completeReload() {
    const weapon = currentWeapon();
    const index = player.weaponIndex;
    const need = weapon.magSize - player.ammo[index];
    const take = Math.min(need, player.reserve[index]);
    player.ammo[index] += take;
    player.reserve[index] -= take;
    player.reloading = 0;
    updateHud();
  }

  function shoot() {
    if (state.mode !== "playing") return false;
    const weapon = currentWeapon();
    const index = player.weaponIndex;
    if (player.reloading > 0 || player.cooldown > 0) return false;
    if (player.ammo[index] <= 0) {
      reload();
      playTone("empty");
      return false;
    }

    player.ammo[index] -= 1;
    player.cooldown = weapon.interval;
    player.recoil = Math.min(0.16, player.recoil + weapon.recoil);
    player.shake = Math.max(player.shake, weapon.shake);
    player.muzzle = 0.07;
    playTone(weapon.id);

    const shotAngle = player.a + (Math.random() - 0.5) * (weapon.spread + player.recoil);
    const wall = castRay(player.x, player.y, shotAngle, 18);
    let target = null;
    let best = wall.dist;

    for (const bot of state.bots) {
      if (!bot.alive) continue;
      const dx = bot.x - player.x;
      const dy = bot.y - player.y;
      const dist = Math.hypot(dx, dy);
      const rel = Math.abs(normalizeAngle(Math.atan2(dy, dx) - shotAngle));
      const radius = Math.atan2(0.28, dist);
      if (rel < radius && dist < best && hasLineOfSight(player.x, player.y, bot.x, bot.y)) {
        best = dist;
        target = bot;
      }
    }

    const endX = player.x + Math.cos(shotAngle) * best;
    const endY = player.y + Math.sin(shotAngle) * best;
    state.effects.push({ type: "tracer", x1: player.x, y1: player.y, x2: endX, y2: endY, life: 0.05, ttl: 0.05 });

    if (target) {
      damageBot(target, weapon.damage + Math.floor(Math.random() * 6));
      state.effects.push({ type: "impact", x: target.x, y: target.y, life: 0.22, ttl: 0.22, color: "#65d18e" });
      return true;
    }
    state.effects.push({ type: "impact", x: endX, y: endY, life: 0.16, ttl: 0.16, color: "#ffd166" });
    return false;
  }

  function damageBot(bot, amount) {
    bot.hp -= amount;
    bot.alert = 1;
    bot.hurt = 0.2;
    bot.state = bot.hp < 45 ? "cover" : "attack";
    player.hitMarker = 0.12;
    ui.hitMarker.classList.remove("hidden");
    state.score += 15;
    playTone("hit");
    if (bot.hp <= 0 && bot.alive) {
      bot.alive = false;
      bot.death = 1;
      state.kills += 1;
      state.score += 100;
      playTone("death");
      if (state.bots.every((item) => !item.alive)) {
        finishRound(true, "All hostile bots eliminated.");
      }
    }
    updateHud();
  }

  function damagePlayer(amount, source = null) {
    player.health = Math.max(0, player.health - amount);
    player.damageFlash = 0.28;
    player.shake = Math.max(player.shake, 6);
    player.damageAngle = source ? normalizeAngle(Math.atan2(source.y - player.y, source.x - player.x) - player.a) : 0;
    ui.damage.classList.remove("hidden");
    playTone("hurt");
    if (player.health <= 0) {
      finishRound(false, "You were eliminated.");
    }
    updateHud();
  }

  function jump() {
    if (state.mode !== "playing" || !player.grounded || player.jumpCooldown > 0) return false;
    player.grounded = false;
    player.vz = 4.9;
    player.jumpCooldown = 0.18;
    player.landing = 0;
    playTone("jump");
    return true;
  }

  function castRay(x, y, angle, maxDist = 24) {
    let mapX = Math.floor(x);
    let mapY = Math.floor(y);
    const rayDirX = Math.cos(angle);
    const rayDirY = Math.sin(angle);
    const deltaDistX = Math.abs(1 / (rayDirX || 0.0001));
    const deltaDistY = Math.abs(1 / (rayDirY || 0.0001));
    const stepX = rayDirX < 0 ? -1 : 1;
    const stepY = rayDirY < 0 ? -1 : 1;
    let sideDistX = rayDirX < 0 ? (x - mapX) * deltaDistX : (mapX + 1 - x) * deltaDistX;
    let sideDistY = rayDirY < 0 ? (y - mapY) * deltaDistY : (mapY + 1 - y) * deltaDistY;
    let side = 0;
    let dist = maxDist;

    for (let i = 0; i < 64; i += 1) {
      if (sideDistX < sideDistY) {
        sideDistX += deltaDistX;
        mapX += stepX;
        side = 0;
      } else {
        sideDistY += deltaDistY;
        mapY += stepY;
        side = 1;
      }
      if (mapX < 0 || mapY < 0 || mapX >= mapW || mapY >= mapH) break;
      if (MAP[mapY][mapX] === "1") {
        dist = side === 0 ? (mapX - x + (1 - stepX) / 2) / (rayDirX || 0.0001) : (mapY - y + (1 - stepY) / 2) / (rayDirY || 0.0001);
        break;
      }
      if (Math.min(sideDistX, sideDistY) > maxDist) break;
    }
    return { dist: Math.max(0.001, dist), side, mapX, mapY };
  }

  function update(dt) {
    if (state.mode !== "playing") return;

    state.timeLeft -= dt;
    state.elapsed += dt;
    if (state.timeLeft <= 0) {
      finishRound(false, "The timer expired.");
      return;
    }

    player.cooldown = Math.max(0, player.cooldown - dt);
    player.recoil = Math.max(0, player.recoil - dt * 0.12);
    player.shake = Math.max(0, player.shake - dt * 12);
    player.muzzle = Math.max(0, player.muzzle - dt);
    player.hitMarker = Math.max(0, player.hitMarker - dt);
    player.damageFlash = Math.max(0, player.damageFlash - dt);
    player.jumpCooldown = Math.max(0, player.jumpCooldown - dt);
    player.landing = Math.max(0, player.landing - dt * 4.5);
    ui.hitMarker.classList.toggle("hidden", player.hitMarker <= 0);
    ui.damage.classList.toggle("hidden", player.damageFlash <= 0);

    if (player.reloading > 0) {
      player.reloading -= dt;
      if (player.reloading <= 0) completeReload();
    }

    if (!player.grounded || player.vz !== 0) {
      player.vz -= 12.5 * dt;
      player.z += player.vz * dt;
      if (player.z <= 0) {
        const impact = Math.abs(player.vz);
        player.z = 0;
        player.vz = 0;
        player.grounded = true;
        player.landing = clamp(impact / 7, 0.35, 0.85);
        player.shake = Math.max(player.shake, 2.2);
        playTone("land");
      }
    }

    const forward = (state.keys.KeyW ? 1 : 0) - (state.keys.KeyS ? 1 : 0);
    const strafe = (state.keys.KeyD ? 1 : 0) - (state.keys.KeyA ? 1 : 0);
    if (forward || strafe) {
      const len = Math.hypot(forward, strafe) || 1;
      const speed = player.speed * dt;
      const dx = (Math.cos(player.a) * forward + Math.cos(player.a + Math.PI / 2) * strafe) / len * speed;
      const dy = (Math.sin(player.a) * forward + Math.sin(player.a + Math.PI / 2) * strafe) / len * speed;
      moveEntity(player, dx, dy, player.radius);
      player.bob += dt * 10;
    }

    if (state.pointerDown && currentWeapon().auto) shoot();
    updateBots(dt);

    for (const effect of state.effects) effect.life -= dt;
    state.effects = state.effects.filter((effect) => effect.life > 0);

    updateHud();
  }

  function updateBots(dt) {
    for (const bot of state.bots) {
      bot.flash = Math.max(0, bot.flash - dt);
      bot.alert = Math.max(0, bot.alert - dt * 0.4);
      bot.coverCooldown = Math.max(0, bot.coverCooldown - dt);
      bot.shootTimer = Math.max(0, bot.shootTimer - dt);
      bot.hurt = Math.max(0, bot.hurt - dt);
      bot.anim += dt * (2.5 + bot.moveSpeed * 4.5);
      bot.jumpTimer -= dt;
      if (!bot.grounded || bot.vz !== 0) {
        bot.vz -= 11.5 * dt;
        bot.z += bot.vz * dt;
        if (bot.z <= 0) {
          bot.z = 0;
          bot.vz = 0;
          bot.grounded = true;
        }
      }
      if (!bot.alive) {
        bot.death = Math.max(0, bot.death - dt * 0.8);
        continue;
      }

      const distToPlayer = distance(bot.x, bot.y, player.x, player.y);
      const seesPlayer = distToPlayer < 10 && hasLineOfSight(bot.x, bot.y, player.x, player.y);
      if (seesPlayer) {
        bot.alert = 1;
        if (bot.hp < 45 && bot.coverCooldown <= 0) {
          bot.state = "cover";
          bot.target = nearestCover(bot);
          bot.coverCooldown = 3.5;
        } else if (bot.state === "patrol") {
          bot.state = "attack";
        }
      } else if (bot.alert <= 0.05 && bot.state !== "patrol") {
        bot.state = "patrol";
        bot.target = bot.route[bot.patrolIndex % bot.route.length];
      }

      if (bot.state === "patrol") {
        const target = bot.route[bot.patrolIndex % bot.route.length];
        bot.target = target;
        if (distance(bot.x, bot.y, target.x, target.y) < 0.35) bot.patrolIndex += 1;
      } else if (bot.state === "attack") {
        bot.target = distToPlayer > 4.2 ? { x: player.x, y: player.y } : orbitPoint(bot);
      } else if (bot.state === "cover" && distance(bot.x, bot.y, bot.target.x, bot.target.y) < 0.45) {
        bot.state = "attack";
      }

      followTarget(bot, dt);

      if (bot.grounded && bot.moveSpeed > 0.5 && bot.jumpTimer <= 0 && distToPlayer > 3.2) {
        bot.grounded = false;
        bot.vz = 3.7;
        bot.jumpTimer = 3.5 + Math.random() * 4;
      }

      if (seesPlayer && distToPlayer < 9.5 && bot.shootTimer <= 0) {
        botShoot(bot, distToPlayer);
      }
    }
  }

  function nearestCover(bot) {
    let best = coverPoints[0];
    let bestScore = -Infinity;
    for (const point of coverPoints) {
      if (isWall(point.x, point.y)) continue;
      const fromBot = distance(bot.x, bot.y, point.x, point.y);
      const fromPlayer = distance(player.x, player.y, point.x, point.y);
      const blocked = hasLineOfSight(player.x, player.y, point.x, point.y) ? 0 : 2.5;
      const score = fromPlayer + blocked - fromBot * 0.45;
      if (score > bestScore) {
        bestScore = score;
        best = point;
      }
    }
    return best;
  }

  function orbitPoint(bot) {
    const angle = Math.atan2(bot.y - player.y, bot.x - player.x) + (bot.id % 2 ? 0.85 : -0.85);
    return {
      x: clamp(player.x + Math.cos(angle) * 3.2, 1.5, mapW - 1.5),
      y: clamp(player.y + Math.sin(angle) * 3.2, 1.5, mapH - 1.5)
    };
  }

  function followTarget(bot, dt) {
    bot.pathTimer -= dt;
    if (bot.pathTimer <= 0 || bot.path.length === 0) {
      bot.path = findPath(bot.x, bot.y, bot.target.x, bot.target.y);
      bot.pathTimer = 0.35;
    }
    const waypoint = bot.path[0] || bot.target;
    const dx = waypoint.x - bot.x;
    const dy = waypoint.y - bot.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.18) {
      bot.path.shift();
      bot.moveSpeed = 0;
      return;
    }
    const speed = (bot.state === "patrol" ? 1.0 : 1.45) * dt;
    bot.facing = Math.atan2(dy, dx);
    bot.moveSpeed = speed / Math.max(dt, 0.001);
    moveEntity(bot, (dx / len) * speed, (dy / len) * speed, 0.18);
  }

  function botShoot(bot, distToPlayer) {
    bot.shootTimer = 0.75 + Math.random() * 0.7;
    bot.flash = 0.11;
    playTone("bot");
    state.effects.push({ type: "tracer", x1: bot.x, y1: bot.y, x2: player.x, y2: player.y, life: 0.08, ttl: 0.08, bot: true });

    const chance = clamp(0.82 - distToPlayer * 0.055 - player.recoil * 0.7, 0.28, 0.78);
    if (Math.random() < chance) {
      damagePlayer(7 + Math.floor(Math.random() * 9), bot);
    }
  }

  function updateHud() {
    const weapon = currentWeapon();
    const index = player.weaponIndex;
    ui.health.textContent = String(Math.ceil(player.health));
    ui.ammo.textContent = player.reloading > 0 ? "Reloading" : `${player.ammo[index]} / ${player.reserve[index]}`;
    ui.weapon.textContent = weapon.name;
    ui.bots.textContent = String(state.bots.filter((bot) => bot.alive).length);
    ui.timer.textContent = formatTime(state.timeLeft);
    ui.score.textContent = String(state.score);
    ui.mute.setAttribute("aria-label", state.muted ? "Unmute audio" : "Mute audio");
    ui.mute.title = state.muted ? "Unmute audio" : "Mute audio";
    ui.mute.classList.toggle("is-muted", state.muted);
  }

  function render() {
    resize();
    const w = canvas.width;
    const h = canvas.height;
    ctx.save();
    if (player.shake > 0 && state.mode === "playing") {
      ctx.translate((Math.random() - 0.5) * player.shake, (Math.random() - 0.5) * player.shake);
    }

    drawWorld(w, h);
    drawArenaProps(w, h);
    drawSprites(w, h);
    drawEffects(w, h);
    drawWeapon(w, h);
    ctx.restore();
    drawRadar();
  }

  function cameraHorizon(h) {
    const walk = player.grounded ? Math.sin(player.bob) * 2 : 0;
    return h * 0.47 + walk + player.z * h * 0.13 + player.landing * h * 0.025;
  }

  function drawWorld(w, h) {
    const horizon = cameraHorizon(h);
    const floorGrad = ctx.createLinearGradient(0, horizon, 0, h);
    floorGrad.addColorStop(0, "#6c7880");
    floorGrad.addColorStop(0.42, "#424d54");
    floorGrad.addColorStop(1, "#20292f");
    const skyGrad = ctx.createLinearGradient(0, 0, 0, horizon);
    skyGrad.addColorStop(0, "#78c9e8");
    skyGrad.addColorStop(0.62, "#b7e2e7");
    skyGrad.addColorStop(1, "#f4d58b");
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, horizon);

    ctx.fillStyle = "rgba(255, 242, 181, 0.78)";
    ctx.beginPath();
    ctx.arc(w * 0.82, horizon * 0.27, Math.max(20, h * 0.055), 0, TAU);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    for (let i = 0; i < 5; i += 1) {
      const cloudX = ((i * 0.27 + player.a * 0.04) % 1.3) * w - w * 0.12;
      const cloudY = horizon * (0.14 + (i % 3) * 0.11);
      ctx.beginPath();
      ctx.ellipse(cloudX, cloudY, w * 0.055, h * 0.018, 0, 0, TAU);
      ctx.ellipse(cloudX + w * 0.035, cloudY + 2, w * 0.042, h * 0.014, 0, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, horizon, w, h - horizon);

    state.zBuffer.length = w;
    state.wallHits.length = w;
    const viewDist = w / (2 * Math.tan(FOV / 2));
    const step = w > 900 ? 2 : 1;
    for (let x = 0; x < w; x += step) {
      const rayAngle = player.a - FOV / 2 + (x / w) * FOV;
      const hit = castRay(player.x, player.y, rayAngle, 24);
      const corrected = hit.dist * Math.cos(rayAngle - player.a);
      const wallH = Math.min(h * 1.45, viewDist / corrected);
      const top = horizon - wallH / 2;
      const shade = clamp(1 - corrected / 14, 0.16, 0.92);
      const sideShade = hit.side ? 0.78 : 1;
      const district = Math.abs(hit.mapX * 7 + hit.mapY * 11) % 4;
      const palette = [
        [88, 149, 158],
        [189, 107, 79],
        [91, 123, 161],
        [172, 148, 82]
      ][district];
      const light = shade * sideShade;
      ctx.fillStyle = `rgb(${Math.floor(palette[0] * light)}, ${Math.floor(palette[1] * light)}, ${Math.floor(palette[2] * light)})`;
      ctx.fillRect(x, top, step, wallH);

      const hitX = player.x + Math.cos(rayAngle) * hit.dist;
      const hitY = player.y + Math.sin(rayAngle) * hit.dist;
      const wallU = hit.side ? hitX - Math.floor(hitX) : hitY - Math.floor(hitY);
      const panelLine = wallU < 0.045 || wallU > 0.955;
      if (panelLine) {
        ctx.fillStyle = `rgba(18, 34, 41, ${0.28 * shade})`;
        ctx.fillRect(x, top, step, wallH);
      }
      const stripeBand = district === 0 && wallU > 0.42 && wallU < 0.58;
      if (stripeBand) {
        ctx.fillStyle = `rgba(255, 219, 108, ${0.58 * shade})`;
        ctx.fillRect(x, top + wallH * 0.38, step, wallH * 0.14);
      }
      ctx.fillStyle = `rgba(255,255,255,${0.1 * shade})`;
      ctx.fillRect(x, top, step, Math.max(1, wallH * 0.025));
      ctx.fillStyle = `rgba(8,18,24,${0.16 * shade})`;
      ctx.fillRect(x, top + wallH * 0.93, step, wallH * 0.07);
      for (let i = 0; i < step; i += 1) {
        state.zBuffer[x + i] = corrected;
        state.wallHits[x + i] = hit;
      }
    }

    ctx.strokeStyle = "rgba(218, 235, 236, 0.16)";
    ctx.lineWidth = Math.max(1, w / 1000);
    for (let i = -7; i <= 7; i += 1) {
      ctx.beginPath();
      ctx.moveTo(w / 2, horizon);
      ctx.lineTo(w / 2 + i * w * 0.18, h);
      ctx.stroke();
    }
    for (let i = 1; i < 13; i += 1) {
      const p = i / 13;
      const y = horizon + Math.pow(p, 1.75) * (h - horizon);
      ctx.fillStyle = `rgba(226, 239, 238, ${0.04 + p * 0.1})`;
      ctx.fillRect(0, y, w, Math.max(1, h / 700));
    }

    const fog = ctx.createLinearGradient(0, horizon - h * 0.08, 0, horizon + h * 0.2);
    fog.addColorStop(0, "rgba(210, 232, 224, 0)");
    fog.addColorStop(0.5, "rgba(210, 232, 224, 0.12)");
    fog.addColorStop(1, "rgba(210, 232, 224, 0)");
    ctx.fillStyle = fog;
    ctx.fillRect(0, horizon - h * 0.08, w, h * 0.28);
  }

  function projectBillboard(x, y, w, h, heightScale = 1) {
    const viewDist = w / (2 * Math.tan(FOV / 2));
    const dx = x - player.x;
    const dy = y - player.y;
    const angle = normalizeAngle(Math.atan2(dy, dx) - player.a);
    if (Math.abs(angle) > FOV / 2 + 0.35) return null;
    const rawDist = Math.hypot(dx, dy);
    const depth = Math.max(0.1, rawDist * Math.cos(angle));
    const screenX = w / 2 + Math.tan(angle) * viewDist;
    const centerIndex = clamp(Math.floor(screenX), 0, w - 1);
    if (depth > (state.zBuffer[centerIndex] || 0) + 0.25) return null;
    const projectedH = viewDist / depth * heightScale;
    return { depth, screenX, projectedH, footY: cameraHorizon(h) + projectedH * 0.5 };
  }

  function drawArenaProps(w, h) {
    const props = arenaProps
      .map((prop) => ({ prop, dist: distance(player.x, player.y, prop.x, prop.y) }))
      .sort((a, b) => b.dist - a.dist);

    for (const { prop } of props) {
      const p = projectBillboard(prop.x, prop.y, w, h, prop.type === "lamp" ? 1.05 : 0.58);
      if (!p) continue;
      const size = p.projectedH;
      ctx.save();
      ctx.translate(p.screenX, p.footY);
      ctx.globalAlpha = clamp(1.2 - p.depth / 20, 0.58, 1);
      ctx.fillStyle = "rgba(12, 20, 24, 0.28)";
      ctx.beginPath();
      ctx.ellipse(0, 2, size * 0.36, size * 0.09, 0, 0, TAU);
      ctx.fill();

      if (prop.type === "crate") {
        ctx.fillStyle = prop.color;
        ctx.fillRect(-size * 0.36, -size * 0.62, size * 0.72, size * 0.62);
        ctx.strokeStyle = "rgba(31, 47, 54, 0.72)";
        ctx.lineWidth = Math.max(2, size * 0.055);
        ctx.strokeRect(-size * 0.34, -size * 0.59, size * 0.68, size * 0.56);
        ctx.beginPath();
        ctx.moveTo(-size * 0.29, -size * 0.54);
        ctx.lineTo(size * 0.29, -size * 0.08);
        ctx.moveTo(size * 0.29, -size * 0.54);
        ctx.lineTo(-size * 0.29, -size * 0.08);
        ctx.stroke();
        ctx.fillStyle = "#20313a";
        ctx.font = `900 ${Math.max(9, size * 0.22)}px Avenir Next, sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(prop.label || "", 0, -size * 0.25);
      } else if (prop.type === "barrel") {
        ctx.fillStyle = prop.color;
        ctx.beginPath();
        ctx.roundRect(-size * 0.23, -size * 0.7, size * 0.46, size * 0.7, size * 0.13);
        ctx.fill();
        ctx.fillStyle = "rgba(27, 48, 57, 0.55)";
        ctx.fillRect(-size * 0.25, -size * 0.58, size * 0.5, size * 0.08);
        ctx.fillRect(-size * 0.25, -size * 0.18, size * 0.5, size * 0.08);
        ctx.fillStyle = "rgba(255,255,255,0.23)";
        ctx.fillRect(-size * 0.13, -size * 0.64, size * 0.08, size * 0.5);
      } else if (prop.type === "cone") {
        ctx.fillStyle = prop.color;
        ctx.beginPath();
        ctx.moveTo(0, -size * 0.7);
        ctx.lineTo(size * 0.28, -size * 0.06);
        ctx.lineTo(-size * 0.28, -size * 0.06);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#f6f2da";
        ctx.fillRect(-size * 0.19, -size * 0.3, size * 0.38, size * 0.09);
        ctx.fillStyle = "#263943";
        ctx.fillRect(-size * 0.38, -size * 0.08, size * 0.76, size * 0.09);
      } else if (prop.type === "sign") {
        ctx.fillStyle = "#344a55";
        ctx.fillRect(-size * 0.035, -size * 0.72, size * 0.07, size * 0.72);
        ctx.fillStyle = prop.color;
        ctx.beginPath();
        ctx.roundRect(-size * 0.43, -size * 0.82, size * 0.86, size * 0.3, size * 0.04);
        ctx.fill();
        ctx.fillStyle = "#14312b";
        ctx.font = `900 ${Math.max(8, size * 0.13)}px Avenir Next, sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(prop.label, 0, -size * 0.63);
      } else if (prop.type === "lamp") {
        ctx.fillStyle = "#324953";
        ctx.fillRect(-size * 0.025, -size * 0.9, size * 0.05, size * 0.9);
        const glow = ctx.createRadialGradient(0, -size * 0.9, 0, 0, -size * 0.9, size * 0.25);
        glow.addColorStop(0, "rgba(255, 244, 170, 0.95)");
        glow.addColorStop(1, "rgba(255, 225, 116, 0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(0, -size * 0.9, size * 0.25, 0, TAU);
        ctx.fill();
        ctx.fillStyle = prop.color;
        ctx.beginPath();
        ctx.arc(0, -size * 0.9, size * 0.075, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawSprites(w, h) {
    const sprites = state.bots
      .filter((bot) => bot.alive || bot.death > 0)
      .map((bot) => ({ bot, dist: distance(player.x, player.y, bot.x, bot.y) }))
      .sort((a, b) => b.dist - a.dist);

    for (const item of sprites) {
      const bot = item.bot;
      const projected = projectBillboard(bot.x, bot.y, w, h, 0.98);
      if (!projected) continue;
      const { depth, screenX } = projected;
      const bodyH = projected.projectedH;
      const bodyW = bodyH * 0.45;
      const footY = projected.footY - bot.z * bodyH;
      const alpha = bot.alive ? 1 : bot.death;
      drawCartoonBot(bot, screenX, footY, bodyH, alpha, depth);

      if (bot.alive) {
        const barW = bodyW * 0.75;
        const barY = footY - bodyH - 8;
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(screenX - barW / 2, barY, barW, 4);
        ctx.fillStyle = "#2bc4a7";
        ctx.fillRect(screenX - barW / 2, barY, barW * clamp(bot.hp / 100, 0, 1), 4);
      }
    }
  }

  function drawLimb(x1, y1, x2, y2, width, color, jointColor = color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.fillStyle = jointColor;
    ctx.beginPath();
    ctx.arc(x2, y2, width * 0.48, 0, TAU);
    ctx.fill();
  }

  function drawCartoonBot(bot, screenX, footY, bodyH, alpha, depth) {
    const s = bodyH / 120;
    const moving = bot.moveSpeed > 0.15;
    const stride = moving ? Math.sin(bot.anim * 2.2) : 0;
    const breathe = Math.sin(bot.anim * 0.8) * 1.2;
    const airborne = !bot.grounded || bot.z > 0;
    const alert = bot.alert > 0.05 || bot.state === "attack";
    const recoil = bot.flash > 0 ? 7 : 0;
    const hurtLean = bot.hurt > 0 ? -7 : 0;
    const palette = bot.palette;

    ctx.save();
    ctx.globalAlpha = alpha * clamp(1.2 - depth / 22, 0.55, 1);
    ctx.translate(screenX, footY);
    ctx.fillStyle = `rgba(12, 22, 28, ${0.25 * alpha})`;
    ctx.beginPath();
    ctx.ellipse(0, 3 * s, 24 * s * (airborne ? 0.72 : 1), 6 * s, 0, 0, TAU);
    ctx.fill();
    ctx.scale(s, s);
    if (!bot.alive) {
      const fall = 1 - alpha;
      ctx.translate(22 * fall, -3 * fall);
      ctx.rotate(1.38 * fall);
    } else {
      ctx.translate(hurtLean, moving ? Math.abs(stride) * -1.4 : breathe);
    }

    const legLift = airborne ? 12 : 0;
    const leftFootX = airborne ? -12 : -10 + stride * 7;
    const rightFootX = airborne ? 12 : 10 - stride * 7;
    const leftKnee = airborne ? -3 : stride * -5;
    const rightKnee = airborne ? 3 : stride * 5;
    drawLimb(-9, -42, leftKnee, -22 + legLift, 12, palette.dark);
    drawLimb(leftKnee, -22 + legLift, leftFootX, -4 + legLift, 11, "#273847");
    drawLimb(9, -42, rightKnee, -22 + legLift, 12, palette.dark);
    drawLimb(rightKnee, -22 + legLift, rightFootX, -4 + legLift, 11, "#273847");
    ctx.fillStyle = "#172733";
    ctx.beginPath();
    ctx.roundRect(leftFootX - 8, -8 + legLift, 17, 8, 3);
    ctx.roundRect(rightFootX - 8, -8 + legLift, 17, 8, 3);
    ctx.fill();

    ctx.fillStyle = palette.suit;
    ctx.beginPath();
    ctx.roundRect(-22, -82, 44, 47, 12);
    ctx.fill();
    ctx.fillStyle = palette.dark;
    ctx.fillRect(-20, -48, 40, 8);
    ctx.fillStyle = palette.vest;
    ctx.beginPath();
    ctx.roundRect(-18, -77, 36, 34, 7);
    ctx.fill();
    ctx.fillStyle = palette.trim;
    ctx.fillRect(-15, -73, 5, 25);
    ctx.fillRect(10, -73, 5, 25);
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    ctx.fillRect(-14, -72, 24, 4);
    ctx.fillStyle = "#182934";
    ctx.beginPath();
    ctx.roundRect(-11, -62, 22, 13, 3);
    ctx.fill();

    const armY = alert ? -65 : -68;
    const handY = alert ? -59 : -49 + stride * 2;
    const gunX = alert ? 37 - recoil : 28;
    drawLimb(-18, armY, alert ? 0 : -28, handY, 10, palette.suit, palette.skin);
    drawLimb(18, armY, alert ? 8 : 25, handY - 2, 10, palette.suit, palette.skin);
    if (alert) {
      drawLimb(0, handY, 15, -58, 8, palette.skin);
      drawLimb(8, handY - 2, 22, -55, 8, palette.skin);
    }

    ctx.fillStyle = "#243844";
    ctx.beginPath();
    ctx.roundRect(alert ? 12 : 13, alert ? -64 : -54, alert ? 39 : 30, 8, 3);
    ctx.fill();
    ctx.fillStyle = "#10202a";
    ctx.fillRect(alert ? 19 : 17, alert ? -58 : -49, 9, 14);
    ctx.fillStyle = palette.trim;
    ctx.fillRect(alert ? 17 : 17, alert ? -62 : -52, 12, 2);

    ctx.fillStyle = palette.skin;
    ctx.beginPath();
    ctx.arc(0, -94, 18, 0, TAU);
    ctx.fill();
    ctx.fillStyle = palette.dark;
    ctx.beginPath();
    ctx.arc(0, -99, 19, Math.PI, TAU);
    ctx.fill();
    ctx.fillRect(-19, -101, 38, 8);
    ctx.fillStyle = "#213744";
    ctx.beginPath();
    ctx.roundRect(-20, -104, 40, 10, 4);
    ctx.fill();
    ctx.fillStyle = palette.trim;
    ctx.fillRect(-13, -104, 26, 3);
    ctx.fillStyle = "#17222b";
    ctx.beginPath();
    ctx.arc(-6, -93, 2.3, 0, TAU);
    ctx.arc(6, -93, 2.3, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "#78453c";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    if (alert) {
      ctx.moveTo(-5, -84);
      ctx.lineTo(5, -84);
    } else {
      ctx.arc(0, -87, 6, 0.12, Math.PI - 0.12);
    }
    ctx.stroke();

    if (bot.hurt > 0) {
      ctx.strokeStyle = `rgba(255, 246, 184, ${bot.hurt * 4})`;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      for (let i = 0; i < 5; i += 1) {
        const a = i / 5 * TAU + bot.anim;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 25, -58 + Math.sin(a) * 34);
        ctx.lineTo(Math.cos(a) * 34, -58 + Math.sin(a) * 46);
        ctx.stroke();
      }
    }
    if (bot.flash > 0) {
      const glow = ctx.createRadialGradient(gunX + 19, -60, 0, gunX + 19, -60, 19);
      glow.addColorStop(0, `rgba(255,247,170,${bot.flash * 9})`);
      glow.addColorStop(0.35, `rgba(255,153,62,${bot.flash * 7})`);
      glow.addColorStop(1, "rgba(255,122,42,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(gunX + 19, -60, 19, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawEffects(w, h) {
    const viewDist = w / (2 * Math.tan(FOV / 2));
    for (const effect of state.effects) {
      const alpha = clamp(effect.life / effect.ttl, 0, 1);
      if (effect.type === "tracer") {
        const points = [
          projectPoint(effect.x1, effect.y1, w, h, viewDist),
          projectPoint(effect.x2, effect.y2, w, h, viewDist)
        ];
        if (!points[0] || !points[1]) continue;
        ctx.strokeStyle = effect.bot ? `rgba(255, 105, 91, ${alpha * 0.9})` : `rgba(255, 235, 132, ${alpha})`;
        ctx.lineWidth = Math.max(1.5, w / 320);
        ctx.shadowColor = effect.bot ? "#ff665e" : "#ffe075";
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        ctx.lineTo(points[1].x, points[1].y);
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else if (effect.type === "impact") {
        const point = projectPoint(effect.x, effect.y, w, h, viewDist);
        if (!point) continue;
        const radius = (1 - alpha) * 18 + 3;
        ctx.strokeStyle = effect.color || "#ffd166";
        ctx.fillStyle = effect.color || "#ffd166";
        ctx.lineWidth = Math.max(1, w / 700);
        for (let i = 0; i < 6; i += 1) {
          const a = i / 6 * TAU + effect.life * 7;
          ctx.beginPath();
          ctx.moveTo(point.x + Math.cos(a) * radius * 0.25, point.y + Math.sin(a) * radius * 0.25);
          ctx.lineTo(point.x + Math.cos(a) * radius, point.y + Math.sin(a) * radius);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(point.x, point.y, 3 + alpha * 4, 0, TAU);
        ctx.fill();
      }
    }

    if (player.damageFlash > 0) {
      const angle = player.damageAngle;
      const x = w / 2 + Math.sin(angle) * w * 0.23;
      const y = h / 2 - Math.cos(angle) * h * 0.2;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.fillStyle = `rgba(255, 96, 76, ${clamp(player.damageFlash * 2.8, 0, 0.75)})`;
      ctx.beginPath();
      ctx.moveTo(0, -18);
      ctx.lineTo(9, 7);
      ctx.lineTo(0, 2);
      ctx.lineTo(-9, 7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  function projectPoint(x, y, w, h, viewDist) {
    const dx = x - player.x;
    const dy = y - player.y;
    const rel = normalizeAngle(Math.atan2(dy, dx) - player.a);
    if (Math.abs(rel) > FOV / 2 + 0.4) return null;
    const depth = Math.max(0.08, Math.hypot(dx, dy) * Math.cos(rel));
    return {
      x: w / 2 + Math.tan(rel) * viewDist,
      y: cameraHorizon(h) + (viewDist / depth) * 0.02
    };
  }

  function drawWeapon(w, h) {
    if (state.mode !== "playing") return;
    const weapon = currentWeapon();
    const kick = player.recoil * 130 + (player.muzzle > 0 ? 12 : 0);
    const reloadPhase = player.reloading > 0 ? 1 - player.reloading / weapon.reload : 0;
    const reloadDip = player.reloading > 0 ? Math.sin(reloadPhase * Math.PI) * 58 : 0;
    const stride = player.grounded ? Math.sin(player.bob) : 0;
    const baseX = w * 0.58 + stride * 3;
    const baseY = h * 0.88 + kick + reloadDip + Math.abs(stride) * 3 + player.landing * 22;
    const scale = Math.min(w, h) / 620;
    ctx.save();
    ctx.translate(baseX, baseY);
    ctx.scale(scale, scale);
    ctx.rotate(player.reloading > 0 ? Math.sin(reloadPhase * Math.PI) * -0.16 : 0);

    ctx.fillStyle = "#d89168";
    ctx.beginPath();
    ctx.roundRect(-58, 12, 76, 35, 15);
    ctx.fill();
    ctx.fillStyle = "#283f52";
    ctx.beginPath();
    ctx.roundRect(-62, 30, 58, 48, 13);
    ctx.fill();
    ctx.fillStyle = "#182a36";
    ctx.fillRect(-48, 30, 8, 44);

    ctx.fillStyle = "#273b4b";
    ctx.beginPath();
    ctx.roundRect(-18, -22, weapon.id === "rifle" ? 174 : 116, 34, 8);
    ctx.fill();
    ctx.fillStyle = "#425b68";
    ctx.beginPath();
    ctx.roundRect(15, -38, weapon.id === "rifle" ? 137 : 82, 23, 6);
    ctx.fill();
    ctx.fillStyle = "#13252f";
    ctx.fillRect(weapon.id === "rifle" ? 142 : 88, -30, weapon.id === "rifle" ? 62 : 39, 10);
    ctx.fillStyle = "#101d25";
    ctx.beginPath();
    ctx.roundRect(43, 5, 27, 61, 6);
    ctx.fill();
    ctx.fillStyle = "#4cc3d9";
    ctx.fillRect(24, -32, 41, 5);
    ctx.fillStyle = "#f2b84b";
    ctx.fillRect(72, -33, 18, 4);
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(4, -15, weapon.id === "rifle" ? 118 : 69, 5);

    ctx.fillStyle = "#d89168";
    ctx.beginPath();
    ctx.roundRect(38, 30, 49, 25, 11);
    ctx.fill();
    ctx.fillStyle = "#283f52";
    ctx.beginPath();
    ctx.roundRect(72, 37, 56, 52, 13);
    ctx.fill();
    if (player.muzzle > 0) {
      const muzzleX = weapon.id === "rifle" ? 211 : 134;
      const glow = ctx.createRadialGradient(muzzleX, -25, 0, muzzleX, -25, 58);
      glow.addColorStop(0, `rgba(255, 249, 190, ${player.muzzle * 14})`);
      glow.addColorStop(0.3, `rgba(255, 170, 67, ${player.muzzle * 10})`);
      glow.addColorStop(1, "rgba(255, 112, 38, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(muzzleX, -25, 58, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#fff4a8";
      ctx.beginPath();
      for (let i = 0; i < 10; i += 1) {
        const a = i / 10 * TAU;
        const r = i % 2 ? 12 : 42;
        const px = muzzleX + Math.cos(a) * r;
        const py = -25 + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawRadar() {
    const s = radar.width;
    rctx.clearRect(0, 0, s, s);
    rctx.fillStyle = "rgba(6, 12, 16, 0.95)";
    rctx.fillRect(0, 0, s, s);
    const scale = s / Math.max(mapW, mapH);
    rctx.save();
    rctx.translate((s - mapW * scale) / 2, (s - mapH * scale) / 2);
    for (let y = 0; y < mapH; y += 1) {
      for (let x = 0; x < mapW; x += 1) {
        rctx.fillStyle = MAP[y][x] === "1" ? "#53656b" : "#142027";
        rctx.fillRect(x * scale, y * scale, scale - 0.4, scale - 0.4);
      }
    }
    for (const bot of state.bots) {
      if (!bot.alive) continue;
      rctx.fillStyle = bot.alert > 0.05 ? "#e65f5f" : "#d99b43";
      rctx.beginPath();
      rctx.arc(bot.x * scale, bot.y * scale, Math.max(2, scale * 0.22), 0, TAU);
      rctx.fill();
    }
    rctx.fillStyle = "#2bc4a7";
    rctx.beginPath();
    rctx.arc(player.x * scale, player.y * scale, Math.max(2.5, scale * 0.28), 0, TAU);
    rctx.fill();
    rctx.strokeStyle = "#f8fafc";
    rctx.beginPath();
    rctx.moveTo(player.x * scale, player.y * scale);
    rctx.lineTo((player.x + Math.cos(player.a) * 0.8) * scale, (player.y + Math.sin(player.a) * 0.8) * scale);
    rctx.stroke();
    rctx.restore();
  }

  function initAudio() {
    if (state.audio) {
      state.audio.ctx.resume?.();
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const audioCtx = new AudioCtx();
    state.audio = { ctx: audioCtx };
  }

  function playTone(type) {
    if (state.muted || !state.audio) return;
    const audioCtx = state.audio.ctx;
    if (audioCtx.state === "suspended") audioCtx.resume();
    const now = audioCtx.currentTime;
    const gain = audioCtx.createGain();
    gain.connect(audioCtx.destination);
    gain.gain.setValueAtTime(0.0001, now);

    const osc = audioCtx.createOscillator();
    osc.connect(gain);
    osc.type = "square";
    let dur = 0.08;
    let freq = 280;
    let vol = 0.08;

    if (type === "rifle") {
      freq = 110;
      dur = 0.055;
      vol = 0.11;
    } else if (type === "pistol") {
      freq = 150;
      dur = 0.075;
      vol = 0.1;
    } else if (type === "reload") {
      freq = 420;
      dur = 0.16;
      vol = 0.05;
      osc.type = "triangle";
    } else if (type === "hit") {
      freq = 780;
      dur = 0.045;
      vol = 0.07;
      osc.type = "sine";
    } else if (type === "death") {
      freq = 90;
      dur = 0.28;
      vol = 0.08;
      osc.type = "sawtooth";
    } else if (type === "hurt") {
      freq = 70;
      dur = 0.18;
      vol = 0.09;
      osc.type = "sawtooth";
    } else if (type === "bot") {
      freq = 130;
      dur = 0.055;
      vol = 0.055;
    } else if (type === "empty") {
      freq = 900;
      dur = 0.035;
      vol = 0.04;
      osc.type = "triangle";
    } else if (type === "win") {
      freq = 520;
      dur = 0.35;
      vol = 0.08;
      osc.type = "sine";
    } else if (type === "lose") {
      freq = 120;
      dur = 0.35;
      vol = 0.075;
      osc.type = "triangle";
    } else if (type === "round") {
      freq = 340;
      dur = 0.18;
      vol = 0.06;
      osc.type = "sine";
    } else if (type === "jump") {
      freq = 240;
      dur = 0.09;
      vol = 0.035;
      osc.type = "triangle";
      osc.frequency.exponentialRampToValueAtTime(390, now + dur);
    } else if (type === "land") {
      freq = 92;
      dur = 0.07;
      vol = 0.045;
      osc.type = "sine";
    }

    osc.frequency.setValueAtTime(freq, now);
    if (type === "death" || type === "lose") osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.45), now + dur);
    if (type === "win") osc.frequency.exponentialRampToValueAtTime(freq * 1.7, now + dur);
    gain.gain.exponentialRampToValueAtTime(vol, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  function loop(now) {
    const dt = Math.min(0.05, (now - state.lastTime) / 1000 || 0);
    state.lastTime = now;
    update(dt);
    render();
    requestAnimationFrame(loop);
  }

  function handleLook(dx) {
    if (state.mode !== "playing") return;
    player.a = normalizeAngle(player.a + dx * 0.0024);
  }

  document.addEventListener("keydown", (event) => {
    state.keys[event.code] = true;
    if (event.code === "Space") event.preventDefault();
    if (event.code === "Escape" && state.mode === "playing") {
      pauseGame();
    } else if (event.code === "Space" && !event.repeat) {
      jump();
    } else if (event.code === "KeyR") {
      reload();
    } else if (event.code === "Digit1") {
      switchWeapon(0);
    } else if (event.code === "Digit2") {
      switchWeapon(1);
    } else if (event.code === "KeyP" && state.mode === "playing") {
      pauseGame();
    }
  });

  document.addEventListener("keyup", (event) => {
    state.keys[event.code] = false;
  });

  document.addEventListener("mousemove", (event) => {
    if (document.pointerLockElement === canvas) {
      handleLook(event.movementX || 0);
    } else if (state.pointerDown) {
      handleLook((event.clientX || 0) - state.lastPointerX);
      state.lastPointerX = event.clientX || state.lastPointerX;
    }
  });

  canvas.addEventListener("mousedown", (event) => {
    if (state.mode !== "playing") return;
    initAudio();
    requestPointer();
    state.pointerDown = true;
    state.lastPointerX = event.clientX;
    if (event.button === 0 && !currentWeapon().auto) shoot();
    if (event.button === 0 && currentWeapon().auto) shoot();
  });

  document.addEventListener("mouseup", () => {
    state.pointerDown = false;
    state.lastShotHeld = false;
  });

  canvas.addEventListener("touchstart", (event) => {
    if (state.mode !== "playing") return;
    const touch = event.touches[0];
    state.pointerDown = true;
    state.touchLook = true;
    state.lastPointerX = touch.clientX;
    shoot();
    event.preventDefault();
  }, { passive: false });

  canvas.addEventListener("touchmove", (event) => {
    if (!state.touchLook || state.mode !== "playing") return;
    const touch = event.touches[0];
    handleLook(touch.clientX - state.lastPointerX);
    state.lastPointerX = touch.clientX;
    event.preventDefault();
  }, { passive: false });

  canvas.addEventListener("touchend", () => {
    state.pointerDown = false;
    state.touchLook = false;
  });

  document.addEventListener("pointerlockchange", () => {
    if (state.mode === "playing" && state.pointerSupported && document.pointerLockElement !== canvas && !state.pointerDown) {
      pauseGame();
    }
  });

  buttons.start.addEventListener("click", startRound);
  buttons.controls.addEventListener("click", () => ui.controls.classList.toggle("hidden"));
  buttons.resume.addEventListener("click", resumeGame);
  buttons.restartPause.addEventListener("click", startRound);
  buttons.restart.addEventListener("click", startRound);
  buttons.menu.addEventListener("click", () => {
    showOnly("menu");
    updateBestStats();
  });
  ui.mute.addEventListener("click", () => {
    state.muted = !state.muted;
    localStorage.setItem("tacticalArena.muted", String(state.muted));
    updateHud();
  });

  window.addEventListener("resize", resize);
  updateBestStats();
  updateHud();
  resize();
  requestAnimationFrame(loop);

  window.__TACTICAL_ARENA_DEBUG__ = {
    startRound,
    pauseGame,
    resumeGame,
    shoot,
    reload,
    switchWeapon,
    jump,
    damagePlayer,
    killAllBots() {
      for (const bot of state.bots) {
        if (bot.alive) damageBot(bot, 999);
      }
    },
    getState() {
      return {
        mode: state.mode,
        health: player.health,
        ammo: player.ammo.slice(),
        reserve: player.reserve.slice(),
        weapon: currentWeapon().id,
        botsAlive: state.bots.filter((bot) => bot.alive).length,
        score: state.score,
        timeLeft: state.timeLeft,
        bestScore: state.bestScore,
        fastestClear: state.bestTime,
        player: {
          x: Number(player.x.toFixed(3)),
          y: Number(player.y.toFixed(3)),
          z: Number(player.z.toFixed(3)),
          vz: Number(player.vz.toFixed(3)),
          grounded: player.grounded,
          angle: Number(player.a.toFixed(3))
        },
        botHealth: state.bots.map((bot) => Math.max(0, Math.ceil(bot.hp))),
        botStates: state.bots.map((bot) => bot.state),
        botPositions: state.bots.map((bot) => ({ x: Number(bot.x.toFixed(3)), y: Number(bot.y.toFixed(3)), z: Number(bot.z.toFixed(3)) })),
        canvas: { width: canvas.width, height: canvas.height }
      };
    },
    setPlayerPosition(x, y, angle = player.a) {
      if (!isWall(x, y)) {
        player.x = x;
        player.y = y;
        player.a = angle;
      }
    },
    setBotPosition(index, x, y) {
      const bot = state.bots[index];
      if (bot && !isWall(x, y)) {
        bot.x = x;
        bot.y = y;
        bot.state = "attack";
        bot.alert = 1;
      }
    }
  };
})();
