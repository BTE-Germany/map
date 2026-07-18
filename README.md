<p align="center">
  <a href="https://map.bte-germany.de">
    <img src="https://cdn.bte-germany.de/general/logos/map.png" alt="BTE Germany Map" width="260" height="260">
  </a>
</p>

<h1 align="center">BTE Germany Map</h1>

<p align="center">
  The collaborative map for coordinating and exploring Build The Earth Germany.
  <br>
  <a href="https://map.bte-germany.de"><strong>Open the map</strong></a>
  ·
  <a href="https://github.com/BTE-Germany/map/issues">Report a bug</a>
  ·
  <a href="https://github.com/BTE-Germany/map/issues">Request a feature</a>
</p>

<p align="center">
  <a href="https://github.com/BTE-Germany/map/actions/workflows/docker-image.yml"><img src="https://github.com/BTE-Germany/map/actions/workflows/docker-image.yml/badge.svg" alt="Docker build status"></a>
  <a href="https://github.com/BTE-Germany/map/issues"><img src="https://img.shields.io/github/issues/BTE-Germany/map" alt="Open issues"></a>
  <a href="https://github.com/BTE-Germany/BTE-MSC/blob/main/LICENSE.md"><img src="https://img.shields.io/github/license/BTE-Germany/BTE-MSC" alt="MIT license"></a>
</p>

