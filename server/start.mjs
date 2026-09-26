// Startet Helfer und Oberfläche zusammen und öffnet den Browser.
// Gedacht für den Alltag: `npm start` und fertig.

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const WURZEL = path.join(HIER, '..');
const ADRESSE = 'http://localhost:5183';

const kinder = [];

/**
 * Beide Teile laufen als Node-Skript, gestartet mit genau der Node-Ausgabe, die
 * auch dieses Skript ausfuehrt. Damit faellt die Shell weg — und mit ihr zwei
 * Fallstricke unter Windows: sie zerlegt einen Pfad wie
 * `C:\Program Files\nodejs\node.exe` am Leerzeichen, und ohne sie verweigert
 * Node seit Fassung 20 das Starten von `.cmd`-Dateien (`EINVAL`), also auch
 * von `npm.cmd`.
 */
function starte(name, skript, argumente, ordner) {
  const k = spawn(process.execPath, [skript, ...argumente], {
    cwd: ordner,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const zeigen = (strom, quelle) =>
    strom.on('data', (d) =>
      String(d)
        .split('\n')
        .filter(Boolean)
        .forEach((z) => console.log(`[${name}] ${quelle}${z}`)),
    );
  zeigen(k.stdout, '');
  zeigen(k.stderr, '');
  k.on('exit', (code) => {
    if (code !== 0 && !beendet) {
      console.error(`\n[${name}] ist mit Code ${code} ausgestiegen — ich beende auch den Rest.`);
      aufraeumen();
    }
  });
  kinder.push(k);
  return k;
}

let beendet = false;
function aufraeumen() {
  if (beendet) return;
  beendet = true;
  for (const k of kinder) k.kill();
  process.exit(0);
}
process.on('SIGINT', aufraeumen);
process.on('SIGTERM', aufraeumen);

console.log('Trainer für Police Chief Simulator\n');
const WEB = path.join(WURZEL, 'web');
starte('Helfer', path.join(HIER, 'index.mjs'), [], WURZEL);
starte('Oberfläche', path.join(WEB, 'node_modules', 'vite', 'bin', 'vite.js'), [], WEB);

// Der Vite-Start braucht einen Moment, bevor die Adresse antwortet.
setTimeout(() => {
  console.log(`\n→ ${ADRESSE}\n`);
  const oeffner =
    process.platform === 'win32'
      ? ['cmd', ['/c', 'start', '', ADRESSE]]
      : process.platform === 'darwin'
        ? ['open', [ADRESSE]]
        : ['xdg-open', [ADRESSE]];
  spawn(oeffner[0], oeffner[1], { detached: true, stdio: 'ignore' }).unref();
}, 2500);
