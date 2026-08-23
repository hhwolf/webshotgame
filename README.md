# Tactical Arena

Tactical Arena is a dependency-free browser arena shooter with a colorful pseudo-3D raycast renderer, animated cartoon bots, two weapons, five campaign levels, generated audio, radar, score persistence, and a complete three-minute round loop.

The campaign mixes elimination, collection, and hold-zone objectives. Rifle, rusher, heavy, and scout bots have distinct silhouettes and combat behavior. Players choose temporary upgrades after their second and fourth eliminations, unlock weapon colors through high scores, and can copy a shareable score card after each round. An adaptive director adjusts bot pressure using the local win history.

After each round, the game can copy an anonymous local playtest report containing completion, win, replay, control-use, FPS, and error metrics. No data is transmitted by the game.

## Playtest benchmark

Use one fresh browser profile per tester and collect the copied report after they stop playing. For a 10-person casual desktop test, the MVP succeeds when:

- At least 8 testers finish a round and at least 5 immediately start another.
- 1-3 testers win their first completed round, centering the difficulty target near 20%.
- At least 8 testers use movement, aiming, shooting, and jumping in one round.
- Average rendering stays at or above 55 FPS with zero recorded runtime errors.
- At least 7 testers rate both visual polish and control smoothness 4/5 or better when asked afterward.
- At least 6 testers say they would share the game with a friend in its current state.

## Play locally

```bash
python3 -m http.server 4789 --bind 127.0.0.1
```

Open `http://127.0.0.1:4789`.

## Controls

- `WASD`: move relative to the current aim direction
- `Space`: jump
- Mouse: aim
- Left click: shoot
- `R`: reload
- `1` / `2`: switch weapons
- `Esc`: pause or release pointer lock

The game uses original geometric artwork and generated Web Audio effects. No third-party game assets or copyrighted franchise material are included.

Each arena also contains two single-use health kits that restore 40 health, with additional healing from the Reinforced upgrade.