> [!IMPORTANT]
> This repository contains version 3 of the map. It is a ground-up rewrite with a different architecture and data model. The previous implementation remains available on the [`v2` branch](https://github.com/BTE-Germany/map/tree/v2).

## About the project

BTE Germany is recreating Germany at 1:1 scale in Minecraft. This application is the shared source of truth for the project: builders can find work, inspect existing regions, follow construction progress, and maintain the geographic and project metadata behind the map.

The interface is responsive and supports both public exploration and authenticated workflows for builders, team members, and administrators.

## Features

- **Interactive project map** with region search, shareable region links, dark and light themes, and optional satellite or hybrid styles.
- **Detailed region information** including polygon points, area, status, type, address, state, builders, creator, buildings, score, land use, descriptions, and image galleries.
- **Region editing tools** for creating and reshaping polygons, with an optional snapping mode that aligns vertices to points from existing regions.
- **Progress and statistics** with totals, built area as a share of Germany, state and category breakdowns, timelines, land-use charts, region scores, expandable leaderboards, and public builder profiles with project histories.
- **Image galleries** backed by S3-compatible object storage, including upload management and keyboard navigation.
- **Live Minecraft integration** for online-player positions, multiple server instances, account linking, and in-game teleport requests.
- **Street-level exploration** through Google Street View and Apple Look Around when the corresponding providers are configured.
- **Role-based administration** through Keycloak, including region management, ownership transfers, metadata refreshes, and Minecraft server configuration.

Some map styles, street-level views, editing actions, and administration tools are permission-gated. The public map continues to work without those optional integrations.

## Technology

| Area | Stack |
| --- | --- |
| Application | Next.js 15 App Router, React 19, TypeScript |
| UI | Tailwind CSS 4, Mantine, Radix UI, Motion |
| Mapping | MapLibre GL, Mapbox GL, Turf, OpenStreetMap and Overpass |
| Data | PostgreSQL, Drizzle ORM, TanStack Query, Zustand |
| Authentication | NextAuth.js with Keycloak OpenID Connect |
| Media | S3-compatible object storage |
| Deployment | Next.js standalone output, Docker, GitHub Container Registry |

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) 20 or newer
- [Corepack](https://nodejs.org/api/corepack.html) and pnpm 10.5.2
- PostgreSQL
- A Keycloak OpenID Connect client for authenticated features
- The Infisical CLI for the team-managed development environment, or a local `.env.local` file

S3 storage, Mapbox, Google Maps, Apple MapKit, Overpass, and the Minecraft bridge are optional unless you are developing the features that use them.

### Install dependencies

```bash
corepack enable
pnpm install
```

### Configure the application

For local development, create `.env.local` in the repository root. This is the smallest useful configuration for the database and authentication layer:

```dotenv
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/bte_map

NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=replace-with-a-long-random-value

# Full issuer URL, for example https://auth.example.com/realms/bte
KEYCLOAK_URL=https://auth.example.com/realms/bte
KEYCLOAK_CLIENT_ID=bte-map
KEYCLOAK_CLIENT_SECRET=replace-me

NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Never commit local secrets. Provider-specific variables are listed in [Configuration](#configuration).

### Apply database migrations

The migration script reads `DATABASE_URL` from the process environment:

```bash
pnpm db:migrate
```

When using `.env.local` rather than exported shell variables, Node can load it explicitly:

```bash
node --env-file=.env.local scripts/migrate.mjs
```

With the team-managed Infisical environment, run:

```bash
infisical run --env=dev -- pnpm db:migrate
```

### Start the development server

The project script injects the shared development secrets through Infisical:

```bash
pnpm dev
```

For a standalone local setup that uses `.env.local` directly:

```bash
pnpm exec next dev --turbopack
```

Open [http://localhost:3000](http://localhost:3000).

## Configuration

### Core application

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string. |
| `DATABASE_SSL` | Set to `true` when the database requires TLS. |
| `DATABASE_SSL_REJECT_UNAUTHORIZED` | Set to `false` only when a development database uses a self-signed certificate. |
| `NEXTAUTH_URL` | Public application URL used by NextAuth.js. |
| `NEXTAUTH_SECRET` | Secret used to sign and encrypt authentication data. |
| `KEYCLOAK_URL` | Full Keycloak realm issuer URL. |
| `KEYCLOAK_CLIENT_ID` | OpenID Connect client ID. |
| `KEYCLOAK_CLIENT_SECRET` | OpenID Connect client secret. |
| `NEXT_PUBLIC_SITE_URL` | Canonical public URL used for application metadata; falls back to `NEXTAUTH_URL`. |

### Maps and geographic metadata

| Variable | Purpose |
| --- | --- |
| `MAPBOX_ACCESS_TOKEN` | Enables the Mapbox satellite and hybrid map styles. |
| `GOOGLE_MAPS_API_KEY` | Server-side key for reverse geocoding during region creation. |
| `GOOGLE_MAPS_BROWSER_API_KEY` | Browser-restricted key for Google Street View. |
| `APPLE_MAPS_TOKEN` | MapKit JS token for Apple Look Around. |
| `OVERPASS_API_URL` | Overpass endpoint used to refresh buildings and land-use metadata. |
| `OVERPASS_API_KEY` | Optional authorization value sent to the configured Overpass service. |
| `DEBUG_OVERPASS` | Enables additional Overpass diagnostics when set. |
| `METADATA_REFRESH_CONCURRENCY` | Concurrent metadata refresh jobs; defaults to `4`. |
| `METADATA_REFRESH_GRID_DEG` | Grid size used for metadata queries; defaults to `0.05`. |
| `METADATA_STALE_DAYS` | Age after which metadata is considered stale; defaults to `30`. |

Map provider values are read at runtime through `/api/config`, so the same Docker image can be configured differently in each environment. The legacy `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` and `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` names remain supported.

Restrict the Google browser key to the application's HTTP referrers and the Maps JavaScript API. Restrict the server-side Google key by server or IP and enable only the required geocoding API. The Apple token must allow every production and development origin that loads MapKit JS.

### Region images

| Variable | Purpose |
| --- | --- |
| `S3_BUCKET` | Bucket used for region images. |
| `S3_REGION` | S3 region; defaults to `auto`. |
| `S3_ACCESS_KEY_ID` | Object-storage access key. |
| `S3_SECRET_ACCESS_KEY` | Object-storage secret key. |
| `S3_ENDPOINT` | Optional custom endpoint for services such as Cloudflare R2 or MinIO. |
| `S3_FORCE_PATH_STYLE` | Set to `true` for providers that require path-style URLs. |
| `S3_PUBLIC_URL` | Optional public base URL or CDN for stored images. |

The gallery accepts JPEG, PNG, WebP, and GIF images up to 10 MiB, with at most 20 images per region.

### Minecraft bridge

| Variable | Purpose |
| --- | --- |
| `MC_API_TOKEN_<SERVER_KEY>` | Token for one registered Minecraft server. |
| `MC_API_TOKENS` | JSON object containing tokens for multiple server keys. |
| `MC_REQUIRE_MTLS_HEADER` | Set to `1` to require the trusted mTLS subject header. |
| `MC_MTLS_EXPECTED_SUBJECT` | Optional exact subject expected from the mTLS proxy. |

The bridge protocol and request lifecycle are documented in [Minecraft plugin requirements](docs/MINECRAFT_PLUGIN_REQUIREMENTS.md).

## Useful commands

| Command | Description |
| --- | --- |
| `pnpm dev` | Start Turbopack with the Infisical development environment. |
| `pnpm exec next dev --turbopack` | Start Turbopack with local Next.js environment files. |
| `pnpm build` | Create the production standalone build. |
| `pnpm db:migrate` | Apply pending PostgreSQL migrations. |
| `pnpm migrate:v2:dry-run` | Validate a legacy v2 migration without writing data. |
| `pnpm migrate:v2` | Run the complete v2-to-v3 migration. |
| `pnpm migrate:v2:verify` | Verify the migrated data. |
| `pnpm migrate:v2:test` | Run the legacy migration test suite. |

See [Migrating from v2](docs/V2_MIGRATION.md) for the complete MySQL/MinIO-to-PostgreSQL/S3 migration procedure and its separate environment configuration.

## Project structure

```text
src/
├── actions/       Server actions and mutations
├── app/           Next.js routes, layouts, and API handlers
├── components/    Map, statistics, region, profile, and admin UI
├── dataHooks/     TanStack Query hooks
├── db/            Drizzle client and schema
├── lib/           Domain logic and external integrations
└── stores/        Zustand client state
migrations/        Ordered PostgreSQL migrations
scripts/           Database and v2 migration tooling
docs/              Integration and migration documentation
public/            Static assets
```

## Docker deployment

The Dockerfile creates a minimal Next.js standalone image running on port `3000`:

```bash
docker build -t bte-germany-map .
docker run --rm -p 3000:3000 --env-file .env bte-germany-map
```

Database migrations are deliberately not run during image startup. Apply them as a separate deployment step:

```bash
docker run --rm --env-file .env bte-germany-map pnpm db:migrate
```

The [Docker workflow](.github/workflows/docker-image.yml) validates pull requests and publishes default-branch and tagged images to `ghcr.io/bte-germany/map`.

## Contributing

Issues and pull requests are welcome. Keep changes focused, explain user-visible behavior, and include screenshots for interface changes where useful.

Before opening a pull request, run the checks relevant to your change:

```bash
pnpm exec eslint .
pnpm exec tsc --noEmit
pnpm build
```

If migration tooling changed, also run:

```bash
pnpm migrate:v2:test
pnpm migrate:v2:dry-run
```

## License

This project is distributed under the MIT License. See the [BTE Germany license](https://github.com/BTE-Germany/BTE-MSC/blob/main/LICENSE.md) for details.
