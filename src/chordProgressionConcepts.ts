// ============================================================================
// CHORD PROGRESSION CONCEPTS + CYCLE SEQUENCER
// ============================================================================
// A "concept" is a short chord cell defined relative to a key center (e.g.
// ii-V-I = degrees at +2, +7, +0 semitones from the root). A "cycle type"
// determines how the key center moves each time the cell finishes repeating.
// Combining the two produces an endless practice stream: e.g. {ii-7, V7}
// cycled by circle-of-4ths produces D-7 G7 | G-7 C7 | C-7 F7 | ... forever.
// ============================================================================

import { FlatChord, spellSemitone } from "./musicEngine";

export interface ChordCellDegree {
  /** Semitones above the key center (0 = root of the key). */
  rootOffset: number;
  /** Quality string matching musicEngine's QUALITY_INTERVALS keys. */
  quality: string;
  /** Beats this chord occupies within its bar. Defaults to 4 (one bar). */
  beats?: number;
}

export interface ChordProgressionConcept {
  id: string;
  name: string;
  shortLabel: string;
  description: string;
  degrees: ChordCellDegree[];
}

// 24 common progression cells. Roman-numeral offsets are in semitones from
// the key center: ii=+2, iii=+4, IV=+5, V=+7, vi=+9, bVII=+10, bII(subV)=+1,
// bIII=+3, bVI=+8.
export const CHORD_PROGRESSION_CONCEPTS: ChordProgressionConcept[] = [
  {
    id: "V-I",
    name: "V-I (Cadence)",
    shortLabel: "5-1",
    description: "The basic dominant-to-tonic cadence.",
    degrees: [
      { rootOffset: 7, quality: "7" },
      { rootOffset: 0, quality: "maj7" },
    ],
  },
  {
    id: "ii-V",
    name: "ii-V (Major)",
    shortLabel: "2-5",
    description: "The core major ii-V cell, unresolved.",
    degrees: [
      { rootOffset: 2, quality: "-7" },
      { rootOffset: 7, quality: "7" },
    ],
  },
  {
    id: "ii-V-I",
    name: "ii-V-I (Major)",
    shortLabel: "2-5-1",
    description: "The most common cadential cell in jazz.",
    degrees: [
      { rootOffset: 2, quality: "-7" },
      { rootOffset: 7, quality: "7" },
      { rootOffset: 0, quality: "maj7" },
    ],
  },
  {
    id: "ii-V-minor",
    name: "ii-V (Minor)",
    shortLabel: "2-5 minor",
    description: "Half-diminished ii to altered/b9 V, unresolved.",
    degrees: [
      { rootOffset: 2, quality: "-7b5" },
      { rootOffset: 7, quality: "7b9" },
    ],
  },
  {
    id: "ii-V-i-minor",
    name: "ii-V-i (Minor)",
    shortLabel: "2-5-1 minor",
    description: "Full minor cadence resolving to a minor 7 tonic.",
    degrees: [
      { rootOffset: 2, quality: "-7b5" },
      { rootOffset: 7, quality: "7b9" },
      { rootOffset: 0, quality: "-7" },
    ],
  },
  {
    id: "ii-V-i-minor6",
    name: "ii-V-i (Minor, resolving to m6)",
    shortLabel: "2-5-1 (m6)",
    description: "Minor cadence resolving to the classic minor 6 tonic sound.",
    degrees: [
      { rootOffset: 2, quality: "-7b5" },
      { rootOffset: 7, quality: "7b9" },
      { rootOffset: 0, quality: "-6" },
    ],
  },
  {
    id: "iii-VI-ii-V",
    name: "iii-VI-ii-V",
    shortLabel: "3-6-2-5",
    description: "Extended turnaround cell, unresolved.",
    degrees: [
      { rootOffset: 4, quality: "-7" },
      { rootOffset: 9, quality: "7" },
      { rootOffset: 2, quality: "-7" },
      { rootOffset: 7, quality: "7" },
    ],
  },
  {
    id: "iii-VI-ii-V-I",
    name: "iii-VI-ii-V-I",
    shortLabel: "3-6-2-5-1",
    description: "Full extended turnaround resolving to the tonic.",
    degrees: [
      { rootOffset: 4, quality: "-7" },
      { rootOffset: 9, quality: "7" },
      { rootOffset: 2, quality: "-7" },
      { rootOffset: 7, quality: "7" },
      { rootOffset: 0, quality: "maj7" },
    ],
  },
  {
    id: "I-vi-ii-V",
    name: "I-vi-ii-V (Diatonic Turnaround)",
    shortLabel: "1-6-2-5",
    description: 'The classic diatonic "rhythm changes" turnaround.',
    degrees: [
      { rootOffset: 0, quality: "maj7" },
      { rootOffset: 9, quality: "-7" },
      { rootOffset: 2, quality: "-7" },
      { rootOffset: 7, quality: "7" },
    ],
  },
  {
    id: "I-VI7-ii-V",
    name: "I-VI7-ii-V (Secondary Dominant)",
    shortLabel: "1-6-2-5 (dom)",
    description: "Turnaround with VI as a secondary dominant instead of vi-7.",
    degrees: [
      { rootOffset: 0, quality: "maj7" },
      { rootOffset: 9, quality: "7" },
      { rootOffset: 2, quality: "-7" },
      { rootOffset: 7, quality: "7" },
    ],
  },
  {
    id: "vi-ii-V-I",
    name: "vi-ii-V-I",
    shortLabel: "6-2-5-1",
    description: "Turnaround starting from the relative minor.",
    degrees: [
      { rootOffset: 9, quality: "-7" },
      { rootOffset: 2, quality: "-7" },
      { rootOffset: 7, quality: "7" },
      { rootOffset: 0, quality: "maj7" },
    ],
  },
  {
    id: "rhythm-bridge",
    name: "Rhythm Changes Bridge",
    shortLabel: "3-6-2-5 (all dom.)",
    description:
      'All-dominant descending cycle of fifths (the "B" section of rhythm changes).',
    degrees: [
      { rootOffset: 4, quality: "7" },
      { rootOffset: 9, quality: "7" },
      { rootOffset: 2, quality: "7" },
      { rootOffset: 7, quality: "7" },
    ],
  },
  {
    id: "I-VI-II-V-dom",
    name: "I-VI-II-V (All Dominant)",
    shortLabel: "1-6-2-5 (all dom.)",
    description: "Every chord in the turnaround as a dominant 7.",
    degrees: [
      { rootOffset: 0, quality: "7" },
      { rootOffset: 9, quality: "7" },
      { rootOffset: 2, quality: "7" },
      { rootOffset: 7, quality: "7" },
    ],
  },
  {
    id: "backdoor",
    name: "Backdoor ii-V-I",
    shortLabel: "bVII backdoor",
    description: 'iv-7 to bVII7 resolving to I, the "backdoor" cadence.',
    degrees: [
      { rootOffset: 5, quality: "-7" },
      { rootOffset: 10, quality: "7" },
      { rootOffset: 0, quality: "maj7" },
    ],
  },
  {
    id: "tritone-ii-V",
    name: "ii-V with Tritone Sub",
    shortLabel: "2-5 (tritone)",
    description: "ii-7 to the tritone substitute of V, unresolved.",
    degrees: [
      { rootOffset: 2, quality: "-7" },
      { rootOffset: 1, quality: "7" },
    ],
  },
  {
    id: "tritone-ii-V-I",
    name: "ii-V-I with Tritone Sub",
    shortLabel: "2-5-1 (tritone)",
    description:
      "ii-7 to the tritone sub of V, resolving down by half-step to I.",
    degrees: [
      { rootOffset: 2, quality: "-7" },
      { rootOffset: 1, quality: "7" },
      { rootOffset: 0, quality: "maj7" },
    ],
  },
  {
    id: "subV-I",
    name: "SubV7-I",
    shortLabel: "bII7-1",
    description: "Single tritone-substitute dominant resolving to the tonic.",
    degrees: [
      { rootOffset: 1, quality: "7" },
      { rootOffset: 0, quality: "maj7" },
    ],
  },
  {
    id: "V-alt-I",
    name: "V7alt-I",
    shortLabel: "5alt-1",
    description: "Fully altered dominant resolving to the tonic.",
    degrees: [
      { rootOffset: 7, quality: "7alt" },
      { rootOffset: 0, quality: "maj7" },
    ],
  },
  {
    id: "V-sharp9-I",
    name: "V7#9-I",
    shortLabel: "5(#9)-1",
    description: '"Hendrix chord" dominant resolving to the tonic.',
    degrees: [
      { rootOffset: 7, quality: "7#9" },
      { rootOffset: 0, quality: "maj7" },
    ],
  },
  {
    id: "ii-V7sharp11-I",
    name: "ii-V7#11-I (Lydian Dominant)",
    shortLabel: "2-5(#11)-1",
    description: "V7 with a raised 11th resolving to the tonic.",
    degrees: [
      { rootOffset: 2, quality: "-7" },
      { rootOffset: 7, quality: "7#11" },
      { rootOffset: 0, quality: "maj7" },
    ],
  },
  {
    id: "I-IV-ii-V",
    name: "I-IV-ii-V",
    shortLabel: "1-4-2-5",
    description: "Classic standards turnaround using the subdominant.",
    degrees: [
      { rootOffset: 0, quality: "maj7" },
      { rootOffset: 5, quality: "maj7" },
      { rootOffset: 2, quality: "-7" },
      { rootOffset: 7, quality: "7" },
    ],
  },
  {
    id: "I-IV7-iv-I",
    name: "I-IV7-iv-I (Blues Turnback)",
    shortLabel: "1-4-4m-1",
    description: "Major-to-minor plagal turnback common in blues heads.",
    degrees: [
      { rootOffset: 0, quality: "maj7" },
      { rootOffset: 5, quality: "7" },
      { rootOffset: 5, quality: "-7" },
      { rootOffset: 0, quality: "maj7" },
    ],
  },
  {
    id: "minor-blues-turn",
    name: "Minor Blues Turnaround",
    shortLabel: "1m-6alt-2-5",
    description: "i-7 to an altered secondary dominant, into the minor ii-V.",
    degrees: [
      { rootOffset: 0, quality: "-7" },
      { rootOffset: 9, quality: "7alt" },
      { rootOffset: 2, quality: "-7b5" },
      { rootOffset: 7, quality: "7b9" },
    ],
  },
  {
    id: "chromatic-mediant",
    name: "I-bIII-bVI-bII (Chromatic Mediants)",
    shortLabel: "1-b3-b6-b2",
    description:
      "Major 7 chords a minor 3rd apart — symmetrical, non-functional motion.",
    degrees: [
      { rootOffset: 0, quality: "maj7" },
      { rootOffset: 3, quality: "maj7" },
      { rootOffset: 8, quality: "maj7" },
      { rootOffset: 1, quality: "maj7" },
    ],
  },
];

