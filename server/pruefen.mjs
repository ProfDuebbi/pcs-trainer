// Prüfwerkzeug. Arbeitet auf Kopien der echten Speicherstände in einem Wegwerfordner —
// die Originale werden nur gelesen. Vor jeder Änderung am Trainer laufen lassen.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const ECHT =
  process.env.PCS_SAVES_QUELLE ||
  path.join(os.homedir(), 'AppData', 'Local', 'PoliceChiefSimulator', 'Saved', 'SaveGames');
const SPIELWIESE = fs.mkdtempSync(path.join(os.tmpdir(), 'pcs-pruefung-'));
process.env.PCS_SAVES = SPIELWIESE;

const { leseStand, schreibeStand, finde } = await import('./gvas.mjs');
const { oeffne, leseModell, wendeAn, sichereUndSpeichere, listeStaende, spieleZurueck, listeSicherungen } =
  await import('./stand.mjs');

let bestanden = 0;
let gefallen = 0;
const pruefe = (titel, fn) => {
  try {
    fn();
    bestanden++;
    console.log(`  ✓ ${titel}`);
  } catch (e) {
    gefallen++;
    console.log(`  ✗ ${titel}\n      ${e.message}`);
  }
};
const gleich = (ist, soll, was) => {
  if (JSON.stringify(ist) !== JSON.stringify(soll))
    throw new Error(`${was}: erwartet ${JSON.stringify(soll)}, bekommen ${JSON.stringify(ist)}`);
};
const wahr = (b, was) => {
  if (!b) throw new Error(was);
};

if (!fs.existsSync(ECHT)) {
  console.error(`Keine Speicherstände unter ${ECHT} gefunden.`);
  process.exit(1);
}
const dateien = fs.readdirSync(ECHT).filter((d) => d.toLowerCase().endsWith('.sav'));
for (const d of dateien) fs.copyFileSync(path.join(ECHT, d), path.join(SPIELWIESE, d));

console.log(`Spielwiese: ${SPIELWIESE}\nStände: ${dateien.length}\n`);

// --- 1. Unveränderter Durchlauf ----------------------------------------------
console.log('Lesen und unverändert zurückschreiben');
for (const d of dateien) {
  pruefe(`${d} bleibt Byte für Byte gleich`, () => {
    const roh = fs.readFileSync(path.join(SPIELWIESE, d));
    wahr(schreibeStand(leseStand(roh)).equals(roh), 'die Bytes weichen ab');
  });
}

// --- 2. Der große Stand als Arbeitsstück -------------------------------------
const gross = dateien
  .map((d) => ({ d, groesse: fs.statSync(path.join(SPIELWIESE, d)).size }))
  .sort((a, b) => b.groesse - a.groesse)[0].d;

console.log(`\nModell lesen (${gross})`);
const modell = leseModell(oeffne(gross));
pruefe('Geld ist eine Zahl', () => wahr(typeof modell.werte.geld === 'number', 'kein Zahlenwert'));
pruefe('Ruf-Stufe ist da', () => wahr(typeof modell.werte.rufStufe === 'number', 'fehlt'));
pruefe('kein Regler ohne Fundstelle', () =>
  gleich(modell.fehlend, [], 'diese Regler finden ihren Wert nicht'));
pruefe('Ausbaubereiche gefunden', () =>
  wahr(Object.keys(modell.ausbau).length >= 10, `nur ${Object.keys(modell.ausbau).length}`));
pruefe('Personal gefunden', () => wahr(modell.personal.length > 0, 'niemand da'));
pruefe('Personal hat Namen und Werte', () => {
  const p = modell.personal.find((x) => x.angestellt);
  wahr(p && p.name !== '(unbekannt)' && typeof p.stufe === 'number', 'unvollständig');
});
pruefe('alle Blöcke ausgepackt', () => wahr(modell.bloecke.length >= 40, `nur ${modell.bloecke.length}`));

// --- 3. Schreiben, das die Datei LÄNGER macht --------------------------------
console.log('\nSchreiben');
pruefe('Geld setzen — Datei wächst und bleibt lesbar', () => {
  const vorher = fs.statSync(path.join(SPIELWIESE, gross)).size;
  const akte = oeffne(gross);
  const angefasst = wendeAn(akte, { werte: { geld: 987654321 } });
  gleich(angefasst, ['Geld'], 'angefasste Regler');
  const { gespeichert } = sichereUndSpeichere(akte);
  wahr(gespeichert, 'nichts gespeichert');
  const nachher = fs.statSync(path.join(SPIELWIESE, gross)).size;
  wahr(nachher > vorher, `Datei wurde nicht größer (${vorher} → ${nachher})`);
  gleich(leseModell(oeffne(gross)).werte.geld, 987654321, 'Geld nach dem Neulesen');
});

pruefe('Datei ist danach noch ein gültiger GVAS-Stand', () => {
  const roh = fs.readFileSync(path.join(SPIELWIESE, gross));
  const s = leseStand(roh);
  wahr(schreibeStand(s).equals(roh), 'Durchlauf nach dem Schreiben weicht ab');
  wahr(finde(s, 'SubsystemsJsonData')?.karte?.eintraege.length >= 40, 'Karte verloren');
});

pruefe('Schreiben, das die Datei KÜRZER macht', () => {
  const vorher = fs.statSync(path.join(SPIELWIESE, gross)).size;
  const akte = oeffne(gross);
  wendeAn(akte, { werte: { geld: 1 } });
  sichereUndSpeichere(akte);
  const nachher = fs.statSync(path.join(SPIELWIESE, gross)).size;
  wahr(nachher < vorher, `Datei wurde nicht kleiner (${vorher} → ${nachher})`);
  gleich(leseModell(oeffne(gross)).werte.geld, 1, 'Geld nach dem Neulesen');
});

