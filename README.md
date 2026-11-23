# Solara

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Jr-kenny/solara/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Jr-kenny/solara/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Solara is an original open-world crime game set in a sun-soaked coastal city, built for make.fun's "Make GTA 6" bounty. There is nothing here from any commercial game: the city, the characters, the cars, the story and the sounds are all made for this entry.

You start on foot in a 3840 by 2560 city with six districts, from the marina to the beachfront. Steal a car and drive it, or walk the streets and take what you need. Traffic fills the roads, pedestrians fill the sidewalks, and the SPPD answers every crime with a wanted level that follows you until you lose them or they catch you. Getting busted or wasted costs you 20 percent of your cash.

Mara Voss, the fixer who runs the marina, has four jobs for you: steal a coupe and deliver it across town, collect from three shops while the heat rises, survive a full minute with the whole department on you, and drive a getaway van to the docks with four stars on your tail. Finish all four and the city is yours. Between jobs, taxi fares pay the bills. Your money, story progress and best haul save in the browser.

## Play it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome.

Controls: WASD to move and drive, Shift to run, E to enter and exit cars, Q to punch, F to shoot once you have the pistol, Enter to start a job, T for a taxi fare, Space for the handbrake, P to pause, M to mute.

## Inside the entry

- `game/`: the whole game as plain static files: `index.html` and `src/`, with one job per file (world, city, missions, render, audio, input, save, shots).
- `main.ts`: the Node 22 handover. It copies `game/` and `screenshots/` into the output directory and writes `dossier.json`.
- `screenshots/`: four real renders of the running game: a police chase, a walk through downtown, a taxi fare in traffic, and a mission in progress.
- `serve.ts`: a small static server for local play.
- `vendor/makefun-game.ts`: the kit's game library, unchanged.

No libraries, no network requests, no external assets. Every pixel is drawn in code and every sound is synthesized with WebAudio.

---

<sub>Entered on [make.fun](https://make.fun/?ref=d40g50pd&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