export const CHORD_PROGRESSION_CONCEPTS_BY_ID: Record<
  string,
  ChordProgressionConcept
> = Object.fromEntries(CHORD_PROGRESSION_CONCEPTS.map((c) => [c.id, c]));

// ----------------------------------------------------------------------------
// Cycle types — how the key center moves after each repeat block
// ----------------------------------------------------------------------------

export type CycleTypeId =
  | "repeat"
  | "circle_of_4ths"
  | "circle_of_5ths"
  | "chromatic_up"
  | "chromatic_down"
  | "whole_step_up"
  | "whole_step_down"
  | "major_third_up"
  | "major_third_down"
  | "minor_third_up"
  | "minor_third_down"
  | "random";

export interface CycleTypeDef {
  id: CycleTypeId;
  label: string;
  /** Semitone shift applied to move to the next key center. Null = random. */
  semitoneDelta: number | null;
}

export const CYCLE_TYPES: CycleTypeDef[] = [
  { id: "repeat", label: "Repeat (same key)", semitoneDelta: 0 },
  { id: "circle_of_4ths", label: "Circle of 4ths", semitoneDelta: 5 },
  { id: "circle_of_5ths", label: "Circle of 5ths", semitoneDelta: 7 },
  { id: "chromatic_up", label: "Chromatic Up", semitoneDelta: 1 },
  { id: "chromatic_down", label: "Chromatic Down", semitoneDelta: -1 },
  { id: "whole_step_up", label: "Whole Step Up", semitoneDelta: 2 },
  { id: "whole_step_down", label: "Whole Step Down", semitoneDelta: -2 },
  { id: "major_third_up", label: "Major 3rds Up", semitoneDelta: 4 },
  { id: "major_third_down", label: "Major 3rds Down", semitoneDelta: -4 },
  { id: "minor_third_up", label: "Minor 3rds Up", semitoneDelta: 3 },
  { id: "minor_third_down", label: "Minor 3rds Down", semitoneDelta: -3 },
  { id: "random", label: "Random", semitoneDelta: null },
];

