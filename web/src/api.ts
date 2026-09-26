// Alles, was der Browser vom lokalen Helfer will.

export type Regler = {
  feld: string;
  block: string;
  pfad: string;
  titel: string;
  art: 'zahl' | 'text';
  min?: number;
  einheit?: string;
};

export type Person = {
  id: string;
  angestellt: boolean;
  name: string;
  beruf: string;
  alter: number | null;
  rolle: string;
  stufe: number | null;
  punkte: number | null;
  moral: number | null;
  kraft: number | null;
  verstand: number | null;
  auftreten: number | null;
  tot: boolean;
};

export type Modell = {
  datei: string;
  engine: string;
  werte: Record<string, number | string>;
  fehlend: string[];
  ausbau: Record<string, number>;
  personal: Person[];
  bloecke: { schluessel: string; kartenName: string; groesse: number }[];
};

export type Stand = { datei: string; groesse: number; geaendert: string };

export type Lage = {
  ordner: string;
  spielLaeuft: boolean;
  staende: Stand[];
  regler: Regler[];
};

export type Sicherung = { datei: string; ziel: string; groesse: number; erstellt: string };

export type Aenderungen = {
  werte?: Record<string, number | string>;
  ausbau?: Record<string, number>;
  personal?: Partial<Person>[];
  roh?: Record<string, string>;
};

async function hole<T>(pfad: string, optionen?: RequestInit): Promise<T> {
  const antwort = await fetch(pfad, {
    ...optionen,
    headers: optionen?.body ? { 'Content-Type': 'application/json' } : undefined,
  });
  const daten = await antwort.json().catch(() => ({ fehler: 'Der Helfer antwortet nicht verständlich.' }));
  if (!antwort.ok || !daten.ok) throw new Error(daten.fehler ?? `Fehler ${antwort.status}`);
  return daten as T;
}

export const api = {
  lage: () => hole<Lage & { ok: true }>('/api/lage'),

  stand: (datei: string) => hole<{ modell: Modell }>(`/api/stand/${encodeURIComponent(datei)}`),

  block: (datei: string, schluessel: string) =>
    hole<{ text: string }>(`/api/stand/${encodeURIComponent(datei)}/block/${encodeURIComponent(schluessel)}`),

  speichern: (datei: string, aenderungen: Aenderungen) =>
    hole<{ angefasst: string[]; gespeichert: boolean; sicherung: string | null; modell: Modell }>(
      `/api/stand/${encodeURIComponent(datei)}`,
      { method: 'POST', body: JSON.stringify(aenderungen) },
    ),

  sicherungen: () => hole<{ sicherungen: Sicherung[] }>('/api/sicherungen'),

  zurueck: (datei: string) =>
    hole<{ ziel: string }>('/api/sicherungen/zurueck', {
      method: 'POST',
      body: JSON.stringify({ datei }),
    }),
};
