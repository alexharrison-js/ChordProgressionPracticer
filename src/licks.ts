// ============================================================================
// LICK COMPENDIUM — types + loader
// ============================================================================
// Data source: the Weimar Jazz Database (WJD), Jazzomat Research Project,
// Hochschule fuer Musik FRANZ LISZT Weimar (https://jazzomat.hfm-weimar.de),
// released under the Open Data Commons Open Database License (ODbL) v1.0.
// ============================================================================

export interface VexFlowNoteSpec {
  keys?: string[];
  duration: string;
  midi?: number;
  rest?: boolean;
}

export interface Lick {
  id: string;
  label: string;
  performer: string;
  style: string;
  sourceTune: string;
  sourceKey: string;
  sourceTempo: number | null;
  barStart: number;
  barCount: number;
  chordContext: string[];
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

import licksDataRaw from "./licks_raw.json";

// 1. Cast the raw imported JSON to an array of any
const rawArray = licksDataRaw as any[];

// 2. Map over the array to inject the missing 'label' property
export const ALL_LICKS: Lick[] = rawArray.map((rawLick, index) => {
  return {
    ...rawLick,
    // Dynamically generate the label since it's missing in licks_raw.json
    label: `${rawLick.performer} Lick #${index + 1}`,
  } as Lick;
});

// 3. Reconstruct the Compendium wrapper so UI imports don't break
export const LICK_COMPENDIUM: LickCompendium = {
  meta: {
    source: "Weimar Jazz Database (WJD), Jazzomat Research Project",
    sourceUrl: "https://jazzomat.hfm-weimar.de",
    license: "Open Data Commons Open Database License (ODbL) v1.0",
    attribution:
      "Melodic data derived from note-level transcriptions in the Weimar Jazz Database.",
    citation:
      "Pfleiderer, M., Frieler, K., Abesser, J., Zaddach, W.-G., Burkhart, B. (Eds.) (2017). Inside the Jazzomat.",
    generatedLickCount: ALL_LICKS.length,
  },
  licks: ALL_LICKS,
};

export const LICK_PERFORMERS: string[] = Array.from(
  new Set(ALL_LICKS.map((l) => l.performer)),
).sort();

export function licksByPerformer(performer: string): Lick[] {
  return ALL_LICKS.filter((l) => l.performer === performer);
}
