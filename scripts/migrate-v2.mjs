import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { extname } from "node:path";
import { loadEnvFile } from "node:process";
import { pathToFileURL } from "node:url";

for (const envFile of [".env.migration", ".env"]) {
  if (existsSync(envFile)) loadEnvFile(envFile);
}

let GetObjectCommand;
let HeadObjectCommand;
let PutObjectCommand;
let S3Client;

async function loadS3Sdk() {
  if (S3Client) return;
  const sdk = await import("@aws-sdk/client-s3");
  GetObjectCommand = sdk.GetObjectCommand;
  HeadObjectCommand = sdk.HeadObjectCommand;
  PutObjectCommand = sdk.PutObjectCommand;
  S3Client = sdk.S3Client;
}

const MODES = new Set(["all", "db", "images", "verify"]);
const STATE_NAMES = new Map([
  ["baden-württemberg", "BW"],
  ["baden-wuerttemberg", "BW"],
  ["bayern", "BY"],
  ["berlin", "BE"],
  ["brandenburg", "BB"],
  ["bremen", "HB"],
  ["hamburg", "HH"],
  ["hessen", "HE"],
  ["mecklenburg-vorpommern", "MV"],
  ["niedersachsen", "NI"],
  ["nordrhein-westfalen", "NW"],
  ["rheinland-pfalz", "RP"],
  ["saarland", "SL"],
  ["sachsen", "SN"],
  ["sachsen-anhalt", "ST"],
  ["schleswig-holstein", "SH"],
  ["thüringen", "TH"],
  ["thueringen", "TH"],
]);

function printHelp() {
  console.log(`
Usage: node scripts/migrate-v2.mjs [all|db|images|verify] [--dry-run]

Modes:
  all       Migrate regions/builders, then images, then verify (default)
  db        Migrate only regions and additional builders
  images    Copy MinIO objects and upsert region_images rows
  verify    Compare source/target row counts and check migrated S3 objects

Options:
  --dry-run Validate and print planned work without writing
  --help    Show this help

Configuration is read from .env.migration, then .env.
See .env.migration.example for all variables.
`.trim());
}

