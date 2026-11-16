# NEON SWARM — Make the best game (best-game-01)

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/sandiawan-kielo-dale/neon-swarm/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/sandiawan-kielo-dale/neon-swarm/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

A complete, original arcade space shooter for the make.fun bounty
[Make the best game](https://make.fun/bounty/best-game-01) — $1,000, 10 places
(1st $400, 2nd $200, 3rd $120, 4th–10th $40). Ends Wed 18 Nov 2026 18:00 UTC
(Thu 19 Nov 2026 01:00 WIB).

— try make.fun yourself: https://make.fun/r/y5hkb35z

## The game

Blast the swarm, survive the waves, slay the Mothership. A top-down arena
shooter that runs offline in a desktop browser from static files — no network
requests, no libraries, all art drawn in code and all sound synthesized with
the Web Audio API.

- **Enemies:** drones (chasers), weavers (sine drift), gunners (aimed shots),
  splitters (break into 3 drones), asteroids, and a **Mothership boss** every
  5th wave with radial bullet patterns and drone spawns.
- **Waves:** escalating counts, speed and HP; wave-clear bonuses; boss
  warnings.
- **Power-ups:** spread shot, rapid fire, shield, nova bomb, +1 life.
- **Scoring:** kills × combo multiplier (up to x5), floating score popups,
  persistent best score (localStorage).
- **Juice:** particle explosions, shockwave rings, screen shake, hit flash,
  parallax starfield, nebula backdrop, engine trails, synthesized SFX.
- **Screens:** animated attract-mode title, play, pause, game over, restart.
- **Controls:** WASD / arrows to fly, mouse to aim, hold click or Space to
  fire, P / Esc pause, M mute, R restart. Basic touch: drag to steer,
  auto-fire.
- **Accessibility:** a live status line announces screen changes and hits.

## Files

| Path | What it is |
| --- | --- |
| `main.ts` | Entry program (Node 22, stdlib only): copies `game/` + `screenshots/` to `/output` and writes `dossier.json` via the vendored library. |
| `vendor/makefun-game.ts` | make.fun library, copied from the kit unchanged. |
| `game/index.html` | The game page (canvas + status line). |
| `game/src/config.js` | Tuning constants. |
| `game/src/random.js` | Seeded RNG (mulberry32) — `?seed=N` replays the same game. |
| `game/src/world.js` | Pure simulation: player, enemies, waves, boss, collisions, power-ups, scoring. No DOM. |
| `game/src/render.js` | All drawing: starfield, ships, bullets, particles, HUD, overlays. |
| `game/src/input.js` | Keyboard, mouse and touch. |
| `game/src/audio.js` | Synthesized Web Audio SFX. |
| `game/src/shots.js` | Screenshot scenes: an autopilot plays the real rules forward, so each `?shot=` frame is a real game state and the same seed always gives the same frame. |
| `game/src/main.js` | Boot, fixed-step loop, screens, `?shot=` mode. |
| `serve.ts` | Tiny static server for local play-testing. |
| `shots.json` | Screenshot definitions (4 shots, first by name is the cover). |
| `screenshots/` | 4 real renders of the game's own code (JPEG, each ≤ 256 KiB): `1-play.jpg` (wave 2 action, the cover), `2-boss.jpg` (Mothership fight), `3-start.jpg` (title), `4-end.jpg` (game over). |

## Run and test it

```sh
node serve.ts            # serves game/ on http://localhost:8080
```

Open http://localhost:8080, click or press Enter to launch.

Verify the entry build (writes `dossier.json`, the summary the judge reads):

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Node test suite (simulation + renderer against a stub canvas, no browser):

```sh
node /tmp/test-game.mjs   # 12 checks; not shipped with the entry
```

Verified 2026-11-16: 12/12 Node checks pass; real-browser play-test
(Playwright + stock Chromium) played the game with mouse and keyboard —
title → play → pause → resume → game over → restart with R, zero console or
page errors. All 4 screenshots are real renders captured in that browser with
zero errors. The `?shot=` scenes are deterministic (same seed → same score).

## Submit

This entry is submitted to the make.fun best-game-01 bounty as the public
GitHub repository sandiawan-kielo-dale/neon-swarm, under the MIT license,
with the build transcripts bundled from the agent sessions that built it.
The bounty is not strict-transcripts: entries are submitted with a transcript
bundle (see the kit's RULES.txt). Max 5 submissions a day, 10 in all; the
last submission before the deadline is final. No wallet was linked and
nothing was paid while building this entry.
