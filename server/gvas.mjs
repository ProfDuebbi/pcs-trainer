// GVAS — Lesen und Schreiben von Unreal-Engine-Speicherständen (UE 5.4 bis 5.6, unkomprimiert).
//
// Zum Format: Seit UE 5.4 trägt jede Eigenschaft ihren Typ als Baum mit Parametern
// („MapProperty<StrProperty, StrProperty>"), gefolgt von einer int32-Größe. Die alte
// Bauweise mit typabhängigem Zwischenstück zwischen Größe und Rumpf gibt es nicht mehr.
//
// Arbeitsweise: Die Eigenschaftskette auf oberster Ebene wird durchlaufen und jede
// Eigenschaft ROH mitgeschnitten. Tief ausgepackt wird nur, was der Trainer wirklich
// anfasst — die Karten mit den JSON-Blöcken. Alles andere geht beim Schreiben Byte für
// Byte unverändert wieder hinaus. Das hält die Fehlerfläche klein: was wir nicht
// verstehen, können wir auch nicht kaputtmachen.

const KENNUNG = 'GVAS';

class Leser {
  constructor(buf, pos = 0) {
    this.buf = buf;
    this.pos = pos;
  }
  int32() {
    const v = this.buf.readInt32LE(this.pos);
    this.pos += 4;
    return v;
  }
  byte() {
    return this.buf[this.pos++];
  }
  ueberspringe(n) {
    this.pos += n;
  }
  // FString: Länge >= 0 → latin1 mit Nullbyte, Länge < 0 → UTF-16LE mit Nullzeichen.
  text() {
    const len = this.int32();
    if (len === 0) return '';
    if (len > 0) {
      const s = this.buf.toString('latin1', this.pos, this.pos + len - 1);
      this.pos += len;
      return s;
    }
    const bytes = -len * 2;
    const s = this.buf.toString('utf16le', this.pos, this.pos + bytes - 2);
    this.pos += bytes;
    return s;
  }
  // Typbaum: Name, Anzahl Parameter, dann die Parameter selbst.
  typname() {
    const name = this.text();
    const anzahl = this.int32();
    const parameter = [];
    for (let i = 0; i < anzahl; i++) parameter.push(this.typname());
    return { name, parameter };
  }
}

class Schreiber {
  constructor() {
    this.teile = [];
  }
  roh(buf) {
    this.teile.push(buf);
    return this;
  }
  int32(v) {
    const b = Buffer.allocUnsafe(4);
    b.writeInt32LE(v);
    return this.roh(b);
  }
  // Schreibt wie Unreal: reines ASCII als latin1, alles andere als UTF-16LE.
  text(s) {
    if (s === '') return this.int32(0);
    // eslint-disable-next-line no-control-regex
    if (/^[\x00-\x7f]*$/.test(s)) {
      this.int32(s.length + 1);
      this.roh(Buffer.from(s, 'latin1'));
      return this.roh(Buffer.from([0]));
    }
    this.int32(-(s.length + 1));
    this.roh(Buffer.from(s, 'utf16le'));
    return this.roh(Buffer.from([0, 0]));
  }
  fertig() {
    return Buffer.concat(this.teile);
  }
}

function leseKarteAusTexten(buf) {
  const l = new Leser(buf);
  const zuEntfernen = l.int32();
  const anzahl = l.int32();
  if (anzahl < 0 || anzahl > 100000) throw new Error('unglaubwürdige Eintragszahl');
  const eintraege = [];
  for (let i = 0; i < anzahl; i++) eintraege.push([l.text(), l.text()]);
  if (l.pos !== buf.length) throw new Error('Karte passt nicht genau in ihren Rumpf');
  return { zuEntfernen, eintraege };
}

function schreibeKarteAusTexten({ zuEntfernen, eintraege }) {
  const s = new Schreiber();
  s.int32(zuEntfernen);
  s.int32(eintraege.length);
  for (const [k, v] of eintraege) s.text(k).text(v);
  return s.fertig();
}

const istTextKarte = (t) =>
  t.name === 'MapProperty' &&
  t.parameter.length === 2 &&
  t.parameter.every((p) => p.name === 'StrProperty' || p.name === 'NameProperty');