export const CYCLE_TYPES_BY_ID: Record<CycleTypeId, CycleTypeDef> =
  Object.fromEntries(CYCLE_TYPES.map((c) => [c.id, c])) as Record<
    CycleTypeId,
    CycleTypeDef
  >;

export function nextKeySemitone(
  current: number,
  cycleType: CycleTypeId,
): number {
  if (cycleType === "random") {
    if (12 <= 1) return current;
    let next = current;
    while (next === current) next = Math.floor(Math.random() * 12);
    return next;
  }
  const delta = CYCLE_TYPES_BY_ID[cycleType]?.semitoneDelta ?? 0;
  return (((current + delta) % 12) + 12) % 12;
}

// ----------------------------------------------------------------------------
// Sequencer — turns a concept + cycle into a flat, bar-grouped chord stream
// ----------------------------------------------------------------------------

export interface GeneratePatternOptions {
  concept: ChordProgressionConcept;
  /** Starting key center, 0-11 (0 = C). */
  startKeySemitone: number;
  cycleType: CycleTypeId;
  /** How many times the full cell repeats before the key center moves (1-5). */
  repeatsPerKey: number;
  /** How many key centers to generate before the buffer loops. */
  keyCentersCount: number;
  /** Prefer flat spelling for the generated chord roots. */
  preferFlats?: boolean;
}

// One bar per chord degree (matches the practice-chart convention used
// elsewhere in the app: each bar shows one chord symbol).
export function generatePatternBars(
  options: GeneratePatternOptions,
): FlatChord[] {
  const {
    concept,
    startKeySemitone,
    cycleType,
    repeatsPerKey,
    keyCentersCount,
    preferFlats = true,
  } = options;

  const bars: FlatChord[] = [];
  let keySemitone = ((startKeySemitone % 12) + 12) % 12;
  let barIndex = 0;
  const clampedRepeats = Math.max(1, Math.min(5, repeatsPerKey));

  for (let k = 0; k < Math.max(1, keyCentersCount); k++) {
    for (let rep = 0; rep < clampedRepeats; rep++) {
      concept.degrees.forEach((deg) => {
        const rootSemitone = (((keySemitone + deg.rootOffset) % 12) + 12) % 12;
        bars.push({
          root: spellSemitone(rootSemitone, preferFlats),
          quality: deg.quality,
          beats: deg.beats ?? 4,
          isNewBar: true,
          barIndex,
          sectionLabel: "Pattern",
        });
        barIndex += 1;
      });
    }
    keySemitone = nextKeySemitone(keySemitone, cycleType);
  }

  return bars;
}
