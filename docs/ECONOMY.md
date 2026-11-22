# OPX economy contract: money, items, weapons

OPX keeps its own economy. No platform ledger is used or required: money, society accounts, items, stashes and
bank history live in OPX tables, owned by OPX resources. This file is the swap contract: a replacement core,
inventory or bank keeps the same exports, reasons and events.

## Storage rules (every OPX economy resource)

- The server holds the authoritative state in memory while it is loaded (a loaded character's accounts and
  pockets, an open stash, the society balances). A change is one synchronous Lua step, so it cannot half-happen.
- Rows are written a few seconds after a change (one write for a burst), on unload / disconnect, and at the
  resource's own stop (callback-form writes only there). A failed write is retried; nothing is dropped from memory
  before its write is confirmed.
- Tables are created at start with `CREATE TABLE IF NOT EXISTS` (InnoDB, utf8mb4). No migration framework.
- Exports are synchronous (`exports.res:Fn(...)` / `Open77.exports.callSync`): they never wait on the database.
- Every value is checked before `json.encode` (NaN, ±inf, functions or userdata abort the whole server).
- Client events are validated, rate-limited, one action at a time per player.

## Money (opx_core)

- Character balances: `opx_characters.accounts` (accounts `money` = cash and `bank`, `Config.accounts`).
- Society balances: `opx_societies (job PRIMARY KEY, balance, updated_at)`.
- Exports: `GetMoney`, `HasMoney`, `AddMoney`, `RemoveMoney`, `SetMoney`, `TransferMoney(fromSource, toSource,
  account, amount, reason)`, `MoveMoney(source, fromAccount, toAccount, amount, reason)` (two accounts of one
  character, used for bank deposit / withdraw), `GetAccounts`, `GetSocietyMoney(job)` (→ integer, `0, reason` on
  refusal), `AddSocietyMoney(job, amount, reason)`, `RemoveSocietyMoney(job, amount, reason)`, `PaySociety(source,
  job, amount, reason)` (player cash → society). The job must be registered.
- Events: `opx:moneyChanged (source, account, balance, delta, reason)`, `opx:societyMoneyChanged (job, balance, delta,
  reason)`.
- Reasons: `not_loaded`, `target_not_loaded`, `same_player`, `same_account`, `unknown_account`, `invalid_amount`,
  `insufficient_funds`; societies also `unknown_job`, and `db_error` while the database is still starting.
- Staff commands: `addmoney`, `setmoney`, `societymoney <job> [add|remove <amount>]`.

## Items (opx_inventory)

- Table `opx_inventories (id PRIMARY KEY, items LONGTEXT JSON, updated_at)`, id `char:<citizenId>` (pockets) or
  `stash:<name>` (`name` = `[a-z0-9_.-]`, chosen by the resource that opens it). `items` =
  `{ stacks = { [item] = count }, instances = { [instanceId] = { item, meta } } }`. A late write never overwrites a
  newer row (`updated_at` is a strictly increasing write version).
- There is no item config in opx_inventory: every item is registered at runtime with `RegisterItem(item, definition)`
  by the resource that gives it a meaning (opx_needs: food and drink, opx_medical: bandage and medkit, opx_weapons:
  weapons and ammo, opx_inventory itself: id_card). definition = `{ label, description?, weightG, unique?, maxStack?,
  usable?, showable?, weapon?, ammo?, characterMeta? }`; effects come from `RegisterUsable(item, exportName)`. Owners
  register again on the inventory provider's `onResourceStart`.
- Stackable items are counts; any item with metadata (weapons, ID card, keys...) is an **instance** with its own id
  (`<item>_<base36>`, never reused) and `meta`: plain data, string keys, ≤ 2048 bytes encoded, ≤ 4 levels deep.
  Slots, weight, `maxStack` and `unique` are enforced by the inventory.
- Exports (all synchronous): `AddItem(source, item, count, meta?)`, `RemoveItem(source, item, count, instanceId?)`,
  `GetItems`, `GetItem`, `HasItem`, `CanCarry`, `SetItemMeta(source, instanceId, metaPatch)`, `RegisterUsable(item,
  exportName)`, `OpenStash(source, name, options?)`, `GiveItemTo(source, target, item, count, instanceId?)`.
- Staff commands: `giveitem`, `giveweapon`, `removeitem`, `clearinventory`, `inventory`.

## Give cash (opx_inventory)

`GiveCash(source, target, amount)` and the menu / eye rows move `money` with opx_core `TransferMoney` (reason
`give`), after a server distance and bucket check; `Config.cash.max` caps one gift.

## Medical and Trauma Team

- Hospital respawn bill (opx_medical): `floor(fee * (1 - coverage.respawnFee))`, taken from bank then cash, never into
  debt, credited to the `feeSociety` job; reasons `medical:respawn` / `medical:respawn (refund)`.
- Trauma Team plans (opx_traumateam): Silver / Gold / Platinum, paid once for a number of days, stored in
  `opx_traumateam_subscriptions`; they set the medical coverage and the call priority; revive bills are reduced by
  the plan. The money goes to the `traumateam` society.

## Car sales (opx_dealership)

The customer pays the catalogue price (reason `vehicle:<record>`); the seller gets `Config.commission` of it
(`dealership:commission`) and the society the rest (`dealership:sale <plate>`); the car is added with opx_core
`AddOwnedVehicle`. The self-service kiosk sells at `price * priceFactor` straight to the society.

## Shops, bills, rentals (batch 3)

- Shops (opx_shops): server price × count, taken from cash then bank (reason `shop:<name>:<item>`, refund suffix
  ` (refund)`); with a configured society the money goes there (`shop:<name>`); items through the inventory provider.
- Bills (opx_billing): table `opx_bills`; paid from `payFrom` accounts into the job's society (`bill:<job>`), optional
  commission to the issuer (`bill:commission`).
- Rentals (opx_rental): price (`rental:<record>`) plus a deposit (`rental:deposit <record>`) refunded on return
  (`rental:<record> (refund)`); a deposit is lost when opx_rental stops with the car out.

## Bank (opx_bank)

- Deposit / withdraw = opx_core `MoveMoney`, transfer to a player id = `TransferMoney` on `bank`.
- History: `opx_bank_history (id, citizen_id, kind deposit|withdraw|sent|received, amount, counterpart, note,
  created_at)`, one row per side of a transfer.
- Exports: `GetBalance(source)` → `{ cash, bank }`, `Transfer(fromSource, toSource, amount, note?)` → `true` |
  `false, reason`. Event `opx:bank:transfer (fromSource, toSource, amount)`.

## Weapons

Weapons are client-owned game state; the server only requests (`Open77.weapons.assign/remove/setAmmo/clear`) and
learns the outcome on `open77:weapons:completed`. A weapon is a unique inventory item whose instance meta holds
`{ serial, ammo, equipped = slot | false }`. Ammo reserve is a stack item per ammo type. At character load the
player's weapons are cleared and what the inventory says was equipped is assigned again. The vanilla RPG hub
(inventory / crafting) is blocked while playing.

Ammo sync rule, per ammo type: rounds that left the game's reserve since the last sync are removed from the ammo
stack, a magazine may only grow by what left the reserve, then the game is given reserve = the stack. Syncs run on
unequip, every `Config.weapons.syncSeconds` while armed, and after any change to that ammo stack; a disconnect
keeps the last synced values. A timed use through opx_progress is client pacing only: the server still validates
the item and the request before consuming or rewarding.
