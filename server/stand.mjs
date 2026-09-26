// Fachebene: übersetzt zwischen den JSON-Blöcken im Speicherstand und dem, was der
// Trainer in der Oberfläche zeigt. Kennt die Fundstellen der einzelnen Werte.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { leseStand, schreibeStand, finde } from './gvas.mjs';

// Der Ordner lässt sich per Umgebungsvariable umbiegen — die Prüfung arbeitet damit
// auf Kopien, statt an den echten Spielständen herumzuschreiben.
export const SPEICHERORDNER =
  process.env.PCS_SAVES ||
  path.join(os.homedir(), 'AppData', 'Local', 'PoliceChiefSimulator', 'Saved', 'SaveGames');

export const SICHERUNGSORDNER = path.join(SPEICHERORDNER, 'trainer-sicherungen');

/**
 * Legt eine Sicherungskopie an und gibt deren Dateinamen zurück.
 * Der Zeitstempel geht bis auf die Millisekunde, und falls es diesen Namen doch
 * schon gibt, wird durchgezählt: eine Sicherung darf NIE eine andere überschreiben —
 * sonst ist bei zwei Vorgängen kurz hintereinander der alte Stand für immer weg.
 */
function legeSicherungAn(quelle) {
  fs.mkdirSync(SICHERUNGSORDNER, { recursive: true });
  const stempel = new Date().toISOString().replace(/[:.]/g, '-').replace('Z', '');
  const grund = `${path.basename(quelle)}.${stempel}`;
  let ziel = path.join(SICHERUNGSORDNER, `${grund}.sicherung`);
  for (let n = 2; fs.existsSync(ziel); n++) ziel = path.join(SICHERUNGSORDNER, `${grund}-${n}.sicherung`);
  fs.copyFileSync(quelle, ziel);
  return ziel;
}

// --- Speicherstände auflisten ------------------------------------------------

export function listeStaende() {
  if (!fs.existsSync(SPEICHERORDNER)) return [];
  return fs
    .readdirSync(SPEICHERORDNER)
    .filter((d) => d.toLowerCase().endsWith('.sav'))
    .map((datei) => {
      const p = path.join(SPEICHERORDNER, datei);
      const s = fs.statSync(p);
      return { datei, groesse: s.size, geaendert: s.mtime.toISOString() };
    })
    .sort((a, b) => b.geaendert.localeCompare(a.geaendert));
}

function pfadVon(datei) {
  if (datei.includes('/') || datei.includes('\\') || !datei.toLowerCase().endsWith('.sav'))
    throw new Error('Unzulässiger Dateiname.');
  const p = path.join(SPEICHERORDNER, datei);
  if (!fs.existsSync(p)) throw new Error(`„${datei}" gibt es nicht.`);
  return p;
}

// --- Zugriff auf die JSON-Blöcke ---------------------------------------------

const KARTEN = ['SubsystemsJsonData', 'ComponentSystemsJsonData'];

/** Öffnet einen Stand und packt alle JSON-Blöcke aus. */
export function oeffne(datei) {
  const stand = leseStand(fs.readFileSync(pfadVon(datei)));
  const bloecke = new Map(); // Schlüssel -> {karte, index, daten}

  for (const kartenName of KARTEN) {
    const e = finde(stand, kartenName);
    if (!e?.karte) continue;
    e.karte.eintraege.forEach(([schluessel, text], index) => {
      let daten;
      try {
        daten = JSON.parse(text);
      } catch {
        return; // kein JSON — lassen wir in Ruhe
      }
      bloecke.set(schluessel, { kartenName, index, daten });
    });
  }

  return { datei, stand, bloecke };
}

/** Schreibt die geänderten Blöcke zurück in die Karten und speichert. */
export function sichereUndSpeichere(akte) {
  const { datei, stand, bloecke } = akte;
  const beruehrt = new Set();

  for (const [schluessel, block] of bloecke) {
    if (!block.schmutzig) continue;
    const e = finde(stand, block.kartenName);
    e.karte.eintraege[block.index] = [schluessel, JSON.stringify(block.daten)];
    e.geaendert = true;
    beruehrt.add(block.kartenName);
  }

  if (!beruehrt.size) return { gespeichert: false, sicherung: null };

  const quelle = pfadVon(datei);
  const sicherung = legeSicherungAn(quelle);

  const neu = schreibeStand(stand);
  // Gegenprobe: der frisch geschriebene Stand muss sich wieder lesen lassen.
  const kontrolle = leseStand(neu);
  for (const kartenName of KARTEN) {
    const e = finde(kontrolle, kartenName);
    if (e && !e.karte) throw new Error(`Die Karte „${kartenName}" ließe sich danach nicht mehr lesen.`);
  }

  fs.writeFileSync(quelle, neu);
  return { gespeichert: true, sicherung: path.basename(sicherung) };
}

