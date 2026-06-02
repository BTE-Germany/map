# BTE Germany Map — Minecraft Plugin Requirements

This document describes what the companion Minecraft plugin must do to talk to
the public website (`mapv3`). The web side already exposes all required HTTP
endpoints — your job is to consume them.

## Target environment

- **Server software:** Paper **1.21.10** (Pufferfish/Purpur acceptable as long as
  the Paper API surface stays the same)
- **Java:** 21
- **Required dependencies:**
  - **FastAsyncWorldEdit (FAWE)** — for reading the player's selection when
    creating a region
  - **WorldEdit** API (transitive via FAWE)
  - **Terra++** *(or equivalent BTE projection lib)* — to translate Minecraft
    `(x, z)` ↔ real-world `(lat, lng)`. Without this the plugin cannot push
    geo-positions or resolve region centroids to player coordinates.
- **Optional:** Adventure (bundled in Paper) for chat components.

## Configuration (`config.yml`)

```yaml
api:
  base-url: "https://map.bte-germany.de"
  # Bearer token issued from the website DB for THIS server only
  # (see "Token provisioning" below). Each server uses a different token.
  token: "REPLACE_ME"
  # Optional sanity check: refuse to start if the issued token doesn't
  # match this server-key.
  expected-server-key: "ost"
  # How often to push player positions, in ticks (20 = 1 second).
  position-push-ticks: 40
  # How often to poll for pending teleports (ticks).
  teleport-poll-ticks: 20
  # Connect/read timeouts in ms.
  http-connect-timeout-ms: 5000
  http-read-timeout-ms: 10000
projection:
  # Identifier of the Terra++ projection to use. The default BTE one is fine.
  type: "bte"
defaults:
  world: "world"
```

## Multi-server topology

The network consists of **multiple Paper servers**, each responsible for a
group of Bundesländer. Each server runs its own copy of this plugin with a
**dedicated token** that identifies which server is calling the API.

The web side maintains an `mc_servers` registry: `(key, name, states[])`.
Example:

| `key` | `name`         | `states` (Bundesland codes)         |
| ----- | -------------- | ----------------------------------- |
| `nord`| Nord-Server    | `["SH", "HH", "MV", "NI", "HB"]`    |
| `west`| West-Server    | `["NW", "RP", "SL", "HE"]`          |
| `ost` | Ost-Server     | `["BE", "BB", "ST", "TH", "SN"]`    |
| `sued`| Süd-Server     | `["BY", "BW"]`                      |

Region teleports are routed to the server whose `states` array contains the
region's Bundesland. **A plugin only ever sees teleports for its own server**
(the API filters by the calling token's `serverKey`).

Player positions are upserted by UUID across all servers — when a player
switches servers, the next position upload from the new server overwrites
the old row, including the `server_key` tag.

## Token provisioning

Tokens live in the **website's environment** (Infisical / `.env`), not in
the database. To register a new server:

```sql
-- 1. register the server (DB)
INSERT INTO mc_servers (key, name, states)
VALUES ('ost', 'Ost-Server', '["BE","BB","ST","TH","SN"]'::json);
```

```bash
# 2. inject the token into the website's environment.
# Convention: MC_API_TOKEN_<UPPER_SERVERKEY>
MC_API_TOKEN_OST=$(openssl rand -hex 32)
```

Alternative: drop a JSON map into a single variable if your secret manager
prefers that:

```bash
MC_API_TOKENS='{"ost":"<token>","west":"<token>","sued":"<token>"}'
```

The plain token is shared with the plugin operator and put into `api.token`
of its `config.yml`.

The plugin always sends it as:

```
Authorization: Bearer <token>
```

(Alternatively `X-MC-Token: <token>` is accepted.)

> **Rotation:** simply update the env var in your secret manager and
> redeploy / restart the website. No DB writes required.

### Optional mTLS (proxy-terminated)

If you front the website with nginx / Cloudflare / Caddy and want to
require client certificates **in addition** to the bearer token:

1. Configure the proxy to validate client certs and forward
   `X-SSL-Client-Verify: SUCCESS` and `X-SSL-Client-S-DN: <subject>`.
2. Set on the website:

   ```bash
   MC_REQUIRE_MTLS_HEADER=1
   MC_MTLS_EXPECTED_SUBJECT="CN=paper-ost,O=BTE Germany"   # optional pin
   ```

The plugin then needs to present its client cert to the proxy in addition
to sending the bearer token.

## Features

### 1. `/region create` — create a region from a FAWE selection

Command (permission: `btemap.region.create`, default `op`):

```
/region create <type> <city> [state] [-- description...]
```

- `<type>` ∈ `default | plot | event`
- `<city>` is the city name. `<state>` is the 2-letter Bundesland code
  (`BY`, `BE`, …); leave empty to omit.
- The polygon is taken from the player's **current FAWE selection** (any
  `Region`-shaped selection — Polygon, Cuboid, Convex). Iterate the outline
  vertices, project each `(x, z)` to `(lat, lng)` via Terra++, and POST to:

