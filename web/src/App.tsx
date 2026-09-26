import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, type Aenderungen, type Lage, type Modell } from './api';
import { Icon } from './Icon';
import { Uebersicht } from './seiten/Uebersicht';
import { Ausbau } from './seiten/Ausbau';
import { Personal } from './seiten/Personal';
import { Roh } from './seiten/Roh';
import { Sicherungen } from './seiten/Sicherungen';

const SEITEN = [
  { id: 'uebersicht', titel: 'Geld & Ruf', icon: 'geld' },
  { id: 'ausbau', titel: 'Ausbau', icon: 'ausbau' },
  { id: 'personal', titel: 'Personal', icon: 'personal' },
  { id: 'roh', titel: 'Roh-Ansicht', icon: 'roh' },
  { id: 'sicherungen', titel: 'Sicherungen', icon: 'sicherung' },
] as const;

type SeitenId = (typeof SEITEN)[number]['id'];

/** Zählt, wie viele echte Änderungen im Entwurf stehen. */
function zaehleAenderungen(e: Aenderungen) {
  return (
    Object.keys(e.werte ?? {}).length +
    Object.keys(e.ausbau ?? {}).length +
    (e.personal?.length ?? 0) +
    Object.keys(e.roh ?? {}).length
  );
}

export default function App() {
  const [lage, setLage] = useState<Lage | null>(null);
  const [datei, setDatei] = useState<string>('');
  const [modell, setModell] = useState<Modell | null>(null);
  const [seite, setSeite] = useState<SeitenId>('uebersicht');
  const [entwurf, setEntwurf] = useState<Aenderungen>({});
  const [meldung, setMeldung] = useState<{ art: 'ok' | 'fehler'; text: string } | null>(null);
  const [laedt, setLaedt] = useState(false);
  const [eingeklappt, setEingeklappt] = useState(false);

  const offen = zaehleAenderungen(entwurf);

  const ladeLage = useCallback(async () => {
    try {
      const l = await api.lage();
      setLage(l);
      setDatei((d) => d || l.staende[0]?.datei || '');
    } catch (e) {
      setMeldung({ art: 'fehler', text: (e as Error).message });
    }
  }, []);

  useEffect(() => {
    void ladeLage();
  }, [ladeLage]);

  // Beim Wechsel des Speicherstands alles neu laden und den Entwurf wegwerfen.
  useEffect(() => {
    if (!datei) return;
    setLaedt(true);
    setEntwurf({});
    api
      .stand(datei)
      .then((a) => setModell(a.modell))
      .catch((e) => setMeldung({ art: 'fehler', text: (e as Error).message }))
      .finally(() => setLaedt(false));
  }, [datei]);

  // Versehentliches Schließen mit offenen Änderungen abfangen.
  useEffect(() => {
    if (!offen) return;
    const warnen = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warnen);
    return () => window.removeEventListener('beforeunload', warnen);
  }, [offen]);

  async function speichern() {
    if (!datei || !offen) return;
    setLaedt(true);
    try {
      const a = await api.speichern(datei, entwurf);
      setModell(a.modell);
      setEntwurf({});
      setMeldung({
        art: 'ok',
        text: `Gespeichert: ${a.angefasst.join(' · ')}. Sicherung liegt unter „${a.sicherung}".`,
      });
      void ladeLage();
    } catch (e) {
      setMeldung({ art: 'fehler', text: (e as Error).message });
    } finally {
      setLaedt(false);
    }
  }

  const seitenInhalt = useMemo(() => {
    if (!modell) return null;
    const gemeinsam = { modell, entwurf, setEntwurf, regler: lage?.regler ?? [] };
    switch (seite) {
      case 'uebersicht':
        return <Uebersicht {...gemeinsam} />;
      case 'ausbau':
        return <Ausbau {...gemeinsam} />;
      case 'personal':
        return <Personal {...gemeinsam} />;
      case 'roh':
        return <Roh {...gemeinsam} datei={modell.datei} />;
      case 'sicherungen':
        return <Sicherungen onZurueckgespielt={() => setDatei((d) => d)} melde={setMeldung} />;
    }
  }, [seite, modell, entwurf, lage]);

  return (
    <div className="nx nx-app">
      <div className="nx-glow" aria-hidden="true" />

      <header className="nx-top">
        <div className="nx-top-left">
          <span className="nx-brand" style={{ cursor: 'default' }}>
            <span className="tr-marke"><Icon name="schild" size={20} /></span>
            <span className="nx-brand-text">Trainer</span>
          </span>
          <span className="nx-kicker tr-untertitel">Police Chief Simulator</span>
        </div>

        <div className="tr-standwahl">
          <label className="nx-kicker" htmlFor="stand">Speicherstand</label>
          <select
            id="stand"
            className="nx-select"
            value={datei}
            onChange={(e) => {
              if (offen && !confirm('Es gibt ungespeicherte Änderungen. Wirklich wechseln?')) return;
              setDatei(e.target.value);
            }}
          >
            {lage?.staende.map((s) => (
              <option key={s.datei} value={s.datei}>
                {s.datei} — {new Date(s.geaendert).toLocaleString('de-DE')}
              </option>
            ))}
          </select>
        </div>

        <div className="nx-top-right">
          <span className="nx-status" style={{ '--st': lage?.spielLaeuft ? 'var(--warn)' : 'var(--ok)' } as never}>
            {lage?.spielLaeuft ? 'Spiel läuft' : 'Spiel aus'}
          </span>
        </div>
      </header>

      <div className={`nx-body ${eingeklappt ? 'is-narrow' : ''}`}>
        <nav className="nx-rail" aria-label="Bereiche">
          <div className="nx-rail-head">
            <span className="nx-rail-sec">Bereiche</span>
            <button
              className="nx-rail-toggle"
              onClick={() => setEingeklappt((v) => !v)}
              type="button"
              aria-expanded={!eingeklappt}
              title={eingeklappt ? 'Menü ausklappen' : 'Menü einklappen'}
            >
              {eingeklappt ? '»' : '«'}
            </button>
          </div>
          {SEITEN.map((s) => (
            <button
              key={s.id}
              className={`nx-rail-item ${seite === s.id ? 'nx-rail-on' : ''}`}
              onClick={() => setSeite(s.id)}
              type="button"
              title={s.titel}
            >
              <Icon name={s.icon} />
              <span>{s.titel}</span>
            </button>
          ))}
        </nav>

        <main className="nx-content" id="inhalt">
          <div className="nx-wrap">
            {lage?.spielLaeuft && (
              <div className="nx-note nx-note-bad tr-warnung">
                <Icon name="warnung" />
                <div>
                  <strong>Das Spiel läuft gerade.</strong> Speichern ist gesperrt — sonst schreibt
                  das Spiel beim nächsten Autosave deine Änderungen einfach wieder weg. Beende es
                  erst.
                </div>
              </div>
            )}

            {meldung && (
              <div className={`nx-note ${meldung.art === 'fehler' ? 'nx-note-bad' : ''} tr-meldung`}>
                <span>{meldung.text}</span>
                <button
                  className="nx-btn nx-btn-sm nx-btn-plain"
                  onClick={() => setMeldung(null)}
                  type="button"
                >
                  Schließen
                </button>
              </div>
            )}

            {laedt && !modell && <p className="nx-lead">Speicherstand wird gelesen …</p>}
            {seitenInhalt}
          </div>
        </main>
      </div>

      {offen > 0 && (
        <div className="tr-leiste">
          <span className="nx-kicker">
            {offen} {offen === 1 ? 'Änderung' : 'Änderungen'} noch nicht geschrieben
          </span>
          <div className="tr-leiste-acts">
            <button className="nx-btn nx-btn-plain" onClick={() => setEntwurf({})} type="button">
              Verwerfen
            </button>
            <button
              className="nx-btn nx-btn-accent"
              onClick={speichern}
              disabled={laedt || lage?.spielLaeuft}
              type="button"
              title={lage?.spielLaeuft ? 'Erst das Spiel beenden' : undefined}
            >
              <Icon name="speichern" />
              In den Speicherstand schreiben
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
