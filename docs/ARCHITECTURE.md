# OPX//77 — multi-resource architecture (contract)

This file is the **contract** every `opx_*` resource follows. A resource may add to its own API,
but it never changes a name, a signature or a payload shape listed here without updating this file.

The previous single resource (`opx_infinity`, in `_legacy/opx_infinity`) is **not a reference**: nothing is
based on it. Work from the Open77 docs (devkit) and the official system resources of the current build, and
use those resources instead of re-implementing them. The public API only grows: additions are fine, and a rename ships with an alias for the old name.

## Resources and load order

```text
resources/
  opx_core/        framework: players, characters (data), money, job registry, metadata, owned vehicles, callbacks, commands
  opx_weather/     time and weather API over Open77.environment (provider of the weather slot)
  opx_menu/        NativeUI menus, dialogs and confirms (client library + assets)
  opx_target/      NativeUI targeting eye + context menu (client library + exports, provider of the target slot)
  opx_notification/ NativeUI toast notifications (provider of the notify slot)
  opx_hud/         NativeUI HUD: status, money/job, vehicle, voice (replaces open-voice's line), help text
  opx_admin/       staff menu (F10, opx_menu): noclip; server-side ACL; other resources add rows (AddAction)
  opx_chat/        NativeUI roleplay chat: server-routed RP channels, commands + completion; replaces open77_chat
  opx_creator/     in-world character creator (NativeUI) over Open77.body + open77_appearance
  opx_character/   character selection, creation (name form), deletion, spawn, relog
  opx_inventory/   items, metadata, stashes and weapons in its own table (opx_menu list, give commands)
  opx_bank/        bank menu at ATMs: deposit, withdraw, transfer to a player id, history
  opx_progress/    NativeUI timed action bar (client exports Start/IsActive/Cancel)
  opx_society/     boss menu shared by every job: hire, fire, grades, society money (provider of the society slot)
  opx_medical/     downed state, emergency menu (wait / call / hospital respawn), revive API (provider of the medical slot)
  opx_needs/       hunger and thirst: decay, damage at zero, animated eating and drinking
  opx_traumateam/  Trauma Team job: grades, duty, uniform, dispatch, revive / treat, Silver / Gold / Platinum plans
  opx_garage/      garages and impound over opx_core's owned vehicles
  opx_dealership/  car dealer job: catalogue, confirmed sales, commission, test drive, self-service kiosk
  opx_skin/        clothing API over open77_appearance: wear, preview, uniforms, saved outfits (provider of the skin slot)
  opx_clotheshop/  clothing shop and barber points: open opx_creator in a scope, pay on confirm
  opx_doors/       doors declared in config (job / grade / citizen keys) over open77_doors, lock state saved
  opx_logs/        journal in table opx_logs (money, jobs, deaths, vehicles, staff...), /logs (provider of the logs slot)
  opx_shops/       shops in config, paid cash then bank
  opx_emotes/      emote menu over open77_animations profiles, hands up / point keys, /e
  opx_vehiclekeys/ vehicle keys and locks (U), duplicate keys, engine, trunk stash (provider of the vehiclekeys slot)
  opx_billing/     bills from a job to a player, /bills to pay the society
  opx_rental/      timed vehicle rental with a deposit refunded on return
```

The look is **persisted** by the official platform resources, never re-implemented: `open77_appearance`
(per-character body and clothing persistence) and `open77_equipment` (clothing relay). **Creation** is
`opx_creator`: our own NativeUI creator on the official building blocks (`Open77.body.catalog / active /
compose / decompose / switch` for the catalogue and the live preview, `open77_appearance:setBodyFamily(...,
true)` to apply, replicate and persist). It stores only the creator choices (`opx_creator_looks`), never a
body. The official `open77_creator` is no longer used. `opx_skin` is retired (`_legacy/retired/opx_skin`);
`open77_wardrobe_ui` is not wired yet.

`server.jsonc` → `resources.load`: the full ordered list (platform minimum + every OPX resource) is in the root
[`README.md`](../README.md) › Install. Never load `open77_creator`, `open77_chat` or `open77_contextmenu` next to OPX. Convar: `open77_appearance_creation = "runtime"` (new
characters are built in the world; opx_character also calls `setCreationMode("runtime")` at start). The former
`open77_creator_open_new` / `open77_creator_command` convars can go.

Platform target: Open77 **2.50.0+op77.228 or later** (NativeUI needs op77.212, `Open77.body.*` op77.225, runtime
character creation op77.228).
Every UI is **NativeUI** (`Open77.ui`, RML + RCSS). No WebUI, no Vue, no npm build.

## Code style (reference: github.com/DemiAutomatic/object_gizmo)

Each resource looks like this:

```text
opx_x/
  open77.lua          manifest (Open77 DSL, not fxmanifest)
  config.lua          `Config = {}` + one short comment per setting. The ONLY file an owner edits.
  types.lua           LuaLS `---@meta` file documenting every export and data shape (not loaded by the manifest)
  README.md           what it does, install, config, exports, events
  locales/en.json     player-facing text; locales/fr.json too
  client/main.lua     client entry; client/modules/*.lua for pieces (loaded via local `require` on the client)
  server/main.lua     server entry; server has NO `require`: split into several `server_script` files in order
  ui/*.rml, ui/*.rcss NativeUI documents, declared in `files`
  images/...          images the resource shows, shipped in the resource (no CDN, no Fivemanage)
```

Rules:
- Short, useful comments. No multi-paragraph essays. Readable functions, early returns, locals.
- English identifiers and comments; text shown to players comes from `locales/*.json` (en + fr).
- Server is authoritative: every client request is validated server-side (types, ranges, ownership, rate).
- Check every Open77 native with the devkit MCP (`open77_search`, `open77_api`) before using it — never guess.
  Declare exactly the permissions the natives need. Run `open77_validate` on the resource directory when done.
- Use `Open77.log.*` or `print` with a `[opx_x]` prefix. No debug spam.
- Database tables are prefixed `opx_`. `CREATE TABLE IF NOT EXISTS` at start. No migrations.
- Every resource ships `server/version.lua` (local copy, no shared lib) and `Config.versionCheck`: at start it compares
  its manifest `version` with `opx77-framework/<resource>` on GitHub and prints `[opx_x] update available: a -> b`.
  Bump `version` in `open77.lua` on every release, or servers never hear about it.

## Cross-resource communication (Open77 facts)

- **Server → server**: host-wide bus. `TriggerEvent(name, ...)` reaches every server resource's
  `AddEventHandler`. `source` is not propagated: pass it as the first argument.
  Server exports: `exports("Name", fn)` (or manifest `server_exports { ... }`), called with
  `exports.opx_core:Name(...)` when the server proxy supports it, else `Open77.exports.callSync("opx_core", "Name", ...)`.
  Verify with `open77_api exports --runtime server` and `Open77.exports.callSync`.
- **Client → client (other resource)**: exports only, `Open77.exports.call(res, name, ...)` (promise, `:await()`)
  or `Open77.exports.callSync`. There is no `exports.res:fn()` proxy on the client. Values are copied: **no
  functions cross a VM**. A client `TriggerEvent` is documented as VM-local: do not rely on it across resources,
  except the platform events the official resources document as such (`open77:appearance:hold`, raised by a
  creator while it previews bodies on the player).