```
POST /api/mc/regions
{
  "creatorUUID": "<player UUID with dashes>",
  "polygon": [[lat, lng], [lat, lng], ...],
  "area": <area in m²>,                 // compute from polygon (e.g. JTS) or selection
  "address": "Hauptstr. 12",
  "city": "Berlin",
  "state": "BE",
  "type": "default"
}
```

- Reply `201 { "id": "<uuid>" }` → broadcast `§a✓ Region erstellt: <uuid>` to
  the player and link the website detail page (`/region/<id>`).
- On `400` show the validation error from the response body.
- On `401` log a warning — token is bad/revoked.

The polygon **must be sent as `[lat, lng]` pairs** (in that order). The web
backend stores them as-is.

### 2. Push live player positions

Every `position-push-ticks` ticks (default ~2 s), build one batch request for
**all currently online players** (filter out vanished/spectator if you want):

```
POST /api/mc/positions
{
  "players": [
    {
      "uuid":     "<player UUID>",
      "username": "<name>",
      "x": 123.4, "y": 64.0, "z": -456.7,
      "yaw": 180.0,
      "world": "world",
      "lat": 52.52, "lng": 13.405      // Terra++ projected
    },
    ...
  ]
}
```

- Always include `lat`/`lng` — the website only renders players that have
  geographic coordinates.
- Max 500 players per request.
- The endpoint also auto-evicts rows whose `lastSeenAt` is older than
  5 minutes, so a hard crash will eventually clear stale markers.

When a player **disconnects** from this server, immediately:

```
DELETE /api/mc/positions?uuid=<player-uuid>
```

The backend only deletes the row if it's still tagged with the calling
server's `server_key`, so a late "disconnect" event won't remove a player
that has since reconnected on a different server.

> **Server-switch handling:** when a player moves from server A → B, server
> B's first position upload upserts the row with `server_key = B`. If
> server A then sends a `DELETE` it becomes a no-op — the marker keeps
> following the player across servers.

### 3. Execute teleport requests from the website

Every `teleport-poll-ticks` ticks (default 1 s):

```
GET /api/mc/teleports/pending
```

The endpoint **broadcasts** every pending teleport to every server. Routing is
done at the **plugin layer** via a proxy plugin-channel — the plugin where the
player is currently online forwards a teleport message via `BTEMap:Teleport`
(or whatever channel name you pick) so the player gets teleported regardless
of which server they're on.

Race protection is handled by the API: acks are processed with a conditional
update (`status = 'pending'`), so the **first** plugin to ack wins and any
duplicate acks from other servers come back as not-claimed.

Response:

```json
{
  "teleports": [
    {
      "id":       "<uuid>",
      "uuid":     "<player uuid>",
      "regionId": "<uuid|null>",
      "x":        52.52,            // see note below
      "y":        null,
      "z":        13.405,
      "world":    "world",
      "createdAt": "..."
    }
  ]
}
```

> **Coordinate convention:** when `regionId` is non-null, the website pre-fills
> `x` with the polygon centroid **lat** and `z` with the **lng** (because the
> server has no BTE projection). The plugin must:
> 1. Project `(lat=x, lng=z) → (mc_x, mc_z)` via Terra++
> 2. Compute a safe `y` (highest non-air block, default world height).
>
> When `regionId` is null, treat `x`/`y`/`z` as raw MC coordinates.

For each entry, exactly one plugin in the network should execute it.
Recommended flow:

