# The Snap League

The Snap League is a compact Three.js browser arena shooter with articulated toy-like rivals, dimensional cartoon faces, role-specific silhouettes, layered first-person arms and weapons, six landmark-driven multi-floor campaign arenas, generated audio, radar, score persistence, and a complete three-minute match loop. It retains the launchable app name **Tactical Arena**.

The campaign mixes elimination, collection, and hold-zone objectives across connected decks. Rifle, rusher, heavy, and scout bots have distinct silhouettes and combat behavior, and the three-floor Apex Foundry finale adds the shielded, multi-phase Atlas boss. Players choose temporary upgrades after their second and fourth eliminations, unlock weapon colors through high scores, and can copy a shareable score card after each round. A per-arena adaptive director targets a 20% win rate by tuning bounded bot reaction, movement, accuracy, and firing pressure from recent local results.

After each round, the game can copy an anonymous local playtest report containing completion, win, replay, control-use, FPS, and error metrics. No data is transmitted by the game.

## Playtest benchmark

Use one fresh browser profile per tester and collect the copied report after they stop playing. For a 10-person casual desktop test, the MVP succeeds when:

- At least 8 testers finish a round and at least 5 immediately start another.
- 1-3 testers win their first completed round, centering the difficulty target near 20%.
- At least 8 testers use movement, aiming, shooting, and jumping in one round.
- Balanced rendering stays at or above 60 FPS with a fifth-percentile rate of at least 50 FPS and zero recorded runtime errors.
- At least 7 testers rate both visual polish and control smoothness 4/5 or better when asked afterward.
- At least 6 testers say they would share the game with a friend in its current state.

## Play locally

```bash
npm install
npm run dev
```

Use the local URL printed by Vite.

For a production build:

```bash
npm run build
```

## Controls

- `WASD`: move relative to the current aim direction
- `Space`: jump
- `E`: use a nearby lift
- Mouse: aim
- Left click: shoot
- `R`: reload
- `1` / `2`: switch weapons
- `Esc`: pause or release pointer lock

The game uses original procedural geometry, generated Web Audio effects, and Three.js under its MIT license. No third-party game artwork or copyrighted franchise material is included. See [ATTRIBUTION.md](ATTRIBUTION.md).

Every floor includes access to single-use health kits that restore 40 health, with additional healing from the Reinforced upgrade.
