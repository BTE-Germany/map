# Sync zur Haupt-BTE-Karte

Einweg-Synchronisation: Regionen der BTEG-Karte werden als **Claims** des Build
Teams auf der Haupt-Karte von BuildTheEarth veröffentlicht.

Grundlage:
[Custom Map Integration](https://resources.buildtheearth.net/s/new-website/doc/custom-map-integration-eERY0LZFLo)
und die `Token based`-Routen der
[BTE API](https://buildtheearth.github.io/website-node-backend/).

Der in der Doku beschriebene **Webhook-Teil ist bewusst nicht implementiert** —
die BTEG-Karte ist die Quelle der Wahrheit, es fließen keine Änderungen zurück.

## Konfiguration

| Variable         | Pflicht | Bedeutung                                                        |
| ---------------- | ------- | ---------------------------------------------------------------- |
| `BTE_TEAM_TOKEN` | ja      | Team-Token (Bearer). Bekommt der Team-Owner per Discord-DM.       |
| `BTE_TEAM_SLUG`  | ja¹     | Slug des Build Teams, z. B. `de` — wird als `?slug=true` gesendet. |
| `BTE_TEAM_ID`    | ja¹     | Team-UUID. Hat Vorrang vor dem Slug.                              |
| `BTE_API_URL`    | nein    | API-Root, Default `https://api.buildtheearth.net/api/v1`.         |

¹ Entweder Slug oder ID.

Ohne diese Werte ist der Sync komplett inaktiv — das Admin-Panel zeigt einen
entsprechenden Hinweis, und keine Region-Aktion versucht einen API-Aufruf.

Der Ein-/Ausschalter für den **automatischen** Sync liegt dagegen in der
Datenbank (`app_settings`, Key `bte_sync.auto_enabled`, Default `false`) und ist
unter `/admin/sync` umschaltbar — ohne Deploy.

## Datenmodell

| Region (BTEG)          | Claim (BTE)     |
| ---------------------- | --------------- |
| `id`                   | `externalId`    |
| `address` (Fallback `city`) | `name`     |
| `city`                 | `city`          |
| `description`          | `description`   |
| `buildings`            | `buildings`     |
| `finished`             | `finished`      |
| —                      | `active` (immer `true`) |
| `polygon` (`[lat, lng][]`, geschlossen) | `area` (`["lng, lat", …]`, offen) |
| `creatorUUID`          | `owner` (Minecraft-Name über playerdb) |
| `builders`             | `builders` (Minecraft-Namen) |

Unsere Region-ID reist als `externalId` mit. Dadurch ist jeder Claim, den wir
angelegt haben, ohne lokale ID-Tabelle adressierbar
(`…/claims/{regionId}?external=true`), und ein Claim ohne bekannte `externalId`
ist per Definition keiner von uns.

`bte_sync_state` speichert nur das Ergebnis der letzten Übertragung
(Status, Fehlermeldung, Claim-ID, Fingerprint), damit das Panel es anzeigen und
unveränderte Regionen ohne API-Aufruf überspringen kann.

Der **Fingerprint** ist ein SHA-256 über alle übertragenen Felder plus die
rohen Minecraft-UUIDs von Ersteller und Buildern. Über die UUIDs statt der
aufgelösten Namen, damit „hat sich etwas geändert?" ohne playerdb-Abfrage
beantwortbar ist — Namen werden nur bei einer tatsächlichen Übertragung
aufgelöst.

## Automatischer Sync

Ist er aktiv, lösen diese Pfade eine Übertragung aus (jeweils **nach** dem
lokalen Commit, per `after()` außerhalb der Response):

| Pfad | Aktion |
| ---- | ------ |
| `POST /api/region` (Minecraft-Plugin) | anlegen |
| `createRegionByAdmin` | anlegen |
| `updateRegion` (Beschreibung, Status, Builder) | aktualisieren |
| `adminUpdateRegion` | aktualisieren |
| `updateRegionPolygon` | aktualisieren |
| `executeTransfer` | aktualisieren (alle betroffenen Regionen) |
| `deleteRegion` | löschen — **immer**, siehe unten |

Beim Anlegen und beim Polygon-Update wird zusätzlich synchronisiert, sobald die
Gebäudezahl aus Overpass nachgeladen ist — ein No-Op, wenn sich dadurch nichts
ändert.

**Löschen ignoriert den Schalter.** Wird eine Region hier gelöscht, verschwindet
ihr Claim auch dann von der BTE-Karte, wenn der automatische Sync aus ist. Den
Sync zu pausieren heißt, unsere Änderungen zurückzuhalten — nicht, Claims
liegenzulassen, die von hier aus niemand mehr aufräumen kann.

Ein Fehler bricht **nie** die auslösende Aktion ab; er landet in
`bte_sync_state.last_error`, wird im Panel angezeigt und beim nächsten manuellen
Abgleich erneut versucht.

## Manueller Abgleich (`/admin/sync`)

Zwei Stufen, beide als SSE-Stream mit Fortschritt:

**„Abgleich prüfen"** (Dry-Run) lädt alle Claims des Teams und vergleicht sie mit
unseren Regionen:

- `unverändert` — der Claim existiert bereits **exakt so** (Name, Stadt,
  Beschreibung, Gebäude, Status und Polygon identisch). Es wird nichts gesendet.
- `aktualisieren` — Claim mit unserer `externalId` existiert, weicht aber ab.
  Die abweichenden Felder werden aufgelistet.
- `verknüpfen` — es existiert ein Claim **ohne** `externalId`, der dieselbe
  Fläche beschreibt (identischer Ring oder Mittelpunkt < 25 m entfernt bei
  < 10 % Flächenunterschied). Er wird übernommen statt ein Duplikat anzulegen.
- `neu anlegen` — nichts Vergleichbares vorhanden.
- `löschen` — Claim mit einer unserer Region-IDs, deren Region lokal nicht mehr
  existiert.

Fremde Claims (ohne `externalId`, ohne Flächen-Treffer) werden gezählt und
angefasst nichts.

**„Jetzt synchronisieren"** berechnet denselben Plan neu — nie auf Basis eines
veralteten Dry-Runs — und führt ihn aus (3 parallele Requests, Löschungen
sequenziell am Ende).

## Alle Claims löschen (Gefahrenzone)

`/admin/sync` enthält eine Aktion, die **jeden** Claim des Build Teams von der
BTE-Karte entfernt — auch Claims, die dort direkt angelegt wurden und keine
`externalId` von uns tragen. Lokale Regionen bleiben unberührt.

Sie ist doppelt abgesichert: das Panel verlangt die Eingabe von
`ALLE CLAIMS LOESCHEN`, und die Route lehnt den Request ohne exakt diese
Bestätigung mit `400` ab. Ausgeführt wird sequenziell, mit Fortschritt pro
Claim.

Läuft der Durchlauf fehlerfrei, wird anschließend `bte_sync_state` geleert —
der nächste Abgleich legt damit alle Regionen neu an. Ist der automatische Sync
aktiv, landen neue oder geänderte Regionen sofort wieder oben; das Panel weist
darauf hin.

Polygon-Vergleiche tolerieren, dass die API den Ring geschlossen
zurückgibt, und ignorieren Abweichungen unter ~0,1 m.

Die Duplikat-Suche läuft über einen Gitter-Index (~110 m Zellen) statt über
einen vollen Scan, damit der Abgleich auch bei tausenden Regionen linear bleibt.

## Bekannte Einschränkungen

- **Attribution ohne BTE-Account.** Owner und Builder werden nur über den
  Minecraft-Namen (playerdb) identifiziert. Lehnt die API eine Referenz ab, wird
  der Claim einmalig ohne Attribution erneut gesendet, statt ihn zu verlieren.
- **Erster Abgleich.** Regionen ohne bisherigen Sync-Status, deren Felder
  upstream identisch sind, gelten als `unverändert` — Ersteller/Builder eines
  Claims liefert die Lese-API nicht zurück, also ist das nicht prüfbar. Ab dem
  ersten Sync greift dafür der Fingerprint.
- **Ringrotation.** Ein Polygon, das upstream mit anderem Startpunkt oder
  umgekehrter Reihenfolge gespeichert wurde, gilt als geändert und wird einmal
  neu gesendet.
- **Regionstyp.** `plot`- und `event`-Regionen werden wie normale Regionen
  synchronisiert; die BTE-API kennt keine Entsprechung zum Typ.
