# OPX//77 framework

**Documentation site: https://opx77-framework.github.io/opx_docs/** (built from this repository and the README of every `opx_*` repository).

Serious-roleplay framework for [Open77](https://open2077.net) (Cyberpunk 2077 multiplayer), split into small resources
you can edit one at a time. Every UI is NativeUI (RML + RCSS), no WebUI build.

| Resource | Role |
|---|---|
| [`opx_core`](https://github.com/opx77-framework/opx_core) | players, characters data, money, jobs, metadata, server callbacks, staff commands |
| [`opx_dialog`](https://github.com/opx77-framework/opx_dialog) | centred input forms, typed fields and validation (`require('@opx_dialog')`) |
| [`opx_menu`](https://github.com/opx77-framework/opx_menu) | menus, dialogs, confirms (`require('@opx_menu')`) |
| [`opx_target`](https://github.com/opx77-framework/opx_target) | targeting eye + context menu: hold ALT, right click a target (`require('@opx_target')` or exports) |
| [`opx_notification`](https://github.com/opx77-framework/opx_notification) | toast notifications |
| [`opx_hud`](https://github.com/opx77-framework/opx_hud) | status HUD, help line |
| [`opx_chat`](https://github.com/opx77-framework/opx_chat) | NativeUI roleplay chat: RP channels, commands and suggestions (replaces `open77_chat`) |
| [`opx_admin`](https://github.com/opx77-framework/opx_admin) | staff menu (F10): players, noclip, vehicles, weather, bans, reports |
| [`opx_weather`](https://github.com/opx77-framework/opx_weather) | time and weather API over the platform environment, private skies |
| [`opx_skin`](https://github.com/opx77-framework/opx_skin) | clothing API: wear, preview, uniforms, saved outfits (provider of the skin slot) |
| [`opx_clotheshop`](https://github.com/opx77-framework/opx_clotheshop) | clothing shop and barber points that open the creator in a scope |
| [`opx_creator`](https://github.com/opx77-framework/opx_creator) | in-world character creator (NativeUI) over `Open77.body` + `open77_appearance` |
| [`opx_inventory`](https://github.com/opx77-framework/opx_inventory) | items with metadata, stashes, weapons, give commands; a simple opx_menu list |
| [`opx_weapons`](https://github.com/opx77-framework/opx_weapons) | registers the weapon and ammo items (equipping is opx_inventory's) |
| [`opx_example`](https://github.com/opx77-framework/opx_example) | reference resource for developers (a small job), not loaded by default |
| [`opx_bank`](https://github.com/opx77-framework/opx_bank) | bank menu at ATMs: deposit, withdraw, transfer to a player id, history |
| [`opx_progress`](https://github.com/opx77-framework/opx_progress) | timed action bar with cancel and control blocking |
| [`opx_society`](https://github.com/opx77-framework/opx_society) | boss menu shared by every job: hire, fire, grades, society money |
| [`opx_medical`](https://github.com/opx77-framework/opx_medical) | downed state, emergency menu (wait / call Trauma Team / hospital respawn), revive API |
| [`opx_needs`](https://github.com/opx77-framework/opx_needs) | hunger and thirst, animated eating and drinking |
| [`opx_traumateam`](https://github.com/opx77-framework/opx_traumateam) | Trauma Team job: duty, uniform, dispatch, revive, Silver / Gold / Platinum plans |
| [`opx_garage`](https://github.com/opx77-framework/opx_garage) | garages and impound |
| [`opx_dealership`](https://github.com/opx77-framework/opx_dealership) | car dealer job, catalogue, test drive, self-service kiosk |
| [`opx_doors`](https://github.com/opx77-framework/opx_doors) | doors in config with job / grade / citizen keys |
| [`opx_logs`](https://github.com/opx77-framework/opx_logs) | journal of money, jobs, deaths, vehicles and staff actions, `/logs` |
| [`opx_shops`](https://github.com/opx77-framework/opx_shops) | shops in config |
| [`opx_emotes`](https://github.com/opx77-framework/opx_emotes) | emote menu, hands up, point |
| [`opx_vehiclekeys`](https://github.com/opx77-framework/opx_vehiclekeys) | vehicle keys and locks, engine, trunk |
| [`opx_billing`](https://github.com/opx77-framework/opx_billing) | bills from a job to a player |
| [`opx_rental`](https://github.com/opx77-framework/opx_rental) | timed vehicle rental with a deposit |
| [`opx_character`](https://github.com/opx77-framework/opx_character) | character selection, creation, deletion, spawn, `/logout` |

The look is persisted by the official Open77 resources, not by OPX: `open77_appearance` (per-character body and
clothing) and `open77_equipment` (clothing relay). `opx_creator` is our creator on their building blocks; the
official `open77_creator` is no longer used. The former `opx_skin` is retired (`_legacy/retired/opx_skin`).

Every swappable service (14 slots: notifications, HUD, creator, menu, dialog, target, weather, inventory, progress,
medical, society, logs, vehicle keys, skin) is a **provider** named in one place, opx_core's `Config.providers`; a replacement only has to implement the contract in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) › Replacing a resource.

## Requirements

- Open77 server and clients **2.50.0+op77.228** or newer (NativeUI needs op77.212, runtime character creation op77.228).
- MySQL / MariaDB enabled in `server.jsonc` (`database`). Tables are created at start.
- Platform resources `open77_appearance` (>= 0.5.0) and `open77_equipment` loaded (not `open77_creator`).

## Install

Clone each `opx_*` repository of [opx77-framework](https://github.com/opx77-framework) into the server's resource root, then load them in this order:

```jsonc
// server.jsonc
"resources": {
  "load": [
    // platform (official system resources, the strict minimum OPX needs)
    "open77_prediction",
    "open77_shell",
    "open77_pause",
    "open77_voice",
    "open-voice",
    "open77_weapons",
    "open77_animations",
    "open77_prevention",
    "open77_traffic",
    "open77_pedestrians",
    "open77_weather",
    "open77_elevators",
    "open77_doors",
    "open77_appearance",
    "open77_equipment",
    "open77_wardrobe",
    // OPX
    "opx_core",
    "opx_weather",
    "opx_dialog",
    "opx_menu",
    "opx_logs",
    "opx_admin",
    "opx_target",
    "opx_notification",
    "opx_chat",
    "opx_hud",
    "opx_skin",
    "opx_creator",
    "opx_inventory",
    "opx_weapons",
    "opx_bank",
    "opx_progress",
    "opx_society",
    "opx_medical",
    "opx_needs",
    "opx_traumateam",
    "opx_garage",
    "opx_dealership",
    "opx_doors",
    "opx_shops",
    "opx_clotheshop",
    "opx_emotes",
    "opx_vehiclekeys",
    "opx_billing",
    "opx_rental",
    "opx_character"
  ]
},
"convars": {
  "open77_appearance_creation": "runtime"   // new characters are built in the world (opx_creator)
}
```

Each resource has a `config.lua` (the only file to edit), `locales/en.json` + `locales/fr.json`, a `types.lua` describing
its exports, and a README.

## For developers

The contract between resources (data shapes, exports, events) is [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Documentation site

The site is Fumadocs (Next.js, static export) deployed to GitHub Pages by `.github/workflows/deploy.yml`.
`scripts/build-content.mjs` generates its pages from `README.md`, `docs/*.md` and the README of every `opx_*` repository;
it runs on every push here and every 6 hours. Locally: `npm ci && npm run dev`.