function parseArgs(argv) {
  if (argv.includes("--help") || argv.includes("-h")) {
    return { help: true, mode: "all", dryRun: false };
  }

  const positional = argv.filter((arg) => !arg.startsWith("-"));
  const mode = positional[0] ?? "all";
  if (!MODES.has(mode)) {
    throw new Error(`Unknown mode "${mode}". Expected one of: ${[...MODES].join(", ")}`);
  }

  const unknownFlags = argv.filter(
    (arg) => arg.startsWith("-") && arg !== "--dry-run",
  );
  if (unknownFlags.length > 0) {
    throw new Error(`Unknown option(s): ${unknownFlags.join(", ")}`);
  }

  return { help: false, mode, dryRun: argv.includes("--dry-run") };
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function booleanEnv(name, fallback = false) {
  const value = process.env[name];
  if (value == null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function numberEnv(name, fallback) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

function pgSslConfig(prefix = "TARGET_DATABASE") {
  if (!booleanEnv(`${prefix}_SSL`, false)) return undefined;
  return {
    rejectUnauthorized: booleanEnv(
      `${prefix}_SSL_REJECT_UNAUTHORIZED`,
      true,
    ),
  };
}

function createS3Client(prefix) {
  const endpoint = process.env[`${prefix}_S3_ENDPOINT`]?.trim();
  const accessKeyId = requiredEnv(`${prefix}_S3_ACCESS_KEY_ID`);
  const secretAccessKey = requiredEnv(`${prefix}_S3_SECRET_ACCESS_KEY`);

  return new S3Client({
    region: process.env[`${prefix}_S3_REGION`]?.trim() || "eu-central-1",
    endpoint: endpoint || undefined,
    forcePathStyle: booleanEnv(`${prefix}_S3_FORCE_PATH_STYLE`, false),
    credentials: { accessKeyId, secretAccessKey },
  });
}

function normalizeUuid(value) {
  const compact = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[{}-]/g, "");
  if (!/^[0-9a-f]{32}$/.test(compact)) return null;
  return [
    compact.slice(0, 8),
    compact.slice(8, 12),
    compact.slice(12, 16),
    compact.slice(16, 20),
    compact.slice(20),
  ].join("-");
}

function parsePolygon(value, regionId) {
  let parsed;
  try {
    parsed = typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    throw new Error(`Region ${regionId}: data is not valid JSON`);
  }

  if (
    !Array.isArray(parsed) ||
    parsed.length < 3 ||
    parsed.some(
      (point) =>
        !Array.isArray(point) ||
        point.length < 2 ||
        !Number.isFinite(Number(point[0])) ||
        !Number.isFinite(Number(point[1])),
    )
  ) {
    throw new Error(`Region ${regionId}: data is not a valid polygon`);
  }

  const polygon = parsed.map((point) => [Number(point[0]), Number(point[1])]);
  const first = polygon[0];
  const last = polygon.at(-1);
  if (first[0] !== last[0] || first[1] !== last[1]) polygon.push([...first]);
  return polygon;
}

function detectState(displayName) {
  const normalized = String(displayName ?? "").toLowerCase();
  for (const [name, code] of STATE_NAMES) {
    if (normalized.includes(name)) return code;
  }
  return "";
}

function regionType(row) {
  if (Boolean(row.isEventRegion)) return "event";
  if (Boolean(row.isPlotRegion)) return "plot";
  return "default";
}

function makeRegionRecord(row, additionalBuilders) {
  const id = normalizeUuid(row.id);
  if (!id) throw new Error(`Region ${row.id}: id is not a UUID`);

  const creatorUUID =
    normalizeUuid(row.userUUID) || normalizeUuid(row.ownerMinecraftUUID);
  if (!creatorUUID) {
    throw new Error(`Region ${row.id}: no valid creator Minecraft UUID`);
  }

  const builders = [
    ...new Set(
      (additionalBuilders.get(String(row.id)) ?? [])
        .map((builder) => normalizeUuid(builder.minecraftUUID))
        .filter((uuid) => uuid && uuid !== creatorUUID),
    ),
  ];
  const area = Number(row.area);
  if (!Number.isFinite(area) || area < 0) {
    throw new Error(`Region ${row.id}: area is not a valid non-negative number`);
  }

  return {
    id,
    description: row.description ?? "",
    creatorUUID,
    polygon: parsePolygon(row.data, row.id),
    city: String(row.city || "Unbekannt").slice(0, 265),
    state: detectState(row.osmDisplayName),
    area,
    buildings: Number(row.buildings) || 0,
    createdAt: row.createdAt,
    modifiedAt: row.lastModified ?? row.createdAt,
    type: regionType(row),
    address: row.osmDisplayName ?? "",
    finished: Boolean(row.isFinished),
    builders,
  };
}

function quoteMysqlTable(name) {
  const configured = process.env[name]?.trim();
  const table = configured || {
    LEGACY_REGIONS_TABLE: "Region",
    LEGACY_BUILDERS_TABLE: "AdditionalBuilder",
    LEGACY_IMAGES_TABLE: "Image",
  }[name];
  if (!/^[A-Za-z0-9_]+$/.test(table)) {
    throw new Error(`${name} contains an invalid table name`);
  }
  return `\`${table}\``;
}

async function loadLegacyRegions(connection) {
  const regionsTable = quoteMysqlTable("LEGACY_REGIONS_TABLE");
  const buildersTable = quoteMysqlTable("LEGACY_BUILDERS_TABLE");
  const [regions] = await connection.query(`
    SELECT r.*, u.minecraftUUID AS ownerMinecraftUUID
    FROM ${regionsTable} r
    LEFT JOIN \`User\` u ON u.id = r.ownerID
    ORDER BY r.createdAt, r.id
  `);
  const [builders] = await connection.query(`
    SELECT id, minecraftUUID, username, regionId
    FROM ${buildersTable}
    ORDER BY regionId, id
  `);
  const byRegion = new Map();
  for (const builder of builders) {
    const key = String(builder.regionId);
    const current = byRegion.get(key) ?? [];
    current.push(builder);
    byRegion.set(key, current);
  }
  return { regions, builders, buildersByRegion: byRegion };
}

async function migrateDatabase(mysqlConnection, pgPool, dryRun) {
  const { regions, builders, buildersByRegion } =
    await loadLegacyRegions(mysqlConnection);
  const records = [];
  const rejected = [];

  for (const row of regions) {
    try {
      records.push(makeRegionRecord(row, buildersByRegion));
    } catch (error) {
      rejected.push(error.message);
    }
  }

  console.log(
    `[db] source: ${regions.length} regions, ${builders.length} additional builders`,
  );
  console.log(`[db] valid: ${records.length}, rejected: ${rejected.length}`);
  for (const message of rejected) console.error(`[db] rejected: ${message}`);
  if (rejected.length > 0) {
    throw new Error("Database migration stopped because source rows are invalid");
  }
  if (dryRun) return { migrated: records.length };

  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");
    for (const record of records) {
      await client.query(
        `
          INSERT INTO regions (
            id, description, "creatorUUID", polygon, city, state, area,
            buildings, "createdAt", "modifiedAt", type, address, finished, builders
          )
          VALUES (
            $1, $2, $3, $4::json, $5, $6, $7, $8, $9, $10,
            $11::region_type, $12, $13, $14::json
          )
          ON CONFLICT (id) DO UPDATE SET
            description = EXCLUDED.description,
            "creatorUUID" = EXCLUDED."creatorUUID",
            polygon = EXCLUDED.polygon,
            city = EXCLUDED.city,
            state = EXCLUDED.state,
            area = EXCLUDED.area,
            buildings = EXCLUDED.buildings,
            "createdAt" = EXCLUDED."createdAt",
            "modifiedAt" = EXCLUDED."modifiedAt",
            type = EXCLUDED.type,
            address = EXCLUDED.address,
            finished = EXCLUDED.finished,
            builders = EXCLUDED.builders
        `,
        [
          record.id,
          record.description,
          record.creatorUUID,
          JSON.stringify(record.polygon),
          record.city,
          record.state,
          record.area,
          record.buildings,
          record.createdAt,
          record.modifiedAt,
          record.type,
          record.address,
          record.finished,
          JSON.stringify(record.builders),
        ],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  console.log(`[db] migrated ${records.length} regions`);
  return { migrated: records.length };
}

function legacyObjectKey(imageData, sourceBucket) {
  const raw = String(imageData ?? "").trim();
  if (!raw) return null;

  try {
    const pathname = decodeURIComponent(new URL(raw).pathname).replace(/^\/+/, "");
    const bucketPrefix = `${sourceBucket}/`;
    return pathname.startsWith(bucketPrefix)
      ? pathname.slice(bucketPrefix.length)
      : pathname;
  } catch {
    return raw.replace(/^\/+/, "").replace(new RegExp(`^${escapeRegex(sourceBucket)}/`), "");
  }
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extensionFor(key, contentType) {
  const byMime = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
  };
  const fromMime = byMime[String(contentType ?? "").split(";")[0].toLowerCase()];
  if (fromMime) return fromMime;
  const extension = extname(key).toLowerCase();
  return [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(extension)
    ? extension
    : ".webp";
}

function mimeFor(key, contentType) {
  const normalized = String(contentType ?? "").split(";")[0].toLowerCase();
  if (normalized.startsWith("image/")) return normalized;
  return {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
  }[extname(key).toLowerCase()] ?? "image/webp";
}

async function objectExists(client, bucket, key) {
  try {
    return await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  } catch (error) {
    const status = error?.$metadata?.httpStatusCode;
    if (status === 404 || error?.name === "NotFound") return null;
    throw error;
  }
}

async function loadLegacyImages(connection) {
  const imagesTable = quoteMysqlTable("LEGACY_IMAGES_TABLE");
  const regionsTable = quoteMysqlTable("LEGACY_REGIONS_TABLE");
  const [images] = await connection.query(`
    SELECT
      i.id,
      i.regionId,
      i.imageData,
      r.userUUID,
      r.createdAt AS regionCreatedAt,
      u.minecraftUUID AS ownerMinecraftUUID
    FROM ${imagesTable} i
    JOIN ${regionsTable} r ON r.id = i.regionId
    LEFT JOIN \`User\` u ON u.id = r.ownerID
    ORDER BY i.regionId, i.id
  `);
  return images;
}

async function migrateImages(mysqlConnection, pgPool, dryRun) {
  await loadS3Sdk();
  const source = createS3Client("LEGACY");
  const target = createS3Client("TARGET");
  const sourceBucket = requiredEnv("LEGACY_S3_BUCKET");
  const targetBucket = requiredEnv("TARGET_S3_BUCKET");
  const images = await loadLegacyImages(mysqlConnection);
  const concurrency = numberEnv("MIGRATION_IMAGE_CONCURRENCY", 3);
  let migrated = 0;
  let skipped = 0;
  const failures = [];

  console.log(`[images] source: ${images.length} image rows`);

  async function migrateOne(row) {
    const id = normalizeUuid(row.id);
    const regionId = normalizeUuid(row.regionId);
    const uploaderUUID =
      normalizeUuid(row.userUUID) || normalizeUuid(row.ownerMinecraftUUID);
    const sourceKey = legacyObjectKey(row.imageData, sourceBucket);
    if (!id || !regionId || !uploaderUUID || !sourceKey) {
      throw new Error(
        `Image ${row.id}: invalid id, region, uploader, or imageData`,
      );
    }

    const sourceHead = await objectExists(source, sourceBucket, sourceKey);
    if (!sourceHead) {
      throw new Error(`Image ${row.id}: source object "${sourceKey}" not found`);
    }

    const mimeType = mimeFor(sourceKey, sourceHead.ContentType);
    const extension = extensionFor(sourceKey, mimeType);
    const targetKey = `regions/${regionId}/${id}${extension}`;
    const sizeBytes = Number(sourceHead.ContentLength ?? 0);
    if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) {
      throw new Error(`Image ${row.id}: invalid source object size`);
    }

    if (dryRun) {
      console.log(`[images] would copy ${sourceKey} -> ${targetKey}`);
      migrated += 1;
      return;
    }

    let targetHead = await objectExists(target, targetBucket, targetKey);
    if (!targetHead || Number(targetHead.ContentLength) !== sizeBytes) {
      const response = await source.send(
        new GetObjectCommand({ Bucket: sourceBucket, Key: sourceKey }),
      );
      const bytes = await response.Body.transformToByteArray();
      await target.send(
        new PutObjectCommand({
          Bucket: targetBucket,
          Key: targetKey,
          Body: bytes,
          ContentLength: bytes.byteLength,
          ContentType: mimeType,
          Metadata: {
            "legacy-image-id": String(row.id),
            "legacy-sha256": createHash("sha256").update(bytes).digest("hex"),
          },
        }),
      );
      targetHead = await objectExists(target, targetBucket, targetKey);
      if (!targetHead || Number(targetHead.ContentLength) !== bytes.byteLength) {
        throw new Error(`Image ${row.id}: target object verification failed`);
      }
    } else {
      skipped += 1;
    }

    await pgPool.query(
      `
        INSERT INTO region_images (
          id, region_id, uploader_uuid, s3_key, mime_type,
          size_bytes, original_name, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO UPDATE SET
          region_id = EXCLUDED.region_id,
          uploader_uuid = EXCLUDED.uploader_uuid,
          s3_key = EXCLUDED.s3_key,
          mime_type = EXCLUDED.mime_type,
          size_bytes = EXCLUDED.size_bytes,
          original_name = EXCLUDED.original_name
      `,
      [
        id,
        regionId,
        uploaderUUID,
        targetKey,
        mimeType,
        sizeBytes,
        sourceKey.slice(-256),
        row.regionCreatedAt,
      ],
    );
    migrated += 1;
  }

  let cursor = 0;
  async function worker() {
    while (cursor < images.length) {
      const row = images[cursor++];
      try {
        await migrateOne(row);
      } catch (error) {
        failures.push(error.message);
        console.error(`[images] failed: ${error.message}`);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  console.log(
    `[images] processed: ${migrated}, existing objects reused: ${skipped}, failed: ${failures.length}`,
  );
  if (failures.length > 0) {
    throw new Error("Image migration completed with failures");
  }
  return { migrated, skipped };
}

async function verifyMigration(mysqlConnection, pgPool, verifyObjects) {
  const regionsTable = quoteMysqlTable("LEGACY_REGIONS_TABLE");
  const imagesTable = quoteMysqlTable("LEGACY_IMAGES_TABLE");
  const [[sourceRegionCount]] = await mysqlConnection.query(
    `SELECT COUNT(*) AS count FROM ${regionsTable}`,
  );
  const [[sourceImageCount]] = await mysqlConnection.query(
    `SELECT COUNT(*) AS count FROM ${imagesTable}`,
  );
  const targetRegions = await pgPool.query(
    `SELECT COUNT(*)::int AS count FROM regions`,
  );
  const targetImages = await pgPool.query(
    `SELECT COUNT(*)::int AS count FROM region_images`,
  );

  const counts = {
    sourceRegions: Number(sourceRegionCount.count),
    targetRegions: Number(targetRegions.rows[0].count),
    sourceImages: Number(sourceImageCount.count),
    targetImages: Number(targetImages.rows[0].count),
  };
  console.log(`[verify] counts: ${JSON.stringify(counts)}`);

  const [sourceRegionRows] = await mysqlConnection.query(
    `SELECT id FROM ${regionsTable}`,
  );
  const [sourceImageRows] = await mysqlConnection.query(
    `SELECT id FROM ${imagesTable}`,
  );
  const sourceRegionIds = sourceRegionRows.map((row) => normalizeUuid(row.id));
  const sourceImageIds = sourceImageRows.map((row) => normalizeUuid(row.id));
  if (sourceRegionIds.some((id) => !id) || sourceImageIds.some((id) => !id)) {
    throw new Error("Legacy database contains invalid region or image UUIDs");
  }

  const migratedRegions = await pgPool.query(
    `SELECT id::text FROM regions WHERE id = ANY($1::uuid[])`,
    [sourceRegionIds],
  );
  const migratedImages = await pgPool.query(
    `SELECT id::text FROM region_images WHERE id = ANY($1::uuid[])`,
    [sourceImageIds],
  );
  if (migratedRegions.rowCount !== sourceRegionIds.length) {
    throw new Error(
      `Missing migrated regions: expected ${sourceRegionIds.length}, found ${migratedRegions.rowCount}`,
    );
  }
  if (migratedImages.rowCount !== sourceImageIds.length) {
    throw new Error(
      `Missing migrated images: expected ${sourceImageIds.length}, found ${migratedImages.rowCount}`,
    );
  }

  if (!verifyObjects) return counts;

  await loadS3Sdk();
  const target = createS3Client("TARGET");
  const targetBucket = requiredEnv("TARGET_S3_BUCKET");
  const rows = await pgPool.query(
    `
      SELECT ri.id, ri.s3_key, ri.size_bytes
      FROM region_images ri
      WHERE ri.id = ANY($1::uuid[])
      ORDER BY ri.id
    `,
    [sourceImageIds],
  );
  const missing = [];
  for (const row of rows.rows) {
    const head = await objectExists(target, targetBucket, row.s3_key);
    if (!head || Number(head.ContentLength) !== row.size_bytes) {
      missing.push(`${row.id}:${row.s3_key}`);
    }
  }
  console.log(
    `[verify] S3 objects checked: ${rows.rowCount}, invalid or missing: ${missing.length}`,
  );
  if (missing.length > 0) {
    for (const item of missing) console.error(`[verify] invalid: ${item}`);
    throw new Error("S3 verification failed");
  }
  return counts;
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    printHelp();
    return;
  }

  const legacyDatabaseUrl = requiredEnv("LEGACY_DATABASE_URL");
  const targetDatabaseUrl =
    process.env.TARGET_DATABASE_URL?.trim() || requiredEnv("DATABASE_URL");

  const [{ default: mysql }, { default: pg }] = await Promise.all([
    import("mysql2/promise"),
    import("pg"),
  ]);
  const { Pool } = pg;
  const mysqlConnection = await mysql.createConnection(legacyDatabaseUrl);
  const pgPool = new Pool({
    connectionString: targetDatabaseUrl,
    ssl: pgSslConfig(),
  });

  console.log(
    `[migration] mode=${options.mode} dryRun=${options.dryRun ? "yes" : "no"}`,
  );
  try {
    if (options.mode === "all" || options.mode === "db") {
      await migrateDatabase(mysqlConnection, pgPool, options.dryRun);
    }
    if (options.mode === "all" || options.mode === "images") {
      await migrateImages(mysqlConnection, pgPool, options.dryRun);
    }
    if (options.mode === "verify" || (options.mode === "all" && !options.dryRun)) {
      await verifyMigration(mysqlConnection, pgPool, true);
    }
  } finally {
    await Promise.allSettled([mysqlConnection.end(), pgPool.end()]);
  }
}

const isDirectRun =
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main().catch((error) => {
    console.error("[migration] failed");
    console.error(error);
    process.exitCode = 1;
  });
}

export {
  detectState,
  legacyObjectKey,
  makeRegionRecord,
  normalizeUuid,
  parseArgs,
  parsePolygon,
};