// Kleiner Helfer: Wert an einem Pfad lesen bzw. setzen.
const lies = (o, pfad) => pfad.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
function setze(o, pfad, wert) {
  const teile = pfad.split('.');
  const letzter = teile.pop();
  const ziel = teile.reduce((a, k) => (a == null ? a : a[k]), o);
  if (ziel == null) throw new Error(`Pfad „${pfad}" gibt es in diesem Stand nicht.`);
  ziel[letzter] = wert;
}

// --- Die Regler --------------------------------------------------------------
//
// Jeder Regler sagt, in welchem Block er wohnt und wo darin. Die Oberfläche baut
// sich daraus selbst auf — neue Regler brauchen hier nur eine Zeile.

export const REGLER = [
  { feld: 'geld', block: 'PP_EconomySubsystem', pfad: 'money', titel: 'Geld', art: 'zahl', min: 0, einheit: '$' },
  { feld: 'tagesEinnahmen', block: 'PP_EconomySubsystem', pfad: 'dayIncome', titel: 'Einnahmen heute', art: 'zahl', einheit: '$' },
  { feld: 'tagesKosten', block: 'PP_EconomySubsystem', pfad: 'dayCosts', titel: 'Kosten heute', art: 'zahl', einheit: '$' },
  { feld: 'rufStufe', block: 'PP_ReputationSubsystem', pfad: 'reputationLevel', titel: 'Ruf-Stufe', art: 'zahl', min: 0 },
  { feld: 'rufPunkte', block: 'PP_ReputationSubsystem', pfad: 'currentXP', titel: 'Ruf-Punkte', art: 'zahl', min: 0 },
  { feld: 'rang', block: 'PP_ReputationSubsystem', pfad: 'rank', titel: 'Rang', art: 'text' },
  { feld: 'personalPlaetze', block: 'PP_WorkerSubsystem', pfad: 'workerSlotsAmount', titel: 'Personalplätze', art: 'zahl', min: 0 },
  { feld: 'lohnSchulden', block: 'PP_WorkerSubsystem', pfad: 'wageDebt', titel: 'Lohnschulden', art: 'zahl', min: 0, einheit: '$' },
  { feld: 'verstoesse', block: 'PP_PlayerOffenseSubsystem', pfad: 'offenseCount', titel: 'Eigene Verstöße', art: 'zahl', min: 0 },
];

/** Liest das vollständige Trainer-Modell aus einem geöffneten Stand. */
export function leseModell(akte) {
  const { stand, bloecke } = akte;
  const holeDaten = (b) => bloecke.get(b)?.daten;

  const werte = {};
  const fehlend = [];
  for (const r of REGLER) {
    const daten = holeDaten(r.block);
    if (!daten) {
      fehlend.push(r.feld);
      continue;
    }
    const w = lies(daten, r.pfad);
    if (w === undefined) fehlend.push(r.feld);
    else werte[r.feld] = w;
  }

  const ausbau = holeDaten('BC_UpgradeManager_C')?.upgradeLevels ?? {};

  const npc = holeDaten('PP_NPCDataSubsystem') ?? {};
  const arbeit = holeDaten('PP_WorkerSubsystem') ?? {};
  const basis = npc.baseDataPersistent ?? {};
  const arbeiter = npc.workerDataPersistent ?? {};

  const zuPerson = (id, angestellt) => {
    const b = basis[id] ?? {};
    const w = arbeiter[id] ?? {};
    return {
      id,
      angestellt,
      name: [b.name, b.surname].filter(Boolean).join(' ') || '(unbekannt)',
      beruf: b.occupation ?? '',
      alter: b.age ?? null,
      rolle: w.role ?? '',
      stufe: w.level?.level ?? null,
      punkte: w.level?.xp ?? null,
      moral: w.morale ?? null,
      kraft: w.stats?.str?.level ?? null,
      verstand: w.stats?.int?.level ?? null,
      auftreten: w.stats?.cha?.level ?? null,
      tot: w.bDead ?? false,
    };
  };

  const personal = [
    ...(arbeit.hiredWorkers ?? []).map((id) => zuPerson(id, true)),
    ...(arbeit.workersForHire ?? []).map((id) => zuPerson(id, false)),
  ];

  return {
    datei: akte.datei,
    engine: stand.engine,
    spielzeit: finde(stand, 'PlayTimeInSeconds') ? undefined : undefined,
    werte,
    fehlend,
    ausbau,
    personal,
    bloecke: [...bloecke.keys()].map((k) => ({
      schluessel: k,
      kartenName: bloecke.get(k).kartenName,
      groesse: JSON.stringify(bloecke.get(k).daten).length,
    })),
  };
}

