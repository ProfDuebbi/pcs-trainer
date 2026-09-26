import { useState } from 'react';
import type { Person } from '../api';
import { Sektionskopf, zahl, type SeitenProps } from './gemeinsam';

const WERTE = [
  { feld: 'stufe', titel: 'Stufe' },
  { feld: 'punkte', titel: 'Punkte' },
  { feld: 'moral', titel: 'Moral' },
  { feld: 'kraft', titel: 'Kraft' },
  { feld: 'verstand', titel: 'Verstand' },
  { feld: 'auftreten', titel: 'Auftreten' },
] as const;

type Feld = (typeof WERTE)[number]['feld'];

export function Personal({ modell, entwurf, setEntwurf }: SeitenProps) {
  const [nurAngestellte, setNurAngestellte] = useState(true);
  const leute = modell.personal.filter((p) => (nurAngestellte ? p.angestellt : true));

  const entwurfFuer = (id: string) => entwurf.personal?.find((p) => p.id === id);

  const setzeWert = (person: Person, feld: Feld, wert: number | undefined) =>
    setEntwurf((e) => {
      const liste = [...(e.personal ?? [])];
      const i = liste.findIndex((p) => p.id === person.id);
      const bisher = i >= 0 ? { ...liste[i] } : { id: person.id };

      if (wert === undefined || wert === person[feld]) delete bisher[feld];
      else bisher[feld] = wert;

      // Bleibt außer der Kennung nichts übrig, fliegt der Eintrag wieder raus —
      // sonst zählt die Leiste unten Änderungen, die gar keine sind.
      const leer = Object.keys(bisher).length <= 1;
      if (i >= 0) {
        if (leer) liste.splice(i, 1);
        else liste[i] = bisher;
      } else if (!leer) liste.push(bisher);

      return { ...e, personal: liste };
    });

  const alleAuf = (feld: Feld, wert: number) =>
    leute.forEach((p) => setzeWert(p, feld, wert));

  return (
    <>
      <Sektionskopf
        titel="Personal"
        text="Stufe, Moral und die drei Eigenschaften jeder Person. Die Namen kommen aus dem Spielstand."
      />

      <section className="nx-panel">
        <div className="nx-panel-head">
          <h2>{leute.length} {leute.length === 1 ? 'Person' : 'Personen'}</h2>
          <p className="nx-panel-sub">
            {modell.personal.filter((p) => p.angestellt).length} angestellt,{' '}
            {modell.personal.filter((p) => !p.angestellt).length} zur Einstellung frei
          </p>
          <div className="nx-form-acts">
            <label className="tr-check">
              <input
                type="checkbox"
                checked={nurAngestellte}
                onChange={(e) => setNurAngestellte(e.target.checked)}
              />
              nur Angestellte
            </label>
            <button className="nx-btn nx-btn-sm" type="button" onClick={() => alleAuf('moral', 100)}>
              Moral auf 100
            </button>
          </div>
        </div>

        <div className="nx-tablewrap">
          <table className="nx-table tr-personal">
            <thead>
              <tr>
                <th>Person</th>
                <th>Rolle</th>
                {WERTE.map((w) => (
                  <th key={w.feld} className="nx-nowrap">{w.titel}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leute.map((p) => {
                const e = entwurfFuer(p.id);
                return (
                  <tr key={p.id} className={e ? 'tr-zeile-neu' : ''}>
                    <td>
                      <strong>{p.name}</strong>
                      <span className="nx-meta">
                        {p.beruf}{p.alter ? `, ${p.alter}` : ''}
                        {!p.angestellt && <span className="nx-badge"> Bewerbung</span>}
                        {p.tot && <span className="nx-badge nx-st-weg"> tot</span>}
                      </span>
                    </td>
                    <td className="nx-meta">{p.rolle || '—'}</td>
                    {WERTE.map((w) => {
                      const jetzt = p[w.feld];
                      if (jetzt === null)
                        return <td key={w.feld} className="nx-meta">—</td>;
                      const neu = e?.[w.feld];
                      return (
                        <td key={w.feld}>
                          <input
                            className="nx-input nx-mono tr-stufe"
                            type="number"
                            min={0}
                            value={neu ?? jetzt}
                            onChange={(ev) => {
                              const v = Number(ev.target.value);
                              setzeWert(p, w.feld, Number.isFinite(v) ? v : undefined);
                            }}
                            title={neu !== undefined ? `vorher ${zahl(jetzt)}` : undefined}
                          />
                        </td>
                      );
                    })}
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