/**
 * Liest einen Speicherstand.
 * @returns {{kopf: Buffer, eigenschaften: Array, schwanz: Buffer, engine: string, klasse: string}}
 */
export function leseStand(buf) {
  if (buf.toString('latin1', 0, 4) !== KENNUNG)
    throw new Error('Keine GVAS-Datei — die Kennung am Anfang fehlt.');

  const l = new Leser(buf, 4);
  l.int32(); // Fassung der Speicherdatei
  l.int32(); // Paketfassung UE4
  l.int32(); // Paketfassung UE5
  const major = buf.readUInt16LE(l.pos);
  const minor = buf.readUInt16LE(l.pos + 2);
  const patch = buf.readUInt16LE(l.pos + 4);
  l.ueberspringe(6);
  l.int32(); // Änderungsnummer
  const zweig = l.text();
  l.int32(); // Format der Zusatzfassungen
  const anzahlZusatz = l.int32();
  l.ueberspringe(anzahlZusatz * 20); // je Guid (16) + Fassung (4)
  const klasse = l.text();
  l.byte(); // Trennbyte hinter dem Klassennamen

  const kopf = buf.subarray(0, l.pos);
  const eigenschaften = [];

  for (;;) {
    const beginn = l.pos;
    const name = l.text();
    if (name === 'None' || name === '') {
      l.pos = beginn;
      break;
    }
    const typ = l.typname();
    const groesseBei = l.pos;
    const groesse = l.int32();
    // Merkmale der Eigenschaft (seit UE 5.4). Bit 0 zieht einen Feldindex nach sich,
    // Bit 1 eine eigene Guid; Bit 3 (Null-Wert) und Bit 4 (Bool ist wahr) stehen für
    // sich allein und bringen keine weiteren Bytes mit.
    const merkmale = l.byte();
    if (merkmale & 0b0001) l.ueberspringe(4);
    if (merkmale & 0b0010) l.ueberspringe(16);
    if (merkmale & 0b0100)
      throw new Error(`Eigenschaft „${name}" trägt unbekannte Erweiterungen (Merkmale ${merkmale}).`);
    const rumpfStart = l.pos;
    l.ueberspringe(groesse);
    if (l.pos > buf.length)
      throw new Error(`Eigenschaft „${name}" (${typ.name}) reicht über das Dateiende hinaus.`);

    const rumpf = buf.subarray(rumpfStart, l.pos);
    let karte = null;
    if (istTextKarte(typ)) {
      try {
        karte = leseKarteAusTexten(rumpf);
      } catch {
        karte = null;
      }
    }

    eigenschaften.push({
      name,
      typ: typ.name,
      typbaum: typ,
      groesse,
      roh: buf.subarray(beginn, l.pos),
      groesseBei: groesseBei - beginn, // Lage der Größenangabe innerhalb von `roh`
      rumpfBei: rumpfStart - beginn,
      karte,
      geaendert: false,
    });
  }

  return {
    kopf,
    eigenschaften,
    schwanz: buf.subarray(l.pos),
    engine: `${major}.${minor}.${patch} ${zweig}`,
    klasse,
  };
}

/**
 * Schreibt einen Speicherstand zurück. Eigenschaften ohne Änderung gehen roh hinaus;
 * geänderte Karten werden neu aufgebaut und ihre Größenangabe mitgezogen.
 */
export function schreibeStand(stand) {
  const teile = [stand.kopf];

  for (const e of stand.eigenschaften) {
    if (!e.geaendert) {
      teile.push(e.roh);
      continue;
    }
    if (!e.karte) throw new Error(`Eigenschaft „${e.name}" ist als geändert markiert, aber nicht schreibbar.`);

    const rumpf = schreibeKarteAusTexten(e.karte);
    const vorspann = Buffer.from(e.roh.subarray(0, e.rumpfBei));
    vorspann.writeInt32LE(rumpf.length, e.groesseBei);
    teile.push(vorspann, rumpf);
  }

  teile.push(stand.schwanz);
  return Buffer.concat(teile);
}

/** Sucht eine Eigenschaft nach Namen. */
export function finde(stand, name) {
  return stand.eigenschaften.find((e) => e.name === name) || null;
}
