// ============================================================================
// LICK COMPENDIUM — types + loader
// ============================================================================
// Data source: the Weimar Jazz Database (WJD), Jazzomat Research Project,
// Hochschule fuer Musik FRANZ LISZT Weimar (https://jazzomat.hfm-weimar.de),
// released under the Open Data Commons Open Database License (ODbL) v1.0.
// Each lick is a short (2-bar) excerpt of a real, note-level melodic
// transcription, aligned to the real chord changes of the tune it's drawn
// from, with the source performer/tune/bar location preserved for citation.
//
// Citation: Pfleiderer, M., Frieler, K., Abesser, J., Zaddach, W.-G.,
// Burkhart, B. (Eds.) (2017). Inside the Jazzomat - New Perspectives for
// Jazz Research. Schott Campus.
// ============================================================================

export interface VexFlowNoteSpec {
  /** VexFlow key strings, e.g. ["c#/5"]. Absent for rests. */
  keys?: string[];
  /** VexFlow duration code: "16","8","8d","q","qd","h","hd","w", etc. */
  duration: string;
  /** MIDI pitch number, for audio playback. Absent for rests. */
  midi?: number;
  /** True if this entry is a rest rather than a sounding note. */
  rest?: boolean;
  /** Bar index (0-based) relative to the start of this lick. Used to group
   *  and beam notes measure-by-measure when rendering notation. */
  bar: number;
}

export interface Lick {
  id: string;
  /** Human-readable name, e.g. "Charlie Parker Lick #12". */
  label: string;
  /** How this excerpt was selected, e.g. "ii-V-I over A2" or "Phrase over B1". */
  contextLabel: string;
  selectionMethod: "harmony" | "phrase";
  performer: string;
  style: string;
  sourceTune: string;
  sourceKey: string;
  sourceTempo: number | null;
  barStart: number;
  barCount: number;
  /** The real chord(s) this excerpt was played over, in order. */
  chordContext: string[];
  /** Whether the source tune's key prefers flat spelling. */
  preferFlats: boolean;
  notes: VexFlowNoteSpec[];
}

export interface LickCompendium {
  meta: {
    source: string;
    sourceUrl: string;
    license: string;
    attribution: string;
    citation: string;
    generatedLickCount: number;
  };
  licks: Lick[];
}

// The bundler is expected to support JSON imports (Create React App, Vite,
// Next.js all do by default). If your setup doesn't, rename licks.json to
// licks.ts and prefix with `export default`.
import licksData from "./licks.json";

export const LICK_COMPENDIUM = licksData as unknown as LickCompendium;
export const ALL_LICKS: Lick[] = LICK_COMPENDIUM.licks;

export const LICK_PERFORMERS: string[] = Array.from(
  new Set(ALL_LICKS.map((l) => l.performer)),
).sort();

export function licksByPerformer(performer: string): Lick[] {
  return ALL_LICKS.filter((l) => l.performer === performer);
}