pruefe('mehrere Regler auf einmal', () => {
  const akte = oeffne(gross);
  wendeAn(akte, { werte: { geld: 50000, rufStufe: 12, rufPunkte: 3000, personalPlaetze: 20, lohnSchulden: 0 } });
  sichereUndSpeichere(akte);
  const m = leseModell(oeffne(gross));
  gleich(
    [m.werte.geld, m.werte.rufStufe, m.werte.rufPunkte, m.werte.personalPlaetze],
    [50000, 12, 3000, 20],
    'Werte nach dem Neulesen',
  );
});

pruefe('Ausbaustufen setzen', () => {
  const akte = oeffne(gross);
  const bereiche = Object.keys(leseModell(akte).ausbau);
  wendeAn(akte, { ausbau: { [bereiche[0]]: 5, [bereiche[1]]: 3 } });
  sichereUndSpeichere(akte);
  const m = leseModell(oeffne(gross));
  gleich([m.ausbau[bereiche[0]], m.ausbau[bereiche[1]]], [5, 3], 'Ausbaustufen');
});

pruefe('Personalwerte setzen', () => {
  const akte = oeffne(gross);
  const person = leseModell(akte).personal.find((p) => p.angestellt);
  wendeAn(akte, {
    personal: [{ id: person.id, stufe: 9, moral: 100, kraft: 7, verstand: 7, auftreten: 7 }],
  });
  sichereUndSpeichere(akte);
  const nach = leseModell(oeffne(gross)).personal.find((p) => p.id === person.id);
  gleich(
    [nach.stufe, nach.moral, nach.kraft, nach.verstand, nach.auftreten],
    [9, 100, 7, 7, 7],
    'Personalwerte',
  );
});

pruefe('Roh-Block ersetzen', () => {
  const akte = oeffne(gross);
  wendeAn(akte, { roh: { PP_PlayerOffenseSubsystem: '{"offenseCount":42}' } });
  sichereUndSpeichere(akte);
  gleich(leseModell(oeffne(gross)).werte.verstoesse, 42, 'Verstöße');
});

// --- 4. Abwehr ---------------------------------------------------------------
console.log('\nAbwehr gegen Unsinn');
const wirftFehler = (titel, fn, teil) =>
  pruefe(titel, () => {
    try {
      fn();
    } catch (e) {
      if (teil && !e.message.includes(teil)) throw new Error(`falsche Meldung: ${e.message}`);
      return;
    }
    throw new Error('kein Fehler ausgelöst');
  });

wirftFehler('kaputtes JSON in der Roh-Ansicht', () =>
  wendeAn(oeffne(gross), { roh: { PP_PlayerOffenseSubsystem: '{kaputt' } }), 'kein gültiges JSON');
wirftFehler('unbekannter Ausbaubereich', () => wendeAn(oeffne(gross), { ausbau: { erfunden: 3 } }), 'gibt es hier nicht');
wirftFehler('unbekannte Person', () => wendeAn(oeffne(gross), { personal: [{ id: 'gibtsnicht', stufe: 3 }] }), 'nicht hinterlegt');
wirftFehler('Dateiname mit Pfad', () => oeffne('../../boese.sav'), 'Unzulässiger Dateiname');
wirftFehler('Datei ohne .sav', () => oeffne('irgendwas.txt'), 'Unzulässiger Dateiname');
wirftFehler('Geld als Text', () => wendeAn(oeffne(gross), { werte: { geld: 'viel' } }), 'keine gültige Zahl');
pruefe('negatives Geld wird auf Null gezogen', () => {
  const akte = oeffne(gross);
  wendeAn(akte, { werte: { geld: -5000 } });
  sichereUndSpeichere(akte);
  gleich(leseModell(oeffne(gross)).werte.geld, 0, 'Geld');
});
pruefe('ohne Änderung wird nicht geschrieben', () => {
  const akte = oeffne(gross);
  const { gespeichert, sicherung } = sichereUndSpeichere(akte);
  wahr(gespeichert === false && sicherung === null, 'es wurde doch geschrieben');
});

// --- 5. Sicherungen ----------------------------------------------------------
console.log('\nSicherungen');
pruefe('jede Änderung legt eine Sicherung an', () => wahr(listeSicherungen().length > 0, 'keine da'));
pruefe('Zurückspielen stellt den alten Stand her', () => {
  const akte = oeffne(gross);
  wendeAn(akte, { werte: { geld: 111 } });
  const { sicherung } = sichereUndSpeichere(akte);
  gleich(leseModell(oeffne(gross)).werte.geld, 111, 'Geld vor dem Zurückspielen');
  spieleZurueck(sicherung);
  wahr(leseModell(oeffne(gross)).werte.geld !== 111, 'der alte Wert kam nicht zurück');
});
wirftFehler('Sicherung mit Pfad im Namen', () => spieleZurueck('../boese.sicherung'), 'Unzulässiger Dateiname');

// --- 6. Liste ----------------------------------------------------------------
console.log('\nÜbersicht');
pruefe('alle Stände werden aufgelistet', () => wahr(listeStaende().length === dateien.length, 'Anzahl weicht ab'));

// --- Schluss -----------------------------------------------------------------
fs.rmSync(SPIELWIESE, { recursive: true, force: true });
console.log(`\n${bestanden} von ${bestanden + gefallen} Prüfungen bestanden.`);
process.exit(gefallen ? 1 : 0);
