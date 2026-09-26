import type { Aenderungen, Modell, Regler } from '../api';

export type SeitenProps = {
  modell: Modell;
  entwurf: Aenderungen;
  setEntwurf: React.Dispatch<React.SetStateAction<Aenderungen>>;
  regler: Regler[];
};

/** Kopf einer Seite: Überschrift plus eine Zeile, die sagt, worum es geht. */
export function Sektionskopf({ titel, text }: { titel: string; text: string }) {
  return (
    <div className="nx-sechead tr-sechead">
      <h2>{titel}</h2>
      <p className="nx-panel-sub">{text}</p>
    </div>
  );
}

/**
 * Ein Zahlenfeld, das den geänderten Zustand sichtbar macht: solange ein Wert vom
 * gespeicherten abweicht, steht der alte daneben. Ohne das weiß man nach drei
 * Eingaben nicht mehr, was man eigentlich angefasst hat.
 */
export function Wertfeld({
  titel,
  einheit,
  gespeichert,
  entwurf,
  onAendern,
  art = 'zahl',
  min,
}: {
  titel: string;
  einheit?: string;
  gespeichert: number | string;
  entwurf: number | string | undefined;
  onAendern: (wert: number | string | undefined) => void;
  art?: 'zahl' | 'text';
  min?: number;
}) {
  const geaendert = entwurf !== undefined && String(entwurf) !== String(gespeichert);
  const wert = entwurf !== undefined ? entwurf : gespeichert;
  const id = `feld-${titel.replace(/\W+/g, '-').toLowerCase()}`;

  return (
    <div className={`nx-field tr-feld ${geaendert ? 'tr-feld-neu' : ''}`}>
      <label htmlFor={id}>
        {titel}
        {einheit && <span className="tr-einheit"> {einheit}</span>}
      </label>
      <input
        id={id}
        className="nx-input nx-mono"
        type={art === 'zahl' ? 'number' : 'text'}
        min={min}
        value={String(wert)}
        onChange={(e) => {
          const roh = e.target.value;
          const neu = art === 'zahl' ? (roh === '' ? '' : Number(roh)) : roh;
          // Zurück auf den gespeicherten Wert heißt: keine Änderung mehr.
          onAendern(String(neu) === String(gespeichert) ? undefined : neu);
        }}
      />
      {geaendert && (
        <small className="tr-vorher">
          vorher <b className="nx-mono">{String(gespeichert)}</b>
          <button className="nx-btn nx-btn-sm nx-btn-plain" type="button" onClick={() => onAendern(undefined)}>
            zurück
          </button>
        </small>
      )}
    </div>
  );
}

/** Zahl mit Tausenderpunkten — Beträge im Spiel werden schnell unlesbar. */
export const zahl = (n: number | string | null | undefined) =>
  typeof n === 'number' ? n.toLocaleString('de-DE') : (n ?? '—');
