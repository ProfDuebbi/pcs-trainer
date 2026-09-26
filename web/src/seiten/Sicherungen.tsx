import { useCallback, useEffect, useState } from 'react';
import { api, type Sicherung } from '../api';
import { Icon } from '../Icon';
import { Sektionskopf, zahl } from './gemeinsam';

export function Sicherungen({
  onZurueckgespielt,
  melde,
}: {
  onZurueckgespielt: () => void;
  melde: (m: { art: 'ok' | 'fehler'; text: string }) => void;
}) {
  const [liste, setListe] = useState<Sicherung[]>([]);
  const [laedt, setLaedt] = useState(false);

  const laden = useCallback(async () => {
    setLaedt(true);
    try {
      setListe((await api.sicherungen()).sicherungen);
    } catch (e) {
      melde({ art: 'fehler', text: (e as Error).message });
    } finally {
      setLaedt(false);
    }
  }, [melde]);

  useEffect(() => {
    void laden();
  }, [laden]);

  async function zurueck(s: Sicherung) {
    if (
      !confirm(
        `„${s.ziel}" auf den Stand von ${new Date(s.erstellt).toLocaleString('de-DE')} zurücksetzen?\n\n` +
          'Der jetzige Zustand wird vorher noch einmal gesichert.',
      )
    )
      return;
    try {
      const a = await api.zurueck(s.datei);
      melde({ art: 'ok', text: `„${a.ziel}" wurde zurückgespielt.` });
      onZurueckgespielt();
      void laden();
    } catch (e) {
      melde({ art: 'fehler', text: (e as Error).message });
    }
  }

  return (
    <>
      <Sektionskopf
        titel="Sicherungen"
        text="Vor jedem Schreiben legt der Trainer eine Kopie an. Keine wird je überschrieben."
      />

      <section className="nx-panel">
        <div className="nx-panel-head">
          <h2>{liste.length} {liste.length === 1 ? 'Sicherung' : 'Sicherungen'}</h2>
          <div className="nx-form-acts">
            <button className="nx-btn nx-btn-sm" type="button" onClick={laden} disabled={laedt}>
              <Icon name="sicherung" /> Neu laden
            </button>
          </div>
        </div>

        {!liste.length ? (
          <div className="nx-empty">
            <Icon name="sicherung" size={28} />
            <p>Noch nichts gesichert — es wurde ja auch noch nichts geschrieben.</p>
          </div>
        ) : (
          <div className="nx-tablewrap">
            <table className="nx-table">
              <thead>
                <tr>
                  <th>Speicherstand</th>
                  <th>Gesichert am</th>
                  <th className="nx-nowrap">Größe</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {liste.map((s) => (
                  <tr key={s.datei}>
                    <td><strong>{s.ziel}</strong></td>
                    <td className="nx-mono">{new Date(s.erstellt).toLocaleString('de-DE')}</td>
                    <td className="nx-mono">{zahl(Math.round(s.groesse / 1024))} kB</td>
                    <td>
                      <button className="nx-btn nx-btn-sm" type="button" onClick={() => zurueck(s)}>
                        <Icon name="zurueck" /> Zurückspielen
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
