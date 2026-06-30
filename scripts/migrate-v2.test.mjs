import assert from "node:assert/strict";
import test from "node:test";
import {
  detectState,
  legacyObjectKey,
  makeRegionRecord,
  normalizeUuid,
  parseArgs,
  parsePolygon,
  resolveCreatorUuid,
  summarizeAwsError,
} from "./migrate-v2.mjs";

test("normalizeUuid accepts dashed and compact UUIDs", () => {
  const expected = "123e4567-e89b-12d3-a456-426614174000";
  assert.equal(normalizeUuid(expected), expected);
  assert.equal(normalizeUuid("123e4567e89b12d3a456426614174000"), expected);
  assert.equal(normalizeUuid("not-a-uuid"), null);
});

test("parsePolygon validates and closes legacy polygons", () => {
  assert.deepEqual(
    parsePolygon("[[52.1,13.1],[52.2,13.1],[52.2,13.2]]", "region-1"),
    [
      [52.1, 13.1],
      [52.2, 13.1],
      [52.2, 13.2],
      [52.1, 13.1],
    ],
  );
  assert.throws(() => parsePolygon("[]", "region-1"), /valid polygon/);
});

test("detectState recognizes German state names", () => {
  assert.equal(detectState("Berlin, Deutschland"), "BE");
  assert.equal(detectState("Erfurt, Thüringen, Deutschland"), "TH");
  assert.equal(detectState("Unknown"), "");
});

test("legacyObjectKey supports path-style MinIO URLs", () => {
  assert.equal(
    legacyObjectKey(
      "https://minio.example.test/map-images/image-id-photo.webp",
      "map-images",
    ),
    "image-id-photo.webp",
  );
  assert.equal(
    legacyObjectKey(
      "https://map-images.minio.example.test/image-id-photo.webp",
      "map-images",
    ),
    "image-id-photo.webp",
  );
});

test("summarizeAwsError keeps useful S3 diagnostics", () => {
  assert.equal(
    summarizeAwsError({
      name: "UnknownError",
      message: "socket hang up",
      $metadata: {
        httpStatusCode: 403,
        requestId: "request-1",
        extendedRequestId: "extended-1",
      },
    }),
    "UnknownError socket hang up http=403 requestId=request-1 extendedRequestId=extended-1",
  );
});

test("makeRegionRecord maps legacy fields and builders", () => {
  const regionId = "123e4567-e89b-12d3-a456-426614174000";
  const creator = "123e4567-e89b-12d3-a456-426614174001";
  const builder = "123e4567-e89b-12d3-a456-426614174002";
  const builders = new Map([
    [
      regionId,
      [
        { minecraftUUID: builder },
        { minecraftUUID: builder },
        { minecraftUUID: creator },
      ],
    ],
  ]);
  const result = makeRegionRecord(
    {
      id: regionId,
      userUUID: creator,
      ownerMinecraftUUID: null,
      description: null,
      data: "[[52,13],[52.1,13],[52.1,13.1]]",
      city: "Berlin",
      osmDisplayName: "Berlin, Deutschland",
      area: 100,
      buildings: 2,
      createdAt: new Date("2024-01-01T00:00:00Z"),
      lastModified: new Date("2024-01-02T00:00:00Z"),
      isEventRegion: 0,
      isPlotRegion: 1,
      isFinished: 1,
    },
    builders,
  );

  assert.equal(result.type, "plot");
  assert.equal(result.state, "BE");
  assert.deepEqual(result.builders, [builder]);
  assert.equal(result.finished, true);
  assert.deepEqual(result.polygon.at(-1), result.polygon[0]);
});

test("legacy EVENT and PLOT markers produce typed regions with valid creators", () => {
  const previous = process.env.MIGRATION_SYSTEM_CREATOR_UUID;
  delete process.env.MIGRATION_SYSTEM_CREATOR_UUID;
  const baseRow = {
    id: "123e4567-e89b-12d3-a456-426614174010",
    ownerMinecraftUUID: null,
    description: "",
    data: "[[52,13],[52.1,13],[52.1,13.1]]",
    city: "Berlin",
    osmDisplayName: "Berlin, Deutschland",
    area: 100,
    buildings: 0,
    createdAt: new Date("2024-01-01T00:00:00Z"),
    lastModified: new Date("2024-01-01T00:00:00Z"),
    isEventRegion: 0,
    isPlotRegion: 0,
    isFinished: 0,
  };

  try {
    const event = makeRegionRecord(
      { ...baseRow, userUUID: "EVENT" },
      new Map(),
    );
    const plot = makeRegionRecord(
      {
        ...baseRow,
        id: "123e4567-e89b-12d3-a456-426614174011",
        userUUID: "plot",
      },
      new Map(),
    );

    assert.equal(event.type, "event");
    assert.equal(event.creatorUUID, "00000000-0000-0000-0000-000000000001");
    assert.equal(plot.type, "plot");
    assert.equal(plot.creatorUUID, "00000000-0000-0000-0000-000000000002");
  } finally {
    if (previous === undefined) {
      delete process.env.MIGRATION_SYSTEM_CREATOR_UUID;
    } else {
      process.env.MIGRATION_SYSTEM_CREATOR_UUID = previous;
    }
  }
});

test("legacy markers prefer owner and configured creator UUIDs", () => {
  const owner = "123e4567-e89b-12d3-a456-426614174020";
  assert.equal(
    resolveCreatorUuid({ userUUID: "EVENT", ownerMinecraftUUID: owner }),
    owner,
  );

  const previous = process.env.MIGRATION_SYSTEM_CREATOR_UUID;
  process.env.MIGRATION_SYSTEM_CREATOR_UUID =
    "123e4567-e89b-12d3-a456-426614174021";
  try {
    assert.equal(
      resolveCreatorUuid({ userUUID: "PLOT", ownerMinecraftUUID: null }),
      "123e4567-e89b-12d3-a456-426614174021",
    );
  } finally {
    if (previous === undefined) {
      delete process.env.MIGRATION_SYSTEM_CREATOR_UUID;
    } else {
      process.env.MIGRATION_SYSTEM_CREATOR_UUID = previous;
    }
  }
});

test("parseArgs supports modes and dry-run", () => {
  assert.deepEqual(parseArgs(["images", "--dry-run"]), {
    help: false,
    mode: "images",
    dryRun: true,
  });
  assert.throws(() => parseArgs(["unknown"]), /Unknown mode/);
});
