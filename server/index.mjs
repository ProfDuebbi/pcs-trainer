// Der lokale Helfer. Macht die Dateiarbeit; die Oberfläche im Browser redet nur mit ihm.
// Hört bewusst nur auf 127.0.0.1 — von außen ist hier nichts zu erreichen.

import express from 'express';
import { execFile } from 'node:child_process';
import {
  SPEICHERORDNER,
  listeStaende,
  oeffne,
  leseModell,
  wendeAn,
  sichereUndSpeichere,
  leseBlock,
  listeSicherungen,
  spieleZurueck,
  REGLER,
} from './stand.mjs';

const app = express();
app.use(express.json({ limit: '64mb' }));

const antwort = (res, fn) => {
  try {
    res.json({ ok: true, ...fn() });
  } catch (e) {
    res.status(400).json({ ok: false, fehler: e.message });
  }
};

/** Läuft das Spiel gerade? Dann überschreibt es beim nächsten Speichern alles. */
function spielLaeuft() {
  return new Promise((fertig) => {
    execFile(
      'tasklist',
      ['/FI', 'IMAGENAME eq PoliceChiefSimulator-Win64-Shipping.exe', '/NH'],
      { windowsHide: true },
      (fehler, aus) => fertig(!fehler && /PoliceChiefSimulator/i.test(aus || '')),
    );
  });
}

app.get('/api/lage', async (_req, res) => {
  res.json({
    ok: true,
    ordner: SPEICHERORDNER,
    spielLaeuft: await spielLaeuft(),
    staende: listeStaende(),
    regler: REGLER,
  });
});

app.get('/api/stand/:datei', (req, res) =>
  antwort(res, () => ({ modell: leseModell(oeffne(req.params.datei)) })),
);

app.get('/api/stand/:datei/block/:schluessel', (req, res) =>
  antwort(res, () => ({ text: leseBlock(oeffne(req.params.datei), req.params.schluessel) })),
);

app.post('/api/stand/:datei', async (req, res) => {
  if (await spielLaeuft())
    return res.status(409).json({
      ok: false,
      fehler:
        'Das Spiel läuft. Beende es erst — sonst überschreibt es die Datei beim nächsten Speichern und die Änderung ist weg.',
    });
  antwort(res, () => {
    const akte = oeffne(req.params.datei);
    const angefasst = wendeAn(akte, req.body ?? {});
    const ergebnis = sichereUndSpeichere(akte);
    return { angefasst, ...ergebnis, modell: leseModell(oeffne(req.params.datei)) };
  });
});

app.get('/api/sicherungen', (_req, res) => antwort(res, () => ({ sicherungen: listeSicherungen() })));

app.post('/api/sicherungen/zurueck', async (req, res) => {
  if (await spielLaeuft())
    return res.status(409).json({ ok: false, fehler: 'Das Spiel läuft — bitte erst beenden.' });
  antwort(res, () => ({ ziel: spieleZurueck(req.body?.datei ?? '') }));
});

const PORT = Number(process.env.PORT ?? 8791);
app.listen(PORT, '127.0.0.1', () => {
  console.log(`Helfer läuft auf http://127.0.0.1:${PORT}`);
  console.log(`Speicherstände: ${SPEICHERORDNER}`);
});