- **Client libraries**: `require('@opx_menu')`, `require('@opx_core')` load published `files` of a declared
  `dependency` into the CALLER's VM — that is how callback-style APIs (functions) are offered.
- **Server ↔ client**: net events (`network.events` permission). A server `TriggerClientEvent` reaches every
  client resource that `RegisterNetEvent`ed that name.

## opx_core

### PlayerData (the one shape passed around)

```lua
{
  source = 12,
  identifier = "license:...",        -- account key (Open77 license identifier)
  citizenId = "AB123456",            -- character key
  firstname = "Judy", lastname = "Alvarez", birthdate = "2052-03-14",
  family = "female",                 -- body family: "male" | "female"
  accounts = { money = 500, bank = 5000 },
  job = { name = "unemployed", label = "...", grade = 0, gradeName = "...", gradeLabel = "...", salary = 10, onDuty = true,
          type = nil, available = true },  -- available = false while the job is not registered (label = name, no pay)
  metadata = { hunger = 100, thirst = 100, health = 0.8 },   -- free key/value; health = fraction 0..1 sampled on save
  position = { x = 0.0, y = 0.0, z = 0.0, heading = 0.0 } | nil,
  isNew = true,                      -- true until opx_character marks the creation as finished
}
```

### Server exports

| Export | Returns |
|---|---|
| `GetPlayer(source)` | PlayerData or nil |
| `GetPlayerByCitizenId(citizenId)` | PlayerData or nil |
| `GetPlayers()` | array of sources with a loaded character |
| `GetIdentifier(source)` | account identifier string or nil |
| `GetMoney(source, account)` | number |
| `AddMoney(source, account, amount, reason)` | `true` or `false, err` |
| `RemoveMoney(source, account, amount, reason)` | `true` or `false, err` (refuses below zero) |
| `SetMoney(source, account, amount, reason)` | `true` or `false, err` |
| `SetJob(source, name, grade)` | `true` or `false, err` |
| `SetDuty(source, onDuty)` | `true` or `false, err` |
| `RegisterJob(name, definition)` | `true` or `false, reason`; the calling resource owns the job (see Jobs below) |
| `UnregisterJob(name)` | `true` or `false, reason` (`not_owner`, `unknown_job`, `protected` for the fallback) |
| `GetJob(name)` | registered job (copy) or nil |
| `GetJobs()` | the job registry (copies), fallback included |
| `GetMetadata(source, key)` / `SetMetadata(source, key, value)` | value / `true` or `false, err` |
| `Notify(source, message, type?, duration?, title?, options?)` | sends `opx:notify` to that client; `options = { id?, persist? }`, the id is forwarded as `"<calling resource>:<id>"` |
| `RegisterCallback(name, exportName)` | registers a server callback answered by the CALLING resource's export `exportName(source, ...)` (owner from `GetInvokingResource()`) |
| `GetCharacters(source)` | array of `{ citizenId, firstname, lastname, birthdate, family, job, accounts, lastPlayed, isNew }` for that account, or `nil, 'db_error'` when the account could not be loaded |
| `GetSlots(source)` | max characters for that account |
| `CreateCharacter(source, info)` | `citizenId` or `nil, err`. `info = { firstname, lastname, birthdate, family? }` validated; `family` defaults to `'male'` (open77_appearance's runtime default) |
| `DeleteCharacter(source, citizenId)` | `true` or `false, err` (must belong to the account) |
| `LoadCharacter(source, citizenId)` | PlayerData or `nil, err` (must belong to the account) |
| `UnloadCharacter(source)` | `true` — saves then unloads (used by relog) |
| `SaveCharacter(source)` | `true` or `false, err` |
| `SetCharacterCreated(source)` | clears `isNew` and saves |
| Vehicle exports | see Vehicles (opx_core) below |

Error strings are short codes: `not_loaded`, `invalid_amount`, `insufficient_funds`, `unknown_account`,
`unknown_job`, `invalid_grade`, `not_found`, `no_slot`, `invalid_name`, `invalid_birthdate`, `invalid_family`, `db_error`.

### Server events (host-wide `TriggerEvent`, handle with `AddEventHandler`)

| Event | Arguments |
|---|---|
| `opx:playerLoaded` | `source, playerData` |
| `opx:playerUnloaded` | `source, citizenId` |
| `opx:characterCreated` | `source, citizenId` |
| `opx:characterDeleted` | `source, citizenId` — each resource deletes its own rows |
| `opx:moneyChanged` | `source, account, balance, delta, reason` |
| `opx:jobChanged` | `source, job, previousJob` |
| `opx:metadataChanged` | `source, key, value` |
| `opx:jobRegistered` | `name, job` (registered job, copy) |
| `opx:jobUnregistered` | `name` (owner unregistered it or stopped) |
| `opx:vehicleSpawned` | `vehicleId, plate\|nil, citizenId\|nil` (every spawn through opx_core) |
| `opx:vehicleStored` | `plate` (owned car back in a garage) |
| `opx:ownedVehicleAdded` | `plate, citizenId, record` |
| `opx:ownedVehicleRemoved` | `plate, citizenId` |

### Client net events (server → client; any client resource may `RegisterNetEvent` them)

| Event | Arguments |
|---|---|
| `opx:playerLoaded` | `playerData` |
| `opx:playerUnloaded` | — |
| `opx:setPlayerData` | `key, value` (key: `accounts`, `job`, `metadata`, `isNew`, `family`) |
| `opx:notify` | `message, type, duration\|nil, title, options\|nil` |

### Client exports (`Open77.exports.callSync("opx_core", ...)`)

`GetPlayerData()`, `IsPlayerLoaded()`, `Notify(message, type?, duration?, title?, options?)` (forwards to the notify provider
when running; an `options.id` is forwarded as `"<calling resource>:<id>"`), `DismissNotification(id)`,
`ClearNotifications()`, `GetProvider(slot)`, `SetHudVisible(visible)`, `FormatMoney(amount)`, `GetAccountLabel(account)`,
`GetLocale()`.

### Client library `require('@opx_core')` → returns `OPX`

`OPX.GetPlayerData()`, `OPX.IsLoaded()`, `OPX.OnPlayerLoaded(fn)`, `OPX.OnPlayerUnloaded(fn)`,
`OPX.OnPlayerData(fn(key, value))`, `OPX.Notify(message, type?, duration?, title?, options?)`, `OPX.DismissNotification(id)`, `OPX.ClearNotifications()`,
`OPX.TriggerServerCallback(name, cb, ...)`, `OPX.AwaitCallback(name, ...)` (yields, returns the results),
`OPX.Locale(resourceName?)` → `function(key, ...)` loader reading `locales/<lang>.json` of the caller.

Providers (`Config.providers`, see Replacing a resource): server exports `GetProvider(slot)` → resource name or nil,
`OpenCreator(source, options)` → forwards a copy of the options, with `opener` = the calling resource, to the creator provider's `Open` (`false, 'no_provider'` when none); client
exports `GetProvider(slot)`, `SetHudVisible(visible)` (false when no HUD provider); library `OPX.GetProvider(slot)`,
`OPX.SetHudVisible(visible)`; `Notify` / `OPX.Notify` / `opx:notify` go to the notify provider, else the game's toast.

Callback wire: client `opx:callback` (`requestId, name, ...`) → core server → owning resource export →
client `opx:callback:reply` (`requestId, ok, ...`). Rate-limited (`Config.callbackRate`/s and at most 8 requests waiting per player, both `rate_limited`), unknown names
refused, answers holding NaN/inf/functions refused (`callback_failed`), timeout client-side.

### Jobs (registry)

No job is declared in `config.lua`. Each resource registers its own jobs with `RegisterJob(name, definition)`,
from `onResourceStart` for itself **and** for `opx_core` (the registry is in memory, so an opx_core restart needs
a re-registration). opx_core registers only the fallback `unemployed` (new characters, malformed stored jobs),
through the same path; its pay is `Config.unemployedSalary`.

- `definition = { label, grades = { [0] = { name, label, salary }, ... }, defaultDuty?, offDutyPay?, type?, data? }`;
  name `^[a-z][a-z0-9_]{1,31}$`, 1 to 50 grades contiguous from 0, integer salaries >= 0, `type` free text
  (`'leo'`, `'ems'`...), `data` free (JSON-able, 8 KiB).
- Owner = `GetInvokingResource()`. Only the owner re-registers or unregisters; a name owned by another running
  resource answers `job_taken`. A stopping resource's jobs are unregistered, compared by VM generation: on a hot
  reload the jobs (and callbacks) its new VM already registered again stay.
- A character keeps its stored job (name, grade, duty) whatever the registry says; the row is never rewritten.
  While the job or grade is not registered, PlayerData.job is `available = false`, `label = name`, `salary = 0`,
  `onDuty = false`; `SetDuty` answers `unknown_job`. Registering it re-resolves and syncs every loaded holder
  (`opx:setPlayerData('job', ...)` + `opx:jobChanged`). Unregistering does the same the other way.
- `SetJob` refuses unregistered jobs (`unknown_job`); paychecks pay registered jobs only.

## Vehicles (opx_core)

The platform owns the car (`Open77.vehicles`: create/remove, `getProperties`/`setProperties` — paint, damage,
health and the whole customization incl. livery, neon, parts, rims, plate, tint, stickers, engine sound — locks,
per-player lock exceptions, seats, lifetime). opx_core adds the RP layer only: owners, unique plates, garages,
the live plate <-> vehicle id link, the owner's key exception. Permissions: `world.vehicles`,
`world.vehicles.appearance` (setPlate; a stored look on a fresh car is a change).

Table `opx_vehicles (plate PK, citizen_id, record, props LONGTEXT JSON of getProperties, stored, garage,
created_at, updated_at)`, cached whole at start; purged on `opx:characterDeleted`. Plates: upper-case, unique among
owned and live cars, platform rule (A-Z 0-9 space -, 1..10), generated from `Config.vehicles.platePattern`.

| Export | Returns |
|---|---|
| `SpawnVehicle(record, coords, heading?, options?)` | vehicleId or `false, reason`. `options = { props, plate, bucket, persistent, owner (citizenId: key exception), warp (source seated as driver), locked }` |
| `DeleteVehicle(vehicleId)` | `true` or `false, reason`; an owned car is stored (props saved) instead |
| `GetVehicleProperties(vehicleId)` / `SetVehicleProperties(vehicleId, props)` | the platform's `getProperties` / `setProperties` |
| `GetVehicleByPlate(plate)` | live vehicleId or nil |
| `GetVehicleOwner(vehicleId)` | `citizenId, plate` or nil |
| `SetVehicleOwnerAccess(vehicleId, source, allowed)` | `true` or `false, reason`: `setLockedForPlayer(id, source, false)` / `nil` |
| `AddOwnedVehicle(citizenId, record, props?, plate?)` | plate or `nil, reason` (stored in `defaultGarage`) |
| `GetOwnedVehicles(citizenId)` / `GetOwnedVehicle(plate)` | `{ plate, citizenId, record, props, stored, garage, vehicleId, createdAt, updatedAt }` list / one or nil |
| `SaveOwnedVehicle(plate, vehicleId?)` | `true` or `false, reason` (captures `getProperties`) |
| `SpawnOwnedVehicle(plate, coords, heading?, options?)` | vehicleId or `false, reason` (`already_out`); `options = { bucket, warp, locked, persistent }` |
| `StoreOwnedVehicle(plate, vehicleId?, garage?)` | `true` or `false, reason` (save + remove + stored) |
| `RemoveOwnedVehicle(plate)` | `true` or `false, reason` (row deleted, car removed) |

Errors: `not_ready`, `invalid_record`, `unknown_record`, `invalid_coords`, `invalid_owner`, `invalid_player`,
`invalid_props`, `invalid_plate`, `plate_owned`, `plate_in_use`, `plate_taken`, `plate_exhausted`,
`unknown_citizen`, `not_found`, `not_out`, `already_out`, `wrong_vehicle`, `invalid_vehicle`, `invalid_argument`, `invalid_bucket` (bucket outside 0..2^32-1), `db_error`, and the
platform's reasons (`props_failed:<setProperties reason>`, `create` reasons).

Lifecycle: owned cars spawn locked with the owner's exception (re-granted when the owner loads that character);
a stored look whose pack is not running is restored without it (garage guide pattern). Owner leaves:
`onOwnerLeave = 'store'` (after `ownerLeaveGraceSeconds`) or `'keep'`. opx_core stops: `onResourceStop = 'store'`
(saved and removed) or `'keep'` (saved, left out persistent, re-linked by plate at the next start; the save at stop is best-effort, the last autosave is kept if natives refuse). At start a row
still marked out with no car wearing its plate goes back to its garage. A car removed by anything else goes back to
its garage with its last saved props. Autosave every `autosaveMinutes`. Staff commands `car`, `dv`, `givecar`
(ACL `command.<name>`, names in `Config.commands`).

## opx_menu (client)

Usage from any resource: `dependency "opx_menu"` then `local Menu = require('@opx_menu')`.
Callbacks run in the caller's VM. One menu stack visible at a time; Backspace goes back, Escape closes.
Keyboard only (arrows, Enter, Backspace, Escape, Left/Right on list/slider/color): no mouse interaction.
`Menu.dialog` also needs `dependency "opx_dialog"`.

```lua
local menu = Menu.open({
  id = "skin_main", title = "Character", subtitle = "Face",
  position = "right",                 -- "left" | "right"
  elements = {
    { label = "Hairstyle", value = "hairstyle", type = "list", options = { "A", "B" }, index = 1, description = "..." },
    { label = "Hair colour", value = "hair_color", type = "color", colors = { { r=, g=, b=, a= }, ... }, index = 1 },
    { label = "Nose", value = "nose", type = "slider", min = 0, max = 20, step = 1, current = 3 },
    { label = "Glasses", value = "glasses", type = "checkbox", checked = false },
    { type = "separator", label = "Clothes" },
    { label = "Save", value = "save", type = "button", rightLabel = "€$ 100", disabled = false },
  },
  onSelect = function(element, menu) end,          -- Enter
  onChange = function(element, value, menu) end,   -- list/slider/color/checkbox moved (live preview)
  onHover  = function(element, menu) end,           -- optional, selection moved
  onClose  = function(menu) end,
  canClose = true,
  parent = otherMenu,                               -- optional: Backspace returns to it
})
menu:setElements(elements)  menu:updateElement(value, patch)  menu:setTitle(t, sub)  menu:close()
Menu.closeAll()  Menu.isOpen()  Menu.current()
local values = Menu.dialog({ title = "...", fields = { { name = "firstname", label = "...", type = "text"|"number"|"date"|"select", maxLength=, min=, max=, options = {...}, default = ... } }, submitLabel = "..." })  -- yields; table or nil
local yes = Menu.confirm({ title = "...", message = "...", confirmLabel = "...", cancelLabel = "..." })      -- yields; boolean
```

## opx_target (client)

Targeting eye: hold ALT (rebindable), a reticle follows the cursor and frames the hovered entity (projected mesh
bounds; no cursor-outline native exists), right click (`Config.openButton`) opens a context menu on what is
under the cursor: `player`, `self`, `npc`, `vehicle`, `door`, `prop`/`object`/`item`/`device`, `world` (surface),
`sky` (a direction). Picking is `Open77.camera.screenRaycast(x, y, Config.rayDistance, { self = true })` at a
bounded rate while the key is held, nothing while it is up. Submenus open on hover (right, flipped left at the
screen edge, `Config.maxDepth` levels); keyboard Up/Down/Right/Left/Enter/Escape only with `Config.captureKeyboard = true` (default
false: the aim borrows the cursor only, the player keeps walking and talking, and Escape goes to the game's pause menu,
which closes the eye). Levels are `Config.panelWidth` wide and grow up to `Config.panelMaxWidth`. No default actions
(`Config.debug` + `/targetdemo` registers a demo).

```lua
-- dependency "opx_target"
local Target = require('@opx_target')            -- runs in the caller's VM: callbacks are plain functions
local id = Target.addPlayer({                     -- addSelf addNpc addVehicle addDoor addProp addWorld addSky addGlobal
  { name = 'search', label = 'Search', icon = 'search', distance = 2.5,      -- add(kinds, o) addModel(models, o)
    canInteract = function(ctx) return true end,                             -- addEntity(selectors, o)
    disabled = false,                             -- true | 'reason' | function(ctx) return true, 'reason' end
    onSelect = function(ctx) end,                 -- or serverEvent = 'res:x' (targetId, info) / event = 'res:local'
    children = { { name = 'pockets', label = 'Pockets', onSelect = function(ctx) end } } },
})
Target.remove(id)  Target.removeAll()  Target.setEnabled(bool)  Target.isEnabled()  Target.isOpen()  Target.isMenuOpen()  Target.close()
```

`ctx = { kind, target = { kind, playerId, npcId, vehicleId, propId, engineEntity, entity, model, className, name,
networked, isLocalPlayer, position, distance }, hit = { position, normal, material, source }, distance, origin,
direction, screen = { x, y }, option = { name, path, id, data } }`. Client exports mirror the library
(`addPlayer` ... `addEntity`, `remove`, `removeAll`, `setEnabled`, `isEnabled`, `isOpen`, `isMenuOpen`, `close`,
`getVersion`) with callbacks given as **export names** of the caller (`onSelect`, `canInteract`, `disabledWhen`).
Registrations are owned by the caller (`GetInvokingResource`) and removed when it stops. Predicates are client UX
only: servers validate source, canonical target id, bucket, distance, life state and permissions.

## opx_notification (client export)

`Notify(message, type?, duration?, title?, options?)` (`type`: info | success | warning | error). Shown even while the HUD is
hidden (selection, creator). Reached through opx_core (`OPX.Notify`, client export `Notify`, server `Notify(source, ...)`,
net event `opx:notify`), never called by name.

## opx_hud (client exports)

`ShowHelp(text, key?)`, `HideHelp()`, `SetVisible(visible)`, `IsVisible()`.
Extras (opx_hud only; a replacement provider may lack them, call under pcall): `IsShown()`, `SetBlockVisible(block,
visible)` (block = status | info | vehicle | voice | help; hidden while any resource hides it), `IsBlockVisible(block)`,
`SetCustomStatus(id, data)` (at most `Config.status.customMax` gauges), `RemoveCustomStatus(id)`. Help lines, block
claims and gauges are owned per caller resource and VM generation and dropped when that VM is gone. `SetVisible` is one
shared flag, last call wins.
Reads player data through the `opx:*` client net events. Hidden while `opx_character` selection runs
(`opx_character` calls opx_core `SetHudVisible(false/true)`, which reaches the HUD provider's `SetVisible`).

## Appearance (official resources, not ours)

- **Character key = citizen id.** After `LoadCharacter`, opx_character calls
  `TriggerEvent("open77:appearance:setCharacter", source, citizenId)` (server-owned selection): open77_appearance
  restores that character's look (runtime body per family, `open77_character_bodies`; clothing,
  `open77_character_presentation`) and announces `open77:appearance:characterReady (source, info)`.
- **Creation** = `exports.opx_core:OpenCreator(source, { mode = 'creation', canCancel = false })` once the new
  character is selected and placed (opx_core forwards to the creator provider, `opx_creator`). The creator saves
  through `open77_appearance:setBodyFamily(..., true)`, keeps its choices in `opx_creator_looks` and raises
  `opx:creator:saved (source, characterKey, family)` / `opx:creator:closed (source, reason)`.
- **Health** is the platform's (`Open77.stats`): no pool or maximum from OPX. opx_core keeps the fraction in
  `metadata.health`; placements respawn with it.
- **Placement** of a character follows the reference freeroam join spawn: `Open77.players.kill(source,
  { cause = "script", weapon = "opx_character:spawn" })` then `Open77.players.respawn(source, { position, heading,
  bucket, health, graceMs })`, only once `Open77.ready.isReady(source)`.

## opx_character

Server: on join the player waits in a private routing bucket behind the readiness gate; `opx_character` lists
characters (`opx_core:GetCharacters`), loads one (`LoadCharacter`), selects it in open77_appearance
(`setCharacter`, citizen id), releases the gate and places it (kill + respawn: last position or config spawn,
bucket 0, stored health). Creation = a short form (firstname, lastname, birthdate; no body), the character is
loaded and placed **in the world** at the creation spot (private bucket) and the creator opens there
(`opx_core:OpenCreator`) — no pre-game creator. On `opx:creator:saved` for that character: preview capture,
`SetCharacterCreated`, `SetFamily(family)`, spawn. On `opx:creator:closed`: reopen (`Config.creation.retries`),
then back to selection. No creator running: the character spawns without a look and keeps `isNew`.
`/logout` (configurable) saves and returns to selection. Selection previews are opx_character's own
(`opx_character_previews`, captured on the client with `Open77.appearance.captureBody` + worn clothing).

## Visual identity (all NativeUI resources)

Same look everywhere: dark translucent panels, chamfered (cut) corners, thin accent lines, uppercase eyebrow labels.
Tokens (each resource keeps them at the top of its own `.rcss` so an owner can retheme one file):

| Token | Value | Use |
|---|---|---|
| accent | `#ff3b47` | selection, focus, active bars |
| alarm | `#ffa8ae` | warnings / critical text |
| text | `#f2f6f8` | primary text |
| text-dim | `#8d99a8` | secondary text, descriptions |
| panel | `rgba(7,16,19,0.86)` | panel background |
| panel-line | `rgba(255,59,71,0.35)` | borders, separators |
| ink-on | `#071013` | text on an accent fill |
| success / warning / error / info | `#3ddc97` / `#ffb547` / `#ff3b47` / `#4fe3ff` | notifications |

Base the stylesheets on the platform one (`<link type="text/rcss" href="nui://open77/open77.rcss"/>`) when it helps.
Lengths in `dp`. Respect `nui.reducedmotion`.

## As built (2026-11-16) — amendments to the contract above

These are binding too; they come from the platform's real rules.

- **Export names.** The manifest `exports {}` / `server_exports {}` directives only accept lowercase names, so every
  CamelCase export is registered at runtime with `exports("Name", fn)`. Do not list them in the manifest.
- **Sync vs async server exports.** `exports.res:Fn()` and `Open77.exports.callSync` raise `export_yielded` if the export
  waits on anything. Rule: an export answers from memory and writes to the DB with the callback form of
  `Open77.database.*` (never `MySQL.*.await` inside an export). Callers that may hit a waiting path use
  `Open77.exports.call(res, name, ...):await()`. opx_core's character exports wait only before the account is cached
  (`IsAccountReady(source)` tells); opx_character always calls them async.
- **Readiness gate.** opx_core holds `Open77.ready` until the account is cached; opx_character holds it during selection
  and releases it as soon as a character is played or created, before placing him: the platform refuses to teleport a
  held player (`player_not_ready`). The selection scene is therefore built around the body where it stands.
- **opx_core additions:** `IsAccountReady(source)`, `SetFamily(source, family)` (called by opx_character with the family
  the creator saved; syncs `family` to the client), `ResetHealth(source)` (= `Open77.stats.restoreHealth`), client export `GetLocale()`, error codes `in_use`, `invalid_duty`,
  `invalid_key`, `invalid_value`. `opx:setPlayerData` keys also include `isNew` and `family`. `Notify(-1, ...)` = everyone.
  Server cannot read `locales/*.json`; server sends codes/keys, clients translate.
- **opx_menu additions:** `Menu.isAnyOpen()`, `onClose(menu, reason)`, dialog `required/minLength/placeholder/validate`,
  `select` options `{ label, value }` returning `value`, `date` returning `"YYYY-MM-DD"`, client exports `IsAnyOpen`,
  `GetOwner`, `CloseAll`. RML/RCSS stay editable in `opx_menu/ui/`; the service builds the document source with
  `Config.theme` applied. A consumer needs `dependency "opx_menu"`, plus `dependency "opx_dialog"` if it calls
  `Menu.dialog` (otherwise it answers `nil, 'dialog_unavailable'`). Screen ownership is keyed by resource name and VM
  generation, so a hot-reloaded consumer can claim before its predecessor's stop notice.
- **opx_notification:** notifications are always shown (even when the HUD is hidden); opx_core forwards `opx:notify`
  to the notify provider (the provider does not register `opx:notify` itself, so there is no double toast).
- **opx_skin:** retired (moved to `_legacy/retired/opx_skin`). Appearance is open77_appearance's, creation
  opx_creator's (on Open77.body + open77_appearance), clothing will be open77_wardrobe_ui's.
- **opx_character:** extra exports server `Logout`, `IsSelecting`, `GetPhase`, `GetCitizenId`; client `IsSelecting`,
  `GetPhase`. Hard dependencies: `opx_dialog` (creation form), `opx_core`, `opx_menu` (delete confirm). It also asks
  `IsAccountReady` when `GetCharacters` answers an empty list, and treats `false` (or a nil list) as list unavailable. It switches
  `open77_appearance` to runtime creation (`Config.runtimeCreation`), so the vanilla pre-game creator never opens.
  It decides a creation is finished on the creator's `opx:creator:saved` host event for that citizen id; it has no
  manifest dependency on the creator or the HUD (they are opx_core providers).
- **Menu look:** one selection-wheel style for every menu, tilted per side from `Config.tilt` (`Menu.projection(side)`
  gives the same tilt to a document of your own). `Menu.setStyle(style)` and the `style` option on `Menu.open` /
  `dialog` / `confirm` are kept for compatibility: they validate 'clean' | 'flat' | 'holo' and change nothing. There is
  no `Config.style`, no `Config.holo` and no `ui/holo.rcss`.
- **Validator false positives** (`open77_validate`, index op77.208): `require is nil` on client files (client `require`
  exists since op77.3; the server has none), `Open77.ui.*` / `Open77.body.*` / `player.body.switch` / `player.body.read`
  unknown (newer than the index), and "permission not checked" notes for natives called from `client/modules/*` (listed under `files`, not scanned).

## opx_creator

In-world character creator (NativeUI) built from the Open77 docs and the official building blocks; the official
`open77_creator` is only its functional reference. Server exports `Open(playerId, options?)` → `true, token` or
`false, reason` (`invalid_player`, `invalid_options`, `appearance_not_ready`, `busy`, `already_open`; `options = { mode =
'creation'|'edit', canCancel = bool }` plus opx_creator's `entries`, `start`, `title`, `subtitle`, `tag`; `opener` is
trusted only from opx_core's `OpenCreator`), `IsOpen(playerId)`; host events `opx:creator:opened (playerId, info)`,
`opx:creator:saved (playerId, characterKey, family, info)` (after `open77_appearance:setBodyFamily(player, family, body,
true)` accepted the look: the family is stored at once, the body when the client publishes it), `opx:creator:closed
(playerId, reason, info)` (`cancelled`, `failed`, `no_answer`, `dropped`, `stopped`, `character_changed`, `closed` or the
`Close` reason); `info = { token, mode, tag?, opener }`. Known upstream limitation: open77_appearance 0.6.0 stores every
preview step during the hold, so a disconnect mid-edit keeps the last preview without `saved`. The save travels as ONE JSON string `{ body, choices }`,
validated on the server (session token, one save at a time, family, body shape, choices shape and limits, size).
Choices (not bodies) in `opx_creator_looks (user_id, character_key, body_family, choices_json)`, purged on
`opx:characterDeleted`. Staff command `creator [id]` (restricted, ACL `command.creator`); no player command.

## Economy (opx_core money, opx_inventory, opx_bank)

OPX keeps its own economy: no platform ledger is used or required (details and contracts in
[`ECONOMY.md`](ECONOMY.md)). Every balance and container is authoritative in server memory while loaded; a change
is one synchronous Lua step (it cannot half-happen) and rows are written a few seconds later, on unload, disconnect
and resource stop. Tables are created at start (`CREATE TABLE IF NOT EXISTS`), no migrations.

- **opx_core**: character money in `opx_characters.accounts`, society money in `opx_societies`. All money exports are
  synchronous: `GetMoney`, `HasMoney`, `AddMoney`, `RemoveMoney`, `SetMoney`, `TransferMoney`, `MoveMoney(source,
  fromAccount, toAccount, amount, reason)` (two accounts of one character), `GetAccounts`, `GetSocietyMoney(job)`,
  `AddSocietyMoney`, `RemoveSocietyMoney`, `PaySociety(source, job, amount, reason)`. Events `opx:moneyChanged` and
  `opx:societyMoneyChanged (job, balance, delta, reason)`. Staff command `societymoney <job> [add|remove <amount>]`.
- **opx_inventory**: the inventory provider below; table `opx_inventories` (`char:<citizenId>` pockets,
  `stash:<name>` stashes). A keyboard list in opx_menu (key I), no images. Unique or metadata items are instances
  with their own id and `meta`. Weapons are items whose metadata holds `{ serial, ammo, equipped }`; ammo reserve is
  a stack item per ammo type. Staff commands `giveitem`, `giveweapon`, `removeitem`, `clearinventory`, `inventory`.
  The game's RPG hub (inventory, crafting) is blocked while a character is loaded.
- **opx_bank**: opx_menu at `Config.locations` (key E): deposit, withdraw (opx_core `MoveMoney`), transfer to a player
  id (`TransferMoney` on `bank`, the recipient's name is confirmed first), history (table `opx_bank_history`).
  Server exports `GetBalance(source)` → `{ cash, bank }` and `Transfer(fromSource, toSource, amount, note?)` → `true`
  | `false, reason`, both synchronous; host event `opx:bank:transfer (fromSource, toSource, amount)`.

## Jobs, medical and world (batch 2)

- **opx_medical** (provider `medical`, contract above): when a player dies a keyboard menu opens: wait, call the
  Trauma Team (`/sos`), or respawn at a hospital after `Config.respawnSeconds` when the config allows it (`/respawn`),
  billed `floor(fee * (1 - coverage.respawnFee))` from bank then cash to `feeSociety`. Staff `/revive [id]`
  (`command.revive`). State kept in metadata `isDown`.
- **opx_traumateam**: job `traumateam` (type `ems`, 4 grades, `data.bossGrade`), duty and uniform at the station
  (`open77_appearance` temporary outfit, never the saved look), dispatch list (`/tt`), revive / treat through the
  eye (animation `examine`), Silver / Gold / Platinum plans sold at a desk (table `opx_traumateam_subscriptions`) that
  set the medical coverage and the call priority. Exports `GetSubscription`, `GetTiers`, `IsOnDuty`, `GetDispatch`.
- **opx_needs**: hunger and thirst in opx_core metadata (opx_hud already draws them), decay, damage at zero, food and
  drink items registered with `RegisterUsable` and played with opx_progress + `open77_animations` profiles. Exports
  `GetNeeds`, `SetNeed`, `AddNeed`; staff `setneed` (`command.setneed`).
- **opx_garage**: garage points and an impound over opx_core's owned vehicles (`opx_vehicles.garage`), no table of its
  own. Exports `GetGarages`, `OpenGarage(source, name)`, `Impound(plateOrVehicleId, by?)`, `GetVehicleGarage(plate)`;
  staff `impound [plate]` (`command.impound`).
- **opx_dealership**: job `cardealer` (type `dealer`), catalogue in config, a sale is an offer the buyer confirms,
  commission to the seller, the rest to the society; test drive (customer confirms), showroom car, self-service kiosk
  when no dealer is on duty. Exports `GetCatalogue`, `IsOnDuty`. Showroom / test cars use fixed plates and are cleaned
  at the next start.
- **opx_doors**: doors in `Config.doors` (ids captured in game with `/doorid`, `command.doorid`) with job / grade /
  duty / citizen keys over the system resource `open77_doors`; lock state in table `opx_doors`. Exports `GetDoors`,
  `IsLocked`, `SetLocked`, `HasAccess`; event `opx:doors:lockChanged (doorId, locked, by)`.
- **opx_inventory** also gives cash to a nearby player (menu row and eye option, opx_core `TransferMoney`, reason
  `give`) and exports `GiveCash(source, target, amount)`.

## Small basics (batch 3)

- **opx_admin** additions: tools `player.freeze`, `player.warn`, `player.ban` (durations from config, through
  `Open77.access`), `player.history`, `server.bans` (list and unban), `reports`, `self.coords`; commands `/report
  <text>` (everyone) and `/coords` (`command.coords`); table `opx_admin_sanctions`; host events `opx:admin:audit
  (staff, action, detail)`, `opx:admin:sanction (staff, kind, userId, name, reason, seconds)`, `opx:admin:report
  (source, ticketId, text)`; exports `IsFrozen(playerId)`, `GetReports()`.
- **opx_shops**: shops in `Config.shops` (items, prices, optional society); paid cash then bank; exports `OpenShop(source,
  name)`, `GetShops()`; event `opx:shops:bought (source, shop, item, count, total)`.
- **opx_emotes** (client only): menu over the open77_animations catalogue (`/e`, `/anim`), hands up and point keys;
  client exports `Play(profileId, options?)` (waits: `Open77.exports.call(...):await()`), plus stop / state helpers in
  its types.lua. A playback started through `Play` is owned by opx_emotes.
- **opx_billing**: a job member bills a nearby player; `/bills` lists and pays them into the job's society
  (optional commission); table `opx_bills`; exports `CreateBill(target, job, amount, label, issuer?)`, `GetBills`,
  `PayBill`, `CancelBill`; events `opx:billing:created / paid / cancelled`.
- **opx_rental**: timed rentals at desks with a deposit refunded on return; exports `GetRental(source)`,
  `EndRental(source, refund?)`; events `opx:rental:rented / returned / expired`.
- **opx_inventory** optional contract members: server `GetItemDefinition(item)`, client `GetItemLabel(item)` /
  `GetItemDescription(item)`, host event `opx:inventory:changed (source, item, delta)`; "Show" on the ID card; a
  starter kit given once per character (metadata flag).
- **opx_core**: server export `HasJob(source, name, minGrade?, onDutyOnly?)` → boolean.

## Appearance: opx_skin and creator scopes

- **opx_skin** (provider `skin`) is the only OPX resource that changes clothing on the platform. Server exports:
  `GetClothing(playerId, fresh?)` (waits), `SetClothing(playerId, slots, options?)` (waits; persistent through
  `Open77.clothing.set`), `SetPreview` / `ClearPreview` (temporary outfit, never stored), `SetUniform` /
  `ClearUniform` / `GetUniform` (job uniforms, one owner per player), outfits `GetOutfits`, `SaveOutfit`, `WearOutfit`,
  `RenameOutfit`, `DeleteOutfit`, `OpenOutfits(playerId, options?)` (table `opx_skin_outfits`). Client exports
  `GetGarments(slot, offset?, limit?, family?)` and `FindGarment` (wait the first time). Events
  `opx:skin:clothingChanged (playerId, slots)`, `opx:skin:uniformChanged (playerId, owner)`. Slots: Head, Face,
  InnerChest, OuterChest, Legs, Feet, Outfit. A uniform and a fitting exclude each other.
- **opx_creator scopes**: `Open(playerId, { scope = 'full'|'clothing'|'barber'|'surgery'|'tattoo', confirmLabel? })`
  (`Config.scopes`; an explicit `entries` list still wins). Rail entries `clothes` and `headwear` list garments
  through the skin provider. A wardrobe or clothing shop is the creator in the `clothing` scope; there is no other
  wardrobe UI. The body is still saved with `open77_appearance:setBodyFamily`, clothes with skin `SetClothing`: one
  owner per kind of data. `opx:creator:saved` carries `info.scope` and `info.changed = { body, clothing }`; an edit
  confirmed without change closes with reason `unchanged` (no saved event, nothing to pay).
- **opx_clotheshop**: points whose type is a creator scope; payment on `opx:creator:saved` (`Config.payFrom`).
- Job uniforms (opx_traumateam, opx_dealership) go through skin `SetUniform` / `ClearUniform`, with the direct
  `open77_appearance:setTemporaryOutfit` call as a fallback when no skin provider runs.

## Replacing a resource

OPX is a community framework: every swappable resource can be replaced by another one **without editing the
resources that use it**. The providers are configured in ONE place, opx_core's `config.lua`:

```lua
Config.providers = {
  notify = 'opx_notification', -- notifications
  hud = 'opx_hud',             -- status HUD
  creator = 'opx_creator',     -- in-world character creator
  menu = 'opx_menu',           -- menu / dialog / confirm library
  target = 'opx_target',       -- targeting eye / context menu library + client exports
  weather = 'opx_weather',     -- time and weather API (server exports)
  dialog = 'opx_dialog',       -- NativeUI form library (require('@opx_dialog').inputDialog)
  inventory = 'opx_inventory', -- items, metadata, stashes, weapons (server exports)
  progress = 'opx_progress',   -- timed action bar (client exports)
  medical = 'opx_medical',     -- downed state and revive API (server exports)
  society = 'opx_society',     -- boss menu (server exports)
  logs = 'opx_logs',           -- journal (server exports)
  vehiclekeys = 'opx_vehiclekeys', -- keys and locks (server exports)
  skin = 'opx_skin',           -- clothing API (server exports)
}
```

`false` = none. A provider that is not running counts as none (`GetResourceState(name) == 'running'`), and every
caller degrades: notifications fall back to the game's own toast, HUD calls are skipped, `OpenCreator` answers
`false, 'no_provider'` (opx_character then spawns the new character without a look and keeps `isNew`). Resources
never name a provider: they call opx_core (`GetProvider(slot)`, `OpenCreator`, `Notify`, `SetHudVisible`, or the
`OPX.*` library helpers). A replaceable provider is never a hard manifest `dependency` of its consumers (a
dependency only orders startup; exports and events do not need it), except the menu library (below).

What a replacement must implement:

- **notify** (client): export `Notify(message, type?, duration?, title?, options?)` → boolean (`options = { id?,
  persist? }`, id up to 160 bytes, arriving from opx_core as `"<resource>:<id>"`), optional exports `Dismiss(id)` and
  `Clear()`; `type` one of
  `info | success | warning | error`. opx_core forwards `opx:notify`, its client export `Notify` and `OPX.Notify`
  to it. Must show notifications even while the HUD is hidden. Default provider: `opx_notification`; with no
  provider running, opx_core falls back to the game's own toast.
- **hud** (client): exports `SetVisible(visible)` → true (hide/show the HUD for a scene: selection, creator) and
  `IsVisible()` → boolean. Called through opx_core `SetHudVisible` / `OPX.SetHudVisible`. Optional: `ShowHelp(text,
  key?)`, `HideHelp()`.
- **creator** (server): exports `Open(playerId, options)` → `true` or `false, reason` (`options = { mode =
  'creation'|'edit', canCancel = bool }`, canCancel defaulting to true in edit and false in creation; must not
  yield, opx_core calls it synchronously; opening over an open session must work) and `IsOpen(playerId)` →
  boolean. Host events (`TriggerEvent`, server): `opx:creator:opened (playerId)` when on screen,
  `opx:creator:saved (playerId, characterKey, family)` once open77_appearance accepted the look, `opx:creator:closed
  (playerId, reason)` whenever it closes without a save. characterKey is `exports.open77_appearance:character(
  playerId).characterKey` (the citizen id); persist through `open77_appearance:setBodyFamily(..., true)` and raise
  `open77:appearance:hold` (client) while previewing on the player. Called through `exports.opx_core:OpenCreator`.
- **menu** (client library): the `require('@<name>')` API of the opx_menu section above (`Menu.open` with its
  element types and callbacks, `menu:*` methods, `Menu.closeAll`, `Menu.isOpen`, `Menu.isAnyOpen`, `Menu.current`,
  `Menu.dialog`, `Menu.confirm`, `Menu.setStyle`) and the client exports `IsAnyOpen`, `GetOwner`, `CloseAll`.
  Exception to the rule above: `require('@name')` only loads a **declared, running dependency**, so consumers
  name the library in their manifest (`dependency "opx_menu"`). A replacement therefore ships under the name
  `opx_menu`, or each consumer changes that one manifest line and its `require`. `Config.providers.menu` records
  which one is in use (`OPX.GetProvider('menu')`).
- **target** (client library + client exports): the `require('@<name>')` API of the opx_target section above —
  `addPlayer`, `addSelf`, `addNpc`, `addVehicle`, `addDoor`, `addProp`, `addWorld`, `addSky`, `addGlobal`,
  `add(kinds, options)`, `addModel(models, options)`, `addEntity(selectors, options)` (each: one option or a list →
  id, or `nil, reason`), `remove(id)`, `removeAll()`, `setEnabled(bool)` (a per-resource disable claim),
  `isEnabled()`, `isOpen()`, `isMenuOpen()`, `close()` — with the same option fields (`name`, `label`, `icon`,
  `description`, `group`, `separator`, `danger`, `order`, `distance`, `disabled`, `canInteract`, `onSelect`,
  `event`, `serverEvent` sent as `(name, targetId, info)` (`info.direction` instead of `info.position` for the sky),
  `data`, nested `children`) and the same `ctx` shape;
  callbacks run in the caller's VM, `onSelect` after the input is released. The client exports of the same names
  (callbacks as the caller's export names: `onSelect`, `canInteract`, `disabledWhen`) plus `getVersion()`.
  Registrations belong to the calling resource (runtime identity, never an argument) and are removed when it
  stops. Same `require` exception as the menu: a replacement ships as `opx_target` or consumers change their
  `dependency` line and `require`; exports-only consumers need no change. Never load the official
  `open77_contextmenu` next to it (same key, same weapon-wheel block).
- **inventory** (server exports, all synchronous): `AddItem(source, item, count, meta?)`, `RemoveItem(source, item,
  count, instanceId?)`, `GetItems(source)`, `GetItem(source, item)`, `HasItem(source, item, count?)`,
  `CanCarry(source, item, count)`, `SetItemMeta(source, instanceId, metaPatch)`, `RegisterUsable(item, exportName)`,
  `OpenStash(source, name, options?)`, `GiveItemTo(source, target, item, count, instanceId?)`. Containers
  `char:<citizenId>` and `stash:<name>` (docs/ECONOMY.md). Contract: opx_inventory/types.lua.
- **progress** (client): export `Start(options)` → `true` | `false, reason`, waiting until the action ends (callers
  use `Open77.exports.call(provider, 'Start', opts):await()` from a thread), options `{ label, duration (250..120000
  ms), canCancel = true, disableMovement, disableCombat, disableVehicle, animation = { profile, clip? } }`, reasons
  `cancelled | busy | dead | in_vehicle | stopped | invalid_*`; `IsActive()` and `Cancel()` never wait. The result is
  a client outcome: servers never reward on it alone. Contract: opx_progress/types.lua.
- **medical** (server exports, all synchronous): `IsDown(source)`, `GetState(source)` → `{ down, at, cause, position,
  respawnIn, called, responder }` | nil, `Revive(source, { health?, graceMs?, by? })`, `Respawn(source, { force?, free?,
  hospital? })`, `SetCoverage(source, { respawnFee 0..1, label } | nil)` (owned by the caller, by VM generation),
  `GetCoverage(source)`, `GetCalls()`, `AckCall(patient, responder)`, `ReleaseCall(patient, responder)`,
  `GetResponderCount()`; client export `IsDown()`. Host events `opx:medical:down (source, info)`, `opx:medical:up
  (source, reason, by)` (revived | respawned | external | unloaded), `opx:medical:call (source, call)`,
  `opx:medical:callAck (source, responder)`, `opx:medical:callClosed (source, callId, reason)`. A downed player is the
  platform's `dead` phase (OPX never auto-respawns); scripted kills of opx_character placement are ignored.
- **society** (server exports, synchronous): `OpenBossMenu(source, jobName?)` → `true` | `false, reason` (`not_loaded`,
  `unknown_job`, `wrong_job`, `not_boss`, `position_unknown`; the menu is bound to the spot where it opened, the
  calling job checks its own station first), `IsBoss(source, jobName?)`. A job's boss grade is
  `definition.data.bossGrade` (else its highest grade). Host events `opx:society:hired / fired (boss, target, job)`.
- **logs** (server exports, synchronous): `Log(category, action, message, options?)` → `true` | `false, reason`
  (`options = { source?, citizenId?, data? }`, plain data only), `GetRecent(filter?)` → rows newest first
  (`filter = { category?, citizenId?, limit? }`). The default provider also records the OPX host events itself.
- **vehiclekeys** (server exports, synchronous): `HasKey(source, vehicleId)`, `GiveKey(source, vehicleIdOrPlate,
  options?)` (`{ temporary = true }` = for that live car only), `RemoveKey(sourceOrCitizenId, vehicleIdOrPlate)`,
  `GetKeyHolders(plate)`, `SetLocked(vehicleId, locked)`, `IsLocked(vehicleId)`. Events
  `opx:vehiclekeys:keyGiven (plateOrId, citizenId, by, temporary)`, `opx:vehiclekeys:keyRemoved (plateOrId,
  citizenId, by)`. Owners always hold a key (opx_core owned vehicles).
- **weather** (server exports, all synchronous, each answering the environment state table or `false, reason`):
  `GetState(bucket?)`, `SetTime(hour, minute, second, bucket?)`, `FreezeTime(frozen, bucket?)`,
  `SetTimeRate(rate, bucket?)`, `SetWeather(preset, transitionSeconds?, bucket?)`, `FreezeWeather(frozen, bucket?)`,
  `Reset(bucket)`, `ApplyPreset(name, bucket?)`, `ApplyToPlayer(source, name)`, `ClearPlayer(source)`; `bucket` nil
  = the shared sky. Built over `Open77.environment` (`open77_weather` stays the authority). Used by opx_character
  through `exports.opx_core:GetProvider('weather')`: `ApplyPreset('showcase', bucket)` on the private bucket during
  selection / creation, `Reset(bucket)` when the player enters the world and on disconnect. See the opx_weather
  README.


## opx_admin

Staff menu (F10, opx_menu; needs opx_dialog too) with noclip (menu row or F9; F11 stays open-voice's range key). Rights come from the
ACL only: `command.opx_admin` (menu), `command.opx_admin.noclip`, one `command.opx_admin.<tool id>` per built-in tool
and `command.opx_admin.protected` (cannot be kicked from the menu). The client asks, the server decides
(`Open77.acl.isAllowed` on every request, recheck every 5 s and on `onAclChanged`) and logs every privileged action
(`[audit] time | name (id, userId) | action`). Noclip is turned on only by the server's `opx_admin:setNoclip`; on exit
the player is settled on the ground. Server exports: `AddAction({ id, label, event, right?, section?, icon?,
description?, order?, keepOpen?, target? })` → `true` | `false, reason` (right defaults to `command.opx_admin.<id>`; after both
checks opx_admin raises `TriggerEvent(event, playerId, id)`, or `(event, playerId, id, targetId)` for a `target` row), `RemoveAction(id)`, `CanUse(playerId, id)`,
`IsStaff(playerId)`, `IsNoclip(playerId)`, `GetActions()`, `GetTools()`. Rows are removed when their resource stops.

## opx_chat

Chat authority, NativeUI, replacing `open77_chat` with the same events and payloads (never load both): server
`chat:submit`, `chat:ready`; host `chat:addMessage/broadcast/clear/setEnabled/setServerEnabled/addSuggestion(s)/
removeSuggestion` (what `Open77.chat.*` publishes); it raises the cancellable `chatMessage` (mute = `CancelEvent()`) and
`chat:message (playerId, author, text, channelId)`; client exports `addMessage, clear, addSuggestion,
removeSuggestion, setEnabled, isEnabled, open, close, isOpen`. Other resources use `Open77.chat.*` and name it only for the optional `SetCommandHelp`.
RP channels in `Config.channels` (say/me/do/ooc/looc on, twt/ad off, announce restricted to `command.announce`);
recipients are computed on the server (`Open77.players.nearby` in the sender's bucket, or everyone / the bucket for
range 0). IC names from opx_core `GetPlayer` (`Config.nameMode`), OOC names from the account (`Config.oocName`).
The `chatMessage` veto fails closed: if the platform cannot raise it, the line is dropped and logged. Clients receive
the channel table as `opx_chat:channels (list, { gen, rev, index, count })` pieces and apply it once complete; the
client sends `chat:ready (gen, rev)` so the table only travels again when it changed.
On `chat:ready` it also suggests every server `RegisterCommand` of other resources (`Open77.runtime.commands()`,
cached 10 s): unrestricted ones to everyone, restricted ones only when `Open77.acl.isAllowed(player,
'command.<name>')`. The help is generic unless the owning resource gave it with the server export
`SetCommandHelp(name, help?, parameters?)` → `true` | `false, reason` (help string or `{ en, fr }`, ≤ 8 `{ name,
help?, optional? }`, owned by the caller's VM generation). OPX resources call it through a pcall'd local helper at
start and on `onResourceStart('opx_chat')`, skipped when opx_chat is not running.
Chat is not a provider slot: any resource that handles the open77_chat events replaces it through `resources.load`.

## Shared input dialogs

`opx_dialog` is the NativeUI form provider (`Config.providers.dialog`). Consumers declare
`dependency "opx_dialog"` and use `require('@opx_dialog').inputDialog(title, fields, options)`
from a thread. The client service owns a single central document and keyboard/cursor lease.
Only the invoking resource may poll, validate or close its request; tokens and validation versions
reject stale answers. Custom validation stays in the caller VM. No form values cross the network.
Ownership of a form is checked by the caller's VM generation, so a reloaded consumer keeps the form its new VM opened.
Servers continue to validate all gameplay requests. The full contract is in
[`opx_dialog/README.md`](https://github.com/opx77-framework/opx_dialog/blob/main/README.md) and its `types.lua`.

`Menu.dialog` delegates to this service, suspending the menu wheel and navigation until the form
closes; it retains required-by-default fields for compatibility. `Menu.confirm` stays a keyboard
wheel in `opx_menu`. `opx_character` uses the new provider directly for identity creation; the
appearance creator contains no text form. Date display may be French while the result stays ISO.
