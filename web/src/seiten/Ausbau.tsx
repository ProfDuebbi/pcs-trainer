import { Icon } from '../Icon';
import { Sektionskopf, type SeitenProps } from './gemeinsam';

// Die Schlüssel im Speicherstand sind englisch und knapp. Was nicht hier steht,
// wird unverändert gezeigt — lieber ein roher Name als ein falscher.
const NAMEN: Record<string, string> = {
  policeStation: 'Revier',
  detective_A: 'Ermittlung',
  firstHall: 'Vorhalle',
  registration: 'Anmeldung',
  mainHall: 'Haupthalle',
  lockers: 'Umkleide',
  circuit: 'Stromkreis',
  cells_A: 'Zellentrakt',
  briefing: 'Besprechung',
  sheriff: 'Büro',
  armory: 'Waffenkammer',
  garage: 'Garage',
};

export function Ausbau({ modell, entwurf, setEntwurf }: SeitenProps) {
  const bereiche = Object.keys(modell.ausbau);

  const setzeStufe = (bereich: string, stufe: number | undefined) =>
    setEntwurf((e) => {
      const ausbau = { ...(e.ausbau ?? {}) };
      if (stufe === undefined) delete ausbau[bereich];
      else ausbau[bereich] = stufe;
      return { ...e, ausbau };
    });

  const alleAuf = (stufe: number) =>
    setEntwurf((e) => ({
      ...e,
      ausbau: Object.fromEntries(
        bereiche.filter((b) => modell.ausbau[b] !== stufe).map((b) => [b, stufe]),
      ),
    }));

  return (
    <>
      <Sektionskopf
        titel="Ausbau"
        text="Die Ausbaustufe jedes Bereichs im Revier. Die Werte stehen im Block BC_UpgradeManager_C."
      />

      <div className="nx-note tr-warnung">
        <Icon name="warnung" />
        <div>
          <strong>Die Höchststufen kenne ich nicht.</strong> Sie stehen in den Spieldaten, nicht im
          Speicherstand. Eine Stufe, die es gar nicht gibt, kann das Spiel stillschweigend ignorieren
          oder beim Laden stolpern lassen. Geh lieber schrittweise hoch und prüf im Spiel nach —
          zurück kommst du über die Sicherungen jederzeit.
        </div>
      </div>

      <section className="nx-panel">
        <div className="nx-panel-head">
          <h2>Alle Bereiche</h2>
          <p className="nx-panel-sub">{bereiche.length} Bereiche in diesem Stand</p>
          <div className="nx-form-acts">
            {[1, 2, 3].map((s) => (
              <button key={s} className="nx-btn nx-btn-sm" type="button" onClick={() => alleAuf(s)}>
                alle auf {s}
              </button>
            ))}
          </div>
        </div>

        <div className="nx-tablewrap">
          <table className="nx-table">
            <thead>
              <tr>
                <th>Bereich</th>
                <th>Schlüssel</th>
                <th className="nx-nowrap">Jetzt</th>
                <th className="nx-nowrap">Neu</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {bereiche.map((b) => {
                const jetzt = modell.ausbau[b];
                const neu = entwurf.ausbau?.[b];
                const geaendert = neu !== undefined && neu !== jetzt;
                return (
                  <tr key={b} className={geaendert ? 'tr-zeile-neu' : ''}>
                    <td><strong>{NAMEN[b] ?? b}</strong></td>
                    <td className="nx-mono nx-meta">{b}</td>
                    <td className="nx-mono">{jetzt}</td>
                    <td>
                      <input
                        className="nx-input nx-mono tr-stufe"
                        type="number"
                        min={0}
                        value={neu ?? jetzt}
                        onChange={(e) => {
                          const w = Number(e.target.value);
                          setzeStufe(b, Number.isFinite(w) && w !== jetzt ? w : undefined);
                        }}
                      />
                    </td>
                    <td>
                      {geaendert && (
                        <button
                          className="nx-btn nx-btn-sm nx-btn-plain"
                          type="button"
                          onClick={() => setzeStufe(b, undefined)}
                        >
                          zurück
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
