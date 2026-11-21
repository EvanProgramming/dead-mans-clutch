# Dead Man’s Clutch

**Beat your own hearse to the cemetery and you get your body back.**

A single-player browser racer made for the **Bounce Back!** game-jam theme. Drive three laps of Shade County Oval. Your starter wagon tops out at 92 mph. The hearse cruises at 134. Trade paint with the 55-car traffic field, then use a hard hit to steal a faster windshield. Your old car keeps rolling. It can punch through the hay gate at Turn Two, shove another wreck, or block the hearse on the next lap.

![A helmeted ghost and the number thirteen muscle car on the starting screen](press/starting-grid.jpg)

## Controls

| Action | Input |
| --- | --- |
| Accelerate / brake | W / S or ↑ / ↓ |
| Steer left / right | A / D or ← / → |
| Pick a windshield during slow motion | Aim the pointer at a marked car, or press ← / → |
| Jump into the highlighted car | Release the mouse over its windshield, release Space, or press **Jump** |
| Keep the current car, or call a tow if totaled | X or the **Stay / Tow** button |
| Pause / resume | Esc or the pause button |
| Restart immediately | R |
| Mute / unmute | M or the speaker button |

On a touch display, hold the on-screen gas, brake, and steering buttons. Tap a highlighted car to possess it. The oval guides your car through each bend, leaving you in control of its racing line. The green map dot is you. The red diamond is the hearse.

## Play and build

Download **play-dead-mans-clutch.html** from the [release](https://github.com/EvanProgramming/dead-mans-clutch/releases/latest) and open it in a browser. The standalone edition works offline. Audio starts after a gesture. Best winning time and mute preference are saved in your browser when local storage is available.

To play from source, run this in the repository root and open [the local game](http://127.0.0.1:8000).

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Build with Python 3.8+ and run the simulation checks with Node 20+.

```sh
python3 tools/build.py
node --test tests/*.test.mjs
```

The build writes `dist/dead-mans-clutch-itch.zip` and `dist/play-dead-mans-clutch.html`. The zip contains the standalone build as its root `index.html` and a license file. The build embeds the original art, font, sound synthesis and game code. It needs no package install, CDN, server API, special response headers, or shared memory.

## Design note

The comeback is the player's biggest move. At speed, a wagon can break a barricade that a coupe would rather drive around. A well-placed impact gives you two things to aim: the wreck you're leaving behind and the windshield where you want to land. The hearse can take any shortcut you open.

The three cars reward different lines. The coupe accelerates and changes lanes fastest. The wagon is steady under contact. The tow truck takes less damage and transfers more momentum into a pileup. One track, one rival and persistent wrecks keep each decision visible across three laps. A short engine cut, bent sheet metal, and an arcing ghost make the handoff readable at a glance.

## Release playtest

The grid has 57 running cars and three persistent wrecks. Faster packs catch backmarkers and drivers look for passing lanes. A bumper rub costs speed. A hard rear-end impact or sideswipe opens a clutch window. Each windshield shows its top speed. The coupe reaches 170 mph.

The first edition could be won in the starter on a clean inside line. On the longer oval, the starter loses even with clear track. Holding gas on the opening straight now reaches a moving backmarker in about 11 seconds. Fixed 60 Hz physics keeps that opening consistent on different refresh rates. The revised course keeps its own best time.

Chromium played the extracted release in an iframe. Taking the coupe and working through traffic won in 1:58.0. Declining all six transfer windows lost in 1:57.8. The game made no external requests and logged no browser errors.

The 24-test regression suite checks contact across the start line, clearance on the inner bank, recovery into traffic, matching-speed sideswipes, and an entire race checked for overlapping bodywork on every physics tick. Trackside fences, chalk stripes, dust and engine shifts convey the acceleration. The camera settles during possession.

## Suggested itch.io listing

**Title** — Dead Man’s Clutch

**Short description** — Crash your muscle car. Steal the next windshield. Beat your own hearse around a haunted dirt oval and win your body back.

**Page copy** — Welcome to Shade County Speedway. The hearse has your body, the pit crew has stopped asking questions, and you have three laps to catch it. Send a wagon through the hay bales at Turn Two and jump into a passing coupe. Remember where you left that wreck. You'll be back.

**Controls** — WASD or arrows to drive. On impact, aim and click a windshield or select it with the arrows and release Space. X stays in the car. Esc pauses, R restarts, M mutes.

**Upload settings** — Select HTML, upload the itch zip, and enable browser play. Use a 960 × 540 embed with the fullscreen button. The game adapts to other window sizes. [itch.io HTML5 guide](https://itch.io/docs/creators/html5)

**Screenshot moments**

- [Starting grid](press/starting-grid.jpg) — the illustrated cover and county speedway race card.
- [Windshield jump](press/windshield-jump.jpg) — the ghost between the battered wagon and its next ride.
- [Turn Two](press/turn-two.jpg) — lap two with the shortcut broken open.
- [The cemetery finish](press/cemetery-finish.jpg) — the coupe and hearse on their last approach to the stripe.

## Credits and license

Game design, simulation, Canvas track art, car sprites, SVG cover, title lettering, interface, and synthesized music and sound effects were created for this project with Codex. The illustrations are authored vector geometry. The soundtrack is generated with Web Audio oscillators, filtered noise and envelopes. All original material is under the [MIT License](LICENSE).

Barlow Condensed SemiBold is by Jeremy Tribby and the Barlow Project Authors, used under the [SIL Open Font License 1.1](assets/OFL-Barlow.txt). The unmodified typeface is bundled locally. [Font source](https://github.com/google/fonts/tree/main/ofl/barlowcondensed)
