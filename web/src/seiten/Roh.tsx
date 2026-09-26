import { useEffect, useState } from 'react';
import { api } from '../api';
import { Icon } from '../Icon';
import { Sektionskopf, zahl, type SeitenProps } from './gemeinsam';

/**
 * Das Sicherheitsnetz: jeder JSON-Block des Speicherstands im Klartext.
 * Was hier steht, hat keinen eigenen Regler — dafür aber auch keine Prüfung
 * außer „ist es gültiges JSON".
 */
export function Roh({ modell, entwurf, setEntwurf, datei }: SeitenProps & { datei: string }) {
  const [gewaehlt, setGewaehlt] = useState<string>('');
  const [text, setText] = useState('');
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [suche, setSuche] = useState('');

  // Nach Namen sortiert, nicht in der Reihenfolge der Speicherdatei — sonst
  // haengen die sechs Komponenten-Bloecke hinter 41 Subsystemen am Listenende.
  const bloecke = modell.bloecke
    .filter((b) => b.schluessel.toLowerCase().includes(suche.toLowerCase()))
    .sort((a, b) => a.schluessel.localeCompare(b.schluessel));

  useEffect(() => {
    if (!gewaehlt) return;
    // Ein bereits bearbeiteter Block kommt aus dem Entwurf, nicht neu vom Helfer —
    // sonst wäre die angefangene Änderung beim Hin- und Herklicken weg.
    const offen = entwurf.roh?.[gewaehlt];
    if (offen !== undefined) {
      setText(offen);
      return;
    }
    setLaedt(true);
    api
      .block(datei, gewaehlt)
      .then((a) => setText(a.text))
      .catch((e) => setFehler((e as Error).message))
      .finally(() => setLaedt(false));
  }, [gewaehlt, datei]);

  const pruefen = (wert: string) => {
    try {
      JSON.parse(wert);
      setFehler(null);
      return true;
    } catch (e) {
      setFehler((e as Error).message);
      return false;
    }
  };

  const uebernehmen = () => {
    if (!pruefen(text)) return;
    setEntwurf((e) => ({ ...e, roh: { ...(e.roh ?? {}), [gewaehlt]: text } }));
  };

  const verwerfen = () =>
    setEntwurf((e) => {
      const roh = { ...(e.roh ?? {}) };
      delete roh[gewaehlt];
      return { ...e, roh };
    });

  return (
    <>
      <Sektionskopf
        titel="Roh-Ansicht"
        text="Alle Blöcke des Speicherstands im Klartext. Für alles, wofür es noch keinen Regler gibt."
      />

      <div className="tr-roh">
        <aside className="nx-panel tr-roh-liste">
          <input
            className="nx-input"
            placeholder="Block suchen …"
            value={suche}
            onChange={(e) => setSuche(e.target.value)}
          />
          <div className="tr-bloecke">
            {bloecke.map((b) => {
              const bearbeitet = entwurf.roh?.[b.schluessel] !== undefined;
              return (
                <button
                  key={b.schluessel}
                  className={`tr-block ${gewaehlt === b.schluessel ? 'tr-block-an' : ''}`}
                  onClick={() => setGewaehlt(b.schluessel)}
                  type="button"
                >
                  <span className="tr-roh-name">{b.schluessel}</span>
                  <span className="tr-block-mass nx-mono">
                    {bearbeitet && <i className="tr-punkt" title="geändert" />}
                    {zahl(b.groesse)}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="nx-panel tr-roh-editor">
          {!gewaehlt ? (
            <div className="nx-empty">
              <Icon name="roh" size={28} />
              <p>Wähle links einen Block.</p>
            </div>
          ) : (
            <>
              <div className="nx-panel-head">
                <h2 className="nx-mono">{gewaehlt}</h2>
                <p className="nx-panel-sub">
                  {modell.bloecke.find((b) => b.schluessel === gewaehlt)?.kartenName}
                  {entwurf.roh?.[gewaehlt] !== undefined && ' · geändert'}
                </p>
              </div>

              {fehler && (
                <div className="nx-note nx-note-bad">
                  <Icon name="warnung" /> Kein gültiges JSON: {fehler}
                </div>
              )}

              <textarea
                className="nx-textarea nx-mono tr-roh-text"
                value={laedt ? 'wird gelesen …' : text}
                spellCheck={false}
                onChange={(e) => {
                  setText(e.target.value);
                  pruefen(e.target.value);
                }}
              />

              <div className="nx-form-acts">
                <button className="nx-btn nx-btn-accent" type="button" onClick={uebernehmen} disabled={!!fehler}>
                  Änderung übernehmen
                </button>
                {entwurf.roh?.[gewaehlt] !== undefined && (
                  <button className="nx-btn nx-btn-plain" type="button" onClick={verwerfen}>
                    Diesen Block zurücksetzen
                  </button>
                )}
              </div>
              <p className="nx-meta">
                „Übernehmen" legt die Änderung nur bereit — geschrieben wird sie erst mit dem Knopf
                unten in der Leiste.
              </p>
            </>
          )}
        </section>
      </div>
    </>
  );
}