/** Überträgt Änderungen aus der Oberfläche in die Blöcke. */
export function wendeAn(akte, aenderungen) {
  const { bloecke } = akte;
  const angefasst = [];

  const markiere = (schluessel) => {
    const b = bloecke.get(schluessel);
    if (!b) throw new Error(`Der Block „${schluessel}" fehlt in diesem Stand.`);
    b.schmutzig = true;
    return b;
  };

  // Einfache Regler
  for (const r of REGLER) {
    if (!(r.feld in (aenderungen.werte ?? {}))) continue;
    let wert = aenderungen.werte[r.feld];
    if (r.art === 'zahl') {
      wert = Number(wert);
      if (!Number.isFinite(wert)) throw new Error(`„${r.titel}": keine gültige Zahl.`);
      if (r.min != null && wert < r.min) wert = r.min;
    }
    const b = markiere(r.block);
    setze(b.daten, r.pfad, wert);
    angefasst.push(r.titel);
  }

  // Ausbaustufen
  if (aenderungen.ausbau && Object.keys(aenderungen.ausbau).length) {
    const b = markiere('BC_UpgradeManager_C');
    for (const [bereich, stufe] of Object.entries(aenderungen.ausbau)) {
      if (!(bereich in b.daten.upgradeLevels))
        throw new Error(`Den Ausbaubereich „${bereich}" gibt es hier nicht.`);
      const n = Number(stufe);
      if (!Number.isInteger(n) || n < 0) throw new Error(`Ausbaustufe für „${bereich}" ist ungültig.`);
      b.daten.upgradeLevels[bereich] = n;
    }
    angefasst.push('Ausbaustufen');
  }

  // Personal
  if (aenderungen.personal?.length) {
    const b = markiere('PP_NPCDataSubsystem');
    const arbeiter = b.daten.workerDataPersistent ?? {};
    for (const p of aenderungen.personal) {
      const w = arbeiter[p.id];
      if (!w) throw new Error(`Person ${p.id} ist in diesem Stand nicht hinterlegt.`);
      if (p.stufe != null) w.level.level = Number(p.stufe);
      if (p.punkte != null) w.level.xp = Number(p.punkte);
      if (p.moral != null) w.morale = Number(p.moral);
      if (p.kraft != null) w.stats.str.level = Number(p.kraft);
      if (p.verstand != null) w.stats.int.level = Number(p.verstand);
      if (p.auftreten != null) w.stats.cha.level = Number(p.auftreten);
    }
    angefasst.push(`Personal (${aenderungen.personal.length})`);
  }

  // Roh-Ansicht: ganze Blöcke ersetzen
  for (const [schluessel, text] of Object.entries(aenderungen.roh ?? {})) {
    let daten;
    try {
      daten = JSON.parse(text);
    } catch (e) {
      throw new Error(`„${schluessel}" ist kein gültiges JSON: ${e.message}`);
    }
    const b = markiere(schluessel);
    b.daten = daten;
    angefasst.push(`Roh: ${schluessel}`);
  }

  return angefasst;
}

/** Gibt einen einzelnen Block als lesbares JSON zurück. */
export function leseBlock(akte, schluessel) {
  const b = akte.bloecke.get(schluessel);
  if (!b) throw new Error(`Der Block „${schluessel}" fehlt in diesem Stand.`);
  return JSON.stringify(b.daten, null, 2);
}

// --- Sicherungen -------------------------------------------------------------

export function listeSicherungen() {
  if (!fs.existsSync(SICHERUNGSORDNER)) return [];
  return fs
    .readdirSync(SICHERUNGSORDNER)
    .filter((d) => d.endsWith('.sicherung'))
    .map((datei) => {
      const s = fs.statSync(path.join(SICHERUNGSORDNER, datei));
      return { datei, ziel: datei.split('.sav.')[0] + '.sav', groesse: s.size, erstellt: s.mtime.toISOString() };
    })
    .sort((a, b) => b.erstellt.localeCompare(a.erstellt));
}

export function spieleZurueck(sicherungsDatei) {
  if (sicherungsDatei.includes('/') || sicherungsDatei.includes('\\') || !sicherungsDatei.endsWith('.sicherung'))
    throw new Error('Unzulässiger Dateiname.');
  const quelle = path.join(SICHERUNGSORDNER, sicherungsDatei);
  if (!fs.existsSync(quelle)) throw new Error('Diese Sicherung gibt es nicht.');
  const ziel = pfadVon(sicherungsDatei.split('.sav.')[0] + '.sav');
  // Vor dem Zurückspielen noch einmal den jetzigen Zustand wegsichern — auch das darf
  // die Sicherung, aus der wir gerade zurückspielen, unter keinen Umständen treffen.
  legeSicherungAn(ziel);
  fs.copyFileSync(quelle, ziel);
  return path.basename(ziel);
}
