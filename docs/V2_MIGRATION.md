# Migration von Map v2

Das Skript `scripts/migrate-v2.mjs` migriert die alte MySQL-Datenbank nach
PostgreSQL und kopiert die zugehörigen Bilder von MinIO nach AWS S3.

## Zuordnung

| Alt | Neu |
| --- | --- |
| `Region.id` | `regions.id` |
| `Region.userUUID` | `regions.creatorUUID` |
| `Region.data` | `regions.polygon` |
| `Region.osmDisplayName` | `regions.address` |
| `Region.isEventRegion` / `isPlotRegion` | `regions.type` |
| `AdditionalBuilder.minecraftUUID` | `regions.builders[]` |
| `Image` plus MinIO-Objekt | `region_images` plus AWS-S3-Objekt |

Die alte Polygonreihenfolge `[lat, lng]` wird beibehalten. Offene Polygone
werden geschlossen. Das Bundesland wird, soweit möglich, aus
`osmDisplayName` abgeleitet. `landuse` bleibt leer und kann anschließend über
die bestehende Admin-Funktion neu berechnet werden.

`User`, `LinkCodes` und `InteractiveBuilding` haben im aktuellen Schema kein
Ziel und werden nicht migriert. Die Benutzerauflösung erfolgt in der aktuellen
Map über Keycloak und Minecraft-UUIDs.

## Vorbereitung

1. Die normalen Drizzle-Migrationen müssen bereits auf der Ziel-Datenbank
   ausgeführt worden sein: `pnpm db:migrate`.
2. `.env.migration.example` nach `.env.migration` kopieren und beide
   Datenbanken sowie beide S3-Ziele konfigurieren.
3. Die Ziel-Anwendung während der finalen Migration in den Wartungsmodus
   versetzen. Die alte Map sollte ab dem finalen Lauf keine Schreibzugriffe
   mehr annehmen.
4. Vor dem produktiven Lauf Backups von MySQL, PostgreSQL und MinIO erstellen.

## Ablauf

Zuerst nur lesen und validieren:

```bash
pnpm migrate:v2:dry-run
```

Anschließend die vollständige Migration:

```bash
pnpm migrate:v2
```

Einzelne Phasen können wiederholt werden:

```bash
node scripts/migrate-v2.mjs db
node scripts/migrate-v2.mjs images
node scripts/migrate-v2.mjs verify
```

Regionen und Bildzeilen werden anhand ihrer alten UUID per Upsert geschrieben.
Bereits vorhandene Zielobjekte mit derselben Größe werden nicht erneut
hochgeladen. Dadurch kann ein abgebrochener Lauf wiederholt werden.

## Wichtige Details

- Ein Bild wird erst in `region_images` eingetragen, nachdem das Zielobjekt
  erfolgreich hochgeladen und per `HEAD` geprüft wurde.
- Alte Bild-URLs werden auf ihren Objekt-Key reduziert. Das historische Format
  `<image-id>-<original-name>.webp` wird damit direkt unterstützt.
- Der Ziel-Key lautet `regions/<region-id>/<image-id>.<ext>`.
- Das Skript stoppt die DB-Phase, wenn Regions- oder Minecraft-UUIDs ungültig
  sind. Fehlerhafte Bilder werden vollständig aufgelistet und führen am Ende
  zu einem Fehlerstatus.
- Die Bild-Worker puffern jeweils ein Bild im Speicher. Bei großen Dateien
  `MIGRATION_IMAGE_CONCURRENCY` entsprechend klein halten.

Nach dem Lauf sollte die Anwendung mit den normalen `S3_*`-Variablen auf
denselben AWS-Bucket zeigen, der in `TARGET_S3_BUCKET` konfiguriert wurde.
