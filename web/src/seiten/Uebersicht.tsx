import { Sektionskopf, Wertfeld, zahl, type SeitenProps } from './gemeinsam';

const GRUPPEN = [
  { titel: 'Kasse', text: 'Der Kontostand und die Tagesrechnung.', felder: ['geld', 'tagesEinnahmen', 'tagesKosten'] },
  { titel: 'Ansehen', text: 'Stufe, Punkte und der Rang, der daraus folgt.', felder: ['rufStufe', 'rufPunkte', 'rang'] },
  { titel: 'Dienststelle', text: 'Personalplätze, Lohnschulden und eigene Verstöße.', felder: ['personalPlaetze', 'lohnSchulden', 'verstoesse'] },
];

export function Uebersicht({ modell, entwurf, setEntwurf, regler }: SeitenProps) {
  const setzeWert = (feld: string, wert: number | string | undefined) =>
    setEntwurf((e) => {
      const werte = { ...(e.werte ?? {}) };
      if (wert === undefined) delete werte[feld];
      else werte[feld] = wert;
      return { ...e, werte };
    });

  return (
    <>
      <Sektionskopf
        titel="Geld & Ruf"
        text="Die Werte, die am meisten bewegen. Sie wirken, sobald du den Speicherstand im Spiel lädst."
      />

      <div className="nx-kpis tr-kpis">
        <div className="nx-kpi">
          <span className="nx-kicker">Kontostand</span>
          <strong className="nx-big nx-mono">{zahl(modell.werte.geld)} $</strong>
        </div>
        <div className="nx-kpi">
          <span className="nx-kicker">Ruf</span>
          <strong className="nx-big nx-mono">
            Stufe {zahl(modell.werte.rufStufe)}
          </strong>
          <span className="nx-meta">{modell.werte.rang} · {zahl(modell.werte.rufPunkte)} Punkte</span>
        </div>
        <div className="nx-kpi">
          <span className="nx-kicker">Personal</span>
          <strong className="nx-big nx-mono">
            {modell.personal.filter((p) => p.angestellt).length} / {zahl(modell.werte.personalPlaetze)}
          </strong>
          <span className="nx-meta">{modell.personal.filter((p) => !p.angestellt).length} zur Einstellung frei</span>
        </div>
      </div>

      {GRUPPEN.map((g) => (
        <section className="nx-panel" key={g.titel}>
          <div className="nx-panel-head">
            <h2>{g.titel}</h2>
            <p className="nx-panel-sub">{g.text}</p>
          </div>
          <div className="tr-felder">
            {g.felder.map((feld) => {
              const r = regler.find((x) => x.feld === feld);
              if (!r || !(feld in modell.werte)) return null;
              return (
                <Wertfeld
                  key={feld}
                  titel={r.titel}
                  einheit={r.einheit}
                  art={r.art}
                  min={r.min}
                  gespeichert={modell.werte[feld]}
                  entwurf={entwurf.werte?.[feld]}
                  onAendern={(w) => setzeWert(feld, w)}
                />
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}
