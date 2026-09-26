# Trainer · Police Chief Simulator

Ein Werkzeug zum Bearbeiten der Speicherstände von *Police Chief Simulator*
(Unreal Engine 5.6). Läuft vollständig lokal: ein kleiner Node-Helfer macht die
Dateiarbeit, bedient wird er im Browser.

```
npm install && npm --prefix web install
npm start
```

Danach öffnet sich <http://localhost:5183>.

## Wie es arbeitet

Das Spiel legt seine Stände unter
`%LOCALAPPDATA%\PoliceChiefSimulator\Saved\SaveGames` als **GVAS**-Dateien ab,
unkomprimiert. Der Clou: die Spielsysteme stehen darin als **reines JSON** —
`PP_EconomySubsystem` hält das Geld, `PP_ReputationSubsystem` den Ruf,
`BC_UpgradeManager_C` die Ausbaustufen, `PP_NPCDataSubsystem` das Personal.

Deshalb braucht dieser Trainer **nicht** im Prozessspeicher zu suchen. Er liest
die Datei, ändert das JSON und schreibt sie zurück. Das übersteht Spiel-Updates
und kann nichts zum Absturz bringen.

### Der Speicherstand darf nie kaputtgehen

Drei Vorkehrungen:

1. **Vor jedem Schreiben eine Sicherungskopie.** Sie landet in
   `SaveGames/trainer-sicherungen` und wird nie überschrieben — der Zeitstempel
   geht bis auf die Millisekunde und zählt bei Gleichstand durch.
2. **Was nicht verstanden wird, wird nicht angefasst.** Der Leser packt nur die
   beiden Karten mit den JSON-Blöcken aus; alle anderen Eigenschaften gehen Byte
   für Byte unverändert wieder hinaus.
3. **Gegenprobe vor dem Schreiben.** Die fertige Datei wird noch im Speicher
   einmal zurückgelesen. Erst wenn das klappt, wird sie auf die Platte gelegt.

Solange das Spiel läuft, ist Speichern gesperrt: sein nächster Autosave würde
jede Änderung wieder überschreiben.

## Prüfen

```
npm run pruefen
```

Kopiert die echten Speicherstände in einen Wegwerfordner und arbeitet nur dort.
Geprüft wird unter anderem, dass jede Datei unverändert **Byte für Byte** wieder
herauskommt, dass Änderungen auch dann sitzen, wenn die Datei dadurch länger
oder kürzer wird, und dass Sicherungen sich zurückspielen lassen.

## Aufbau

```
server/
  gvas.mjs     Lesen und Schreiben des GVAS-Formats (UE 5.4+)
  stand.mjs    Fachebene: wo welcher Wert im Speicherstand wohnt
  index.mjs    Der lokale Helfer (hört nur auf 127.0.0.1)
  pruefen.mjs  Prüfwerkzeug
  start.mjs    Startet Helfer und Oberfläche zusammen
web/
  src/haut/    Nexus UI Kit (unverändert) + eigene Anpassungen
  src/seiten/  Geld & Ruf · Ausbau · Personal · Roh-Ansicht · Sicherungen
```

Ein neuer Regler braucht in `server/stand.mjs` genau eine Zeile in `REGLER` —
die Oberfläche baut sich daraus selbst auf.

## Zum Format

Seit UE 5.4 sieht eine Eigenschaft so aus:

```
Name (FString) · Typbaum · Größe (int32) · Merkmale (uint8) · Rumpf
```

Der **Typbaum** trägt seine Parameter bei sich
(`MapProperty<StrProperty, StrProperty>`, `StructProperty<DateTime</Script/CoreUObject>>`)
— das ersetzt das frühere typabhängige Zwischenstück. Die **Merkmale** ersetzen
das alte Guid-Byte: Bit 0 zieht einen Feldindex nach sich, Bit 1 eine Guid,
Bit 3 heißt „Wert ist null", Bit 4 trägt bei `BoolProperty` den Wert selbst.

## Gestaltung

Die Oberfläche benutzt das **Nexus UI Kit** (Copyright © 2026 ProfDuebbi).
`web/src/haut/nexus.css` ist Zeile für Zeile unverändert; alles Eigene steht in
`trainer.css` daneben. Siehe `web/src/haut/LIZENZ-nexus-ui-kit.txt`.