1. Check `Bukkit.getPlayer(uuid)` locally:
   - **Online here** → project + teleport on the main thread, then ack.
   - **Offline here** → query the proxy (Velocity / BungeeCord) for which
     server the player is on. There are two clean ways:
     - **Plugin Message channel** (`BTEMap:Teleport`): push a payload
       `{ uuid, lat, lng }` to the proxy; the proxy forwards it to the
       backend server hosting the player; that backend executes + acks.
     - **Velocity API** (if your plugin runs on Velocity directly):
       resolve the player's current `RegisteredServer` and deliver the
       payload via plugin message.
2. **Don't ack if you didn't deliver** — let another server claim it. If no
   server has the player, the request simply expires after 60s.
3. Run the actual teleport on the main thread of the target server using
   `Player.teleportAsync(...)` (Paper).
4. Acknowledge once:

```
POST /api/mc/teleports/pending
{
  "ack": [
    { "id": "<uuid>", "status": "delivered" },
    { "id": "<uuid>", "status": "failed", "error": "player offline" }
  ]
}
```

The response includes `claimed: ["<id>", ...]` — the IDs your server actually
owns. If an ID is **not** in `claimed`, another server already delivered it.
Pending requests older than **60 seconds** are auto-expired by the backend.

## HTTP client guidelines

- Reuse a single `HttpClient` (Java 11+) instance.
- Do **all** HTTP work off the main thread (`BukkitScheduler.runTaskAsynchronously`).
- Schedule actual `teleport()` calls back on the main thread.
- Retry transient failures (5xx, IO timeout) with simple exponential backoff.
- Never crash the main loop on HTTP errors — log + drop.

## Security notes

- The token grants full ability to create regions and teleport any player.
  Treat it like a database password.
- The plugin should refuse to start if `api.token` is empty.
- Recommend running the website behind HTTPS — the plugin should not allow
  `http://` URLs by default (add a `api.allow-insecure: false` flag).
- Consider IP-allowlisting the plugin host on the web layer (nginx / Cloudflare).

## Multi-server gotchas

- **Per-server token** — never share a token between servers. The token
  determines which `server_key` is stamped onto every position upload.
- **Teleports are broadcast** — every plugin sees every pending teleport.
  Only the plugin that can actually deliver to the player (locally or via
  proxy plugin-channel) should ack. The API uses an atomic conditional
  update to ensure only the first ack wins; check the `claimed` array in
  the response if you need to know whether your ack actually took effect.
- **Position upserts are global by UUID** — server A doesn't need to do any
  cleanup when a player jumps to server B; B's first upload migrates the
  row automatically.
- **Stale cleanup is per-server** — if a server crashes, its players will
  appear "online" until the 5-min `lastSeenAt` cutoff or until they
  re-appear on another server.
- **Plugin channel naming** — pick a stable identifier for the proxy
  channel (e.g. `bte-map:teleport`) and register it on every backend +
  proxy. Send a packet with `{ uuid, lat, lng }` (or projected MC coords if
  you do the projection on the source side); the proxy or target backend
  consumes it and runs the actual teleport.

## Testing checklist

- [ ] `/region create default Berlin BE` with a polygon FAWE selection produces
      a clickable success message linking `https://map.bte-germany.de/region/<id>`.
- [ ] After 5 s of being online, your avatar appears on the website map.
- [ ] Disconnecting from MC removes the marker within ~10 s.
- [ ] Toggling the "Auf der Karte verbergen" privacy switch on the website
      removes the marker on the next refresh.
- [ ] Clicking *"Auf dem Server hierher teleportieren"* on the website while
      online in MC teleports the player within a few seconds.
- [ ] Token revocation (`UPDATE mc_api_tokens SET revoked_at=now() …`) causes
      every subsequent request to log `401`.

## Endpoint summary

| Method | Path                              | Purpose                       |
| ------ | --------------------------------- | ----------------------------- |
| POST   | `/api/mc/regions`                 | Create a region from FAWE     |
| POST   | `/api/mc/positions`               | Bulk position upsert          |
| DELETE | `/api/mc/positions?uuid=…`        | Player disconnect             |
| GET    | `/api/mc/teleports/pending`       | Poll pending teleports        |
| POST   | `/api/mc/teleports/pending`       | Acknowledge teleports         |

All `/api/mc/*` endpoints require the `Authorization: Bearer <token>` header.
