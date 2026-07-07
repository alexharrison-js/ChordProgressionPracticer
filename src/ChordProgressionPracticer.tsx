import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";

// ============================================================================
// JAZZ STANDARDS DATA
// ============================================================================
// In production this should be fetched/imported from jazz_standards.json.
// To keep this a single self-contained file as requested, we fetch it at
// runtime if available at /jazz_standards.json, otherwise fall back to a
// small embedded sample so the component still works standalone.

// Song data shape (documented here since plain JS has no interfaces):
//   { title, composer?, key, mode: 'major'|'minor', timeSignature: {numerator, denominator},
//     tempo: {bpm, source?}, verified?, notes?, form: string[],
//     sections: { [label]: { repeat?, measures: [{ chords: [{root, quality, beats}], spansBars? }] } } }

const FALLBACK_SONGS = [
  {
    title: "Autumn Leaves",
    composer: "Joseph Kosma",
    key: "Gm",
    mode: "minor",
    timeSignature: { numerator: 4, denominator: 4 },
    tempo: { bpm: 130 },
    form: ["A", "B"],
    sections: {
      A: {
        repeat: true,
        measures: [
          { chords: [{ root: "C", quality: "-7", beats: 4 }] },
          { chords: [{ root: "F", quality: "7", beats: 4 }] },
          { chords: [{ root: "Bb", quality: "maj7", beats: 4 }] },
          { chords: [{ root: "Eb", quality: "maj7", beats: 4 }] },
          { chords: [{ root: "A", quality: "-7b5", beats: 4 }] },
          { chords: [{ root: "D", quality: "7b9", beats: 4 }] },
          { chords: [{ root: "G", quality: "-7", beats: 4 }] },
          { chords: [{ root: "G", quality: "-7", beats: 4 }] },
        ],
      },
      B: {
        measures: [
          { chords: [{ root: "A", quality: "-7b5", beats: 4 }] },
          { chords: [{ root: "D", quality: "7b9", beats: 4 }] },
          { chords: [{ root: "G", quality: "-7", beats: 4 }] },
          { chords: [{ root: "G", quality: "-7", beats: 4 }] },
          { chords: [{ root: "A", quality: "-7b5", beats: 4 }] },
          { chords: [{ root: "D", quality: "7b9", beats: 4 }] },
          {
            chords: [
              { root: "G", quality: "-7", beats: 2 },
              { root: "C", quality: "7", beats: 2 },
            ],
          },
          {
            chords: [
              { root: "F", quality: "maj7", beats: 2 },
              { root: "A", quality: "-7b5", beats: 2 },
            ],
          },
          { chords: [{ root: "D", quality: "7b9", beats: 4 }] },
        ],
      },
    },
  },
  {
    title: "My Funny Valentine",
    composer: "Richard Rodgers",
    key: "Cm",
    mode: "minor",
    timeSignature: { numerator: 4, denominator: 4 },
    tempo: { bpm: 120 },
    form: ["A", "A2", "B"],
    sections: {
      A: {
        measures: [
          { chords: [{ root: "C", quality: "-7", beats: 4 }] },
          { chords: [{ root: "C", quality: "-6", beats: 4 }] },
          { chords: [{ root: "C", quality: "-7", beats: 4 }] },
          { chords: [{ root: "B", quality: "maj7", beats: 4 }] },
          { chords: [{ root: "Bb", quality: "7#5", beats: 4 }] },
          { chords: [{ root: "Eb", quality: "maj7", beats: 4 }] },
          { chords: [{ root: "Ab", quality: "maj7", beats: 4 }] },
          {
            chords: [
              { root: "D", quality: "-7b5", beats: 2 },
              { root: "G", quality: "7b9", beats: 2 },
            ],
          },
        ],
      },
      A2: {
        measures: [
          { chords: [{ root: "C", quality: "-7", beats: 4 }] },
          { chords: [{ root: "C", quality: "-6", beats: 4 }] },
          { chords: [{ root: "C", quality: "-7", beats: 4 }] },
          { chords: [{ root: "B", quality: "maj7", beats: 4 }] },
          { chords: [{ root: "Bb", quality: "7#5", beats: 4 }] },
          { chords: [{ root: "Eb", quality: "maj7", beats: 4 }] },
          { chords: [{ root: "F", quality: "-7", beats: 4 }] },
          { chords: [{ root: "F", quality: "-7", beats: 4 }] },
        ],
      },
      B: {
        measures: [
          { chords: [{ root: "C", quality: "-7", beats: 4 }] },
          {
            chords: [
              { root: "G", quality: "-7b5", beats: 2 },
              { root: "C", quality: "7b9", beats: 2 },
            ],
          },
          { chords: [{ root: "F", quality: "-7", beats: 4 }] },
          { chords: [{ root: "F", quality: "-7", beats: 4 }] },
          { chords: [{ root: "C", quality: "-7", beats: 4 }] },
          {
            chords: [
              { root: "D", quality: "-7b5", beats: 2 },
              { root: "G", quality: "7b9", beats: 2 },
            ],
          },
          { chords: [{ root: "C", quality: "-7", beats: 4 }] },
          { chords: [{ root: "C", quality: "-7", beats: 4 }] },
        ],
      },
    },
  },
  {
    title: "Blue Monk",
    composer: "Thelonious Monk",
    key: "Bb",
    mode: "major",
    timeSignature: { numerator: 4, denominator: 4 },
    tempo: { bpm: 130 },
    form: ["A"],
    sections: {
      A: {
        measures: [
          { chords: [{ root: "Bb", quality: "7", beats: 4 }] },
          { chords: [{ root: "Eb", quality: "7", beats: 4 }] },
          { chords: [{ root: "Bb", quality: "7", beats: 4 }] },
          { chords: [{ root: "Bb", quality: "7", beats: 4 }] },
          { chords: [{ root: "Eb", quality: "7", beats: 4 }] },
          { chords: [{ root: "Eb", quality: "7", beats: 4 }] },
          { chords: [{ root: "Bb", quality: "7", beats: 4 }] },
          { chords: [{ root: "Bb", quality: "7", beats: 4 }] },
          { chords: [{ root: "F", quality: "7", beats: 4 }] },
          { chords: [{ root: "Eb", quality: "7", beats: 4 }] },
          {
            chords: [
              { root: "Bb", quality: "7", beats: 2 },
              { root: "F", quality: "7", beats: 2 },
            ],
          },
          { chords: [{ root: "Bb", quality: "7", beats: 4 }] },
        ],
      },
    },
  },
];

// ============================================================================
// MUSIC THEORY UTILITIES
// ============================================================================

const NOTE_TO_SEMITONE = {
  C: 0,
  "B#": 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  Fb: 4,
  F: 5,
  "E#": 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
  Cb: 11,
};

const SEMITONE_TO_SHARP = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];
const SEMITONE_TO_FLAT = [
  "C",
  "Db",
  "D",
  "Eb",
  "E",
  "F",
  "Gb",
  "G",
  "Ab",
  "A",
  "Bb",
  "B",
];

// Keys whose conventional spelling uses flats rather than sharps.
const FLAT_KEY_ROOTS = new Set(["F", "Bb", "Eb", "Ab", "Db", "Gb", "Cb"]);

const ALL_KEYS = [
  "C",
  "Db",
  "D",
  "Eb",
  "E",
  "F",
  "Gb",
  "G",
  "Ab",
  "A",
  "Bb",
  "B",
];
const ALL_MINOR_KEYS = ALL_KEYS.map((k) => `${k}m`);

function keyRoot(key) {
  return key.endsWith("m") && key.length > 1 ? key.slice(0, -1) : key;
}

function keySemitone(key) {
  const r = keyRoot(key);
  return NOTE_TO_SEMITONE[r] ?? 0;
}

function useFlatsForKey(key) {
  return FLAT_KEY_ROOTS.has(keyRoot(key));
}

function transposeRoot(root, semitoneShift, targetKey) {
  const base = NOTE_TO_SEMITONE[root];
  if (base === undefined) return root;
  const newSemitone = (((base + semitoneShift) % 12) + 12) % 12;
  return useFlatsForKey(targetKey)
    ? SEMITONE_TO_FLAT[newSemitone]
    : SEMITONE_TO_SHARP[newSemitone];
}

// ============================================================================
// TRANSPOSING INSTRUMENT DISPLAY
// ============================================================================
// This is purely cosmetic — it changes what's shown in the chord chart for
// players of Bb or Eb instruments, who read a different written pitch than
// the concert (sounding) pitch. It never touches the audio engine, which
// always plays the true concert-pitch voicings regardless of this setting.
//
// Standard transposing-instrument intervals (semitones to ADD to a concert
// pitch to get the written pitch a transposing-instrument player should
// read): Bb instruments (trumpet, tenor/soprano sax, clarinet) read a major
// 2nd above concert, so +2. Eb instruments (alto/bari sax) read a major 6th
// above concert (mod 12, equivalent to a minor 3rd below), so +9.
const INSTRUMENT_SHIFT = { C: 0, Bb: 2, Eb: 9 };
const INSTRUMENT_LABELS = {
  C: "Concert C",
  Bb: "B\u266D Instrument",
  Eb: "E\u266D Instrument",
};

// Applies the instrument's display shift on top of an already-transposed
// concert-pitch root. `concertTargetKey` is only used to pick sharp vs flat
// spelling for the concert pitch itself; we derive the instrument's own
// spelling preference by shifting that key the same amount.
function transposeForInstrument(root, instrument, concertTargetKey) {
  const shift = INSTRUMENT_SHIFT[instrument] ?? 0;
  if (shift === 0) return root;
  const displayKey = transposeRoot(
    keyRoot(concertTargetKey),
    shift,
    concertTargetKey,
  );
  return transposeRoot(root, shift, displayKey);
}

// Chord quality -> interval set (semitones from root). Covers the qualities
// present in jazz_standards.json. Falls back to dominant 7 for anything unknown.
const QUALITY_INTERVALS = {
  maj7: [0, 4, 7, 11],
  maj9: [0, 4, 7, 11, 14],
  "6": [0, 4, 7, 9],
  "-6": [0, 3, 7, 9],
  "-7": [0, 3, 7, 10],
  "-9": [0, 3, 7, 10, 14],
  "-7b5": [0, 3, 6, 10],
  "-": [0, 3, 7],
  "7": [0, 4, 7, 10],
  "7b9": [0, 4, 7, 10, 13],
  "7#11": [0, 4, 7, 10, 6],
  "9#11": [0, 4, 7, 10, 14, 6],
  "7#5": [0, 4, 8, 10],
  "9": [0, 4, 7, 10, 14],
  sus: [0, 5, 7, 10],
  "7sus": [0, 5, 7, 10],
  "7alt": [0, 4, 6, 10, 1],
  dim7: [0, 3, 6, 9],
  o7: [0, 3, 6, 9],
  o: [0, 3, 6],
  // Added when importing the Jazz-Chord-Progressions-Corpus source of truth —
  // these cover every quality string that corpus's chord symbols produce.
  "": [], // "NC" / no-chord rest tokens carry an empty quality; isRest should
  // be checked before this is ever used for synthesis, but an empty
  // interval list is a safe no-op fallback regardless.
  "-#5": [0, 3, 8],
  "-11": [0, 3, 7, 10, 14, 17],
  "-69": [0, 3, 7, 9, 14],
  "-maj7": [0, 3, 7, 11],
  "13": [0, 4, 7, 10, 14, 17],
  "13#11": [0, 4, 7, 10, 14, 18],
  "13b9": [0, 4, 7, 10, 13, 17],
  "7#5#9": [0, 4, 8, 10, 15],
  "7#5b9": [0, 4, 8, 10, 13],
  "7#9": [0, 4, 7, 10, 15],
  "7#9#11": [0, 4, 7, 10, 15, 18],
  "7+": [0, 4, 8, 10],
  "7b5": [0, 4, 6, 10],
  "7b9#11": [0, 4, 7, 10, 13, 18],
  "7b9b5": [0, 4, 6, 10, 13],
  "7sus4": [0, 5, 7, 10],
  "9sus": [0, 5, 7, 10, 14],
  "9sus4": [0, 5, 7, 10, 14],
  aug: [0, 4, 8],
  dim: [0, 3, 6],
  maj: [0, 4, 7],
  maj6: [0, 4, 7, 9],
  maj69: [0, 4, 7, 9, 14],
  "maj7#11": [0, 4, 7, 11, 18],
  "maj7#5": [0, 4, 8, 11],
};

function qualityIntervals(quality) {
  return QUALITY_INTERVALS[quality] || QUALITY_INTERVALS["7"];
}

// Friendly display label for a chord quality (used in the chart).
function qualityLabel(quality) {
  const MAP = {
    maj7: "maj7",
    maj9: "maj9",
    "6": "6",
    "-6": "m6",
    "-7": "m7",
    "-9": "m9",
    "-7b5": "m7\u266D5",
    "-": "m",
    "7": "7",
    "7b9": "7\u266D9",
    "7#11": "7#11",
    "9#11": "9#11",
    "7#5": "7#5",
    "9": "9",
    sus: "sus",
    "7sus": "7sus",
    "7alt": "7alt",
    dim7: "dim7",
    o7: "dim7",
    o: "dim",
    // Added when importing the Jazz-Chord-Progressions-Corpus source of truth.
    "": "", // NC / rest — rendered specially by the chart, not via this label
    "-#5": "m#5",
    "-11": "m11",
    "-69": "m6/9",
    "-maj7": "m(maj7)",
    "13": "13",
    "13#11": "13#11",
    "13b9": "13\u266D9",
    "7#5#9": "7#5#9",
    "7#5b9": "7#5\u266D9",
    "7#9": "7#9",
    "7#9#11": "7#9#11",
    "7+": "7#5",
    "7b5": "7\u266D5",
    "7b9#11": "7\u266D9#11",
    "7b9b5": "7\u266D9\u266D5",
    "7sus4": "7sus4",
    "9sus": "9sus",
    "9sus4": "9sus4",
    aug: "aug",
    dim: "dim",
    maj: "", // bare major triad shown as just the root
    maj6: "6",
    maj69: "6/9",
    "maj7#11": "maj7#11",
    "maj7#5": "maj7#5",
  };
  return MAP[quality] ?? quality;
}

// ============================================================================
// VOICING GENERATION
// ============================================================================

// VoicingStyle is one of: "root" | "closed" | "open" | "block" | "drop2"

function rootMidi(root, octave) {
  return (octave + 1) * 12 + (NOTE_TO_SEMITONE[root] ?? 0);
}

// Find the MIDI note with the given pitch class closest to a reference MIDI note.
function closestOctaveNote(pitchClass, referenceMidi) {
  const base = referenceMidi - (((referenceMidi % 12) + 12) % 12) + pitchClass;
  let best = base;
  for (const cand of [base - 12, base, base + 12]) {
    if (Math.abs(cand - referenceMidi) < Math.abs(best - referenceMidi))
      best = cand;
  }
  return best;
}

// VoicedChord shape: { notes: number[] (MIDI notes), bass: number (MIDI bass note) }

// Playable register bounds for the voicing engine (roughly piano's middle
// 4 octaves — comfortably within any instrument/synth's usable range).
const VOICING_RANGE_MIN = 48; // C3
const VOICING_RANGE_MAX = 84; // C6
const VOICING_CENTER = 65; // F above middle C — comfortable mid-register anchor

// How strongly each new chord's reference point is pulled back toward
// VOICING_CENTER, on top of pure voice-leading against the previous chord.
// Pure nearest-note voice-leading (pull = 0) is musically "correct" in the
// short term, but over many chord changes it can settle into a stable
// cycle that sits well away from a comfortable register — particularly on
// progressions with sustained descending or ascending root motion (long
// ii-V chains, cycle-of-fifths bridges, etc.) — and once that cycle
// stabilizes, every subsequent chord keeps reinforcing it. A gentle pull
// breaks that feedback loop without making consecutive chords feel like
// they're snapping to a grid; it's subtle enough that genuine voice-leading
// motion (e.g. a half-step resolution) is barely affected; it's only the
// long-run accumulated drift that gets reliably canceled out.
const VOICING_CENTER_PULL = 0.22;

function clampReference(ref) {
  return Math.max(VOICING_RANGE_MIN, Math.min(VOICING_RANGE_MAX, ref));
}

function pullTowardCenter(naturalReference) {
  const blended =
    naturalReference * (1 - VOICING_CENTER_PULL) +
    VOICING_CENTER * VOICING_CENTER_PULL;
  return clampReference(blended);
}

// Generates a voicing for a chord, optionally voice-led from the previous voicing.
//
// IMPORTANT: the "reference" used to voice-lead the *next* chord is always
// derived from the closed-position pitch classes, never from a style's
// spread/dropped notes. Earlier, "open" and "drop2" fed their already
//-transformed (permanently shifted up/down) notes back in as the next
// chord's reference, which compounded every chord change and made voicings
// drift out of any usable register within a few bars. Each style below is
// now a one-time transform of a closed voicing computed fresh each call.
function generateVoicing(root, quality, style, prevVoicing, centerMidi = 65) {
  const rootPc = NOTE_TO_SEMITONE[root] ?? 0;
  const pitchClasses = [
    ...new Set(
      qualityIntervals(quality).map((i) => (((i + rootPc) % 12) + 12) % 12),
    ),
  ];
  const bass = rootMidi(root, 2);

  // Reference point to voice-lead against: average of the previous chord's
  // CLOSED-equivalent notes (tracked separately from whatever was actually
  // played), or a comfortable center register if this is the first chord.
  // Pulled gently toward a fixed center (see VOICING_CENTER_PULL above) so
  // a long song's accumulated voice-leading can't settle into a stuck-low
  // (or stuck-high) attractor cycle, then clamped as a hard backstop.
  const reference = pullTowardCenter(
    prevVoicing && prevVoicing.closedNotes && prevVoicing.closedNotes.length
      ? prevVoicing.closedNotes.reduce((a, b) => a + b, 0) /
          prevVoicing.closedNotes.length
      : centerMidi,
  );

  const closed = pitchClasses
    .map((pc) => closestOctaveNote(pc, reference))
    .sort((a, b) => a - b);

  if (style === "root") {
    // Root-position stack built straight up from the bass note's octave.
    const base = rootMidi(root, 3);
    const notes = qualityIntervals(quality).map(
      (i) => base + (i % 12 === i ? i : i % 12),
    );
    const sorted = notes.sort((a, b) => a - b);
    return { notes: sorted, closedNotes: closed, bass };
  }

  if (style === "closed") {
    return { notes: closed, closedNotes: closed, bass };
  }

  if (style === "drop2") {
    if (closed.length < 3) return { notes: closed, closedNotes: closed, bass };
    const idx = closed.length - 2;
    const dropped = [...closed];
    dropped[idx] -= 12;
    return { notes: dropped.sort((a, b) => a - b), closedNotes: closed, bass };
  }

  if (style === "open") {
    // Spread voicing: alternate notes pushed up an octave from closed
    // position for a wider, more open sound.
    const spread = closed.map((n, i) => (i % 2 === 1 ? n + 12 : n));
    return { notes: spread.sort((a, b) => a - b), closedNotes: closed, bass };
  }

  if (style === "block") {
    // Block/"shout" style: closed voicing doubled with the root an octave
    // below, giving a fuller, more percussive chord.
    const lowRoot = closestOctaveNote(rootPc, reference - 12);
    return {
      notes: [lowRoot, ...closed].sort((a, b) => a - b),
      closedNotes: closed,
      bass,
    };
  }

  // fallback
  return { notes: closed, closedNotes: closed, bass };
}

const VOICING_STYLES = [
  { id: "closed", label: "Closed" },
  { id: "open", label: "Open" },
  { id: "drop2", label: "Drop 2" },
  { id: "block", label: "Block" },
  { id: "root", label: "Root position" },
];

// ============================================================================
// SONG FLATTENING — turn form + sections into one linear list of {chord, beats}
// ============================================================================

// FlatChord shape: { root, quality, beats (within its bar), isNewBar (starts a new bar),
//   barIndex (0-based bar index in the whole flattened song), sectionLabel }

function flattenSection(label, section, numerator) {
  const out = [];
  let bar = 0;
  for (const measure of section.measures) {
    const span = measure.spansBars ?? 1;
    for (let s = 0; s < span; s++) {
      measure.chords.forEach((c, idx) => {
        out.push({
          root: c.root,
          quality: c.quality,
          beats: c.beats,
          isNewBar: idx === 0,
          barIndex: bar,
          sectionLabel: label,
        });
      });
      bar += 1;
    }
  }
  return out;
}

// Flattens a song into three separate buffers:
//   - intro: plays once, before looping starts (empty array if none)
//   - core: the main form, this is what loops indefinitely during practice
//   - outro: Tag/Coda material (empty array if none) — not used by the
//     looping practice player, since there's no natural point to play a
//     one-time ending while looping forever, but kept available here in
//     case a future "play once" mode wants it.
function flattenSong(song) {
  const num = song.timeSignature.numerator;

  const appendSection = (label, barOffsetRef) => {
    const section = song.sections[label];
    if (!section) return [];
    const flat = flattenSection(label, section, num);
    const repeated = section.repeat ? [...flat, ...flat] : flat;
    const reindexed = repeated.map((c) => ({
      ...c,
      barIndex: c.barIndex + barOffsetRef.value,
    }));
    const barsInSection = section.measures.reduce(
      (sum, m) => sum + (m.spansBars ?? 1),
      0,
    );
    barOffsetRef.value += section.repeat ? barsInSection * 2 : barsInSection;
    return reindexed;
  };

  let intro = [];
  if (song.sections["Intro"] && !song.form.includes("Intro")) {
    const ref = { value: 0 };
    intro = appendSection("Intro", ref);
  }

  // The main form always starts its own bar numbering at 0, independent of
  // the intro — the intro is a separate one-time buffer, not part of the
  // repeating bar count the chart/loop cares about.
  const coreRef = { value: 0 };
  const core = [];
  song.form.forEach((label) => {
    core.push(...appendSection(label, coreRef));
  });

  let outro = [];
  const outroRef = { value: 0 };
  if (song.sections["Coda"] && !song.form.includes("Coda")) {
    outro.push(...appendSection("Coda", outroRef));
  }
  if (song.sections["Tag"] && !song.form.includes("Tag")) {
    outro.push(...appendSection("Tag", outroRef));
  }

  return { intro, core, outro };
}

// ============================================================================
// AUDIO ENGINE
// ============================================================================

// Subdivision is one of: "quarter" | "eighth" | "sixteenth"
// Articulation is one of: "block" | "staccato"

class AudioEngine {
  ctx = null;
  masterGain = null;
  metroGain = null;
  chordGain = null;
  activeNodes = new Set(); // tracks every oscillator currently scheduled/playing

  ensureContext() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 1;
      this.masterGain.connect(this.ctx.destination);

      this.metroGain = this.ctx.createGain();
      this.metroGain.gain.value = 0.5;
      this.metroGain.connect(this.masterGain);

      this.chordGain = this.ctx.createGain();
      this.chordGain.gain.value = 0.8;
      this.chordGain.connect(this.masterGain);
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  }

  setMetroVolume(v) {
    if (this.metroGain) this.metroGain.gain.value = v;
  }

  // Immediately silences and disconnects every oscillator this engine has
  // scheduled, whether it has started yet or is still in the future. Safe
  // to call even if some oscillators have already finished naturally.
  stopAll() {
    const ctx = this.ctx;
    this.activeNodes.forEach((osc) => {
      try {
        osc.stop(ctx ? ctx.currentTime : 0);
      } catch (e) {
        // stop() throws if already stopped — safe to ignore
      }
      try {
        osc.disconnect();
      } catch (e) {
        // already disconnected — safe to ignore
      }
    });
    this.activeNodes.clear();
  }

  playClick(time, accent) {
    const ctx = this.ensureContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = accent ? 1500 : 1000;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(accent ? 1 : 0.6, time + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.035);
    osc.connect(gain);
    gain.connect(this.metroGain);
    osc.start(time);
    osc.stop(time + 0.04);
    this.activeNodes.add(osc);
    osc.onended = () => this.activeNodes.delete(osc);
  }

  // Plays one note with the requested timbre. `dest` is the gain node to
  // route into (the shared chord bus). All three timbres are built purely
  // from oscillators/envelopes — no sample loading, so the whole component
  // stays a single self-contained file with no external audio assets.
  _playVoice(midi, gainScale, dest, time, duration, timbre) {
    const ctx = this.ctx;
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    const attack =
      timbre === "piano" ? 0.006 : timbre === "epiano" ? 0.008 : 0.015;
    const stopAt = time + duration + 0.08;

    const makeOsc = (type, freqMult, detuneCents = 0) => {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq * freqMult;
      if (detuneCents) osc.detune.value = detuneCents;
      this.activeNodes.add(osc);
      osc.onended = () => this.activeNodes.delete(osc);
      return osc;
    };

    const connectWithEnvelope = (osc, peakGain, decayShape) => {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, time);
      g.gain.linearRampToValueAtTime(peakGain * gainScale, time + attack);
      decayShape(g, peakGain * gainScale);
      osc.connect(g);
      g.connect(dest);
      osc.start(time);
      osc.stop(stopAt);
    };

    if (timbre === "piano") {
      // Acoustic-piano approximation: a fundamental that decays continuously
      // (no flat sustain plateau, like a real struck string), plus two
      // higher partials that decay much faster than the fundamental — this
      // is what gives a struck piano note its bright, fast-fading attack
      // before settling into a purer tone.
      const fundamental = makeOsc("triangle", 1);
      connectWithEnvelope(fundamental, 0.5, (g, peak) => {
        g.gain.setTargetAtTime(0.0001, time + attack, duration * 0.45);
      });

      const partial2 = makeOsc("sine", 2.0);
      connectWithEnvelope(partial2, 0.16, (g, peak) => {
        g.gain.setTargetAtTime(0.0001, time + attack, duration * 0.18);
      });

      const partial3 = makeOsc("sine", 3.01); // slightly sharp, like real piano inharmonicity
      connectWithEnvelope(partial3, 0.07, (g, peak) => {
        g.gain.setTargetAtTime(0.0001, time + attack, duration * 0.08);
      });
      return;
    }

    if (timbre === "epiano") {
      // Electric-piano approximation: a clean, round sine-dominant
      // fundamental (the defining EP trait — much purer than acoustic
      // piano), plus a brief slightly-detuned higher partial right at the
      // attack for the characteristic Rhodes/Wurlitzer "bell" or "bark",
      // which fades out quickly and leaves only the round fundamental.
      const fundamental = makeOsc("sine", 1);
      connectWithEnvelope(fundamental, 0.5, (g, peak) => {
        g.gain.setTargetAtTime(0.0001, time + attack, duration * 0.6);
      });

      const bark = makeOsc("sine", 4.0, 8); // slightly detuned 4th partial = the "tine" bite
      connectWithEnvelope(bark, 0.12, (g, peak) => {
        g.gain.setTargetAtTime(0.0001, time + attack, 0.05); // fast — just colors the attack
      });
      return;
    }

    // "synth" — the original triangle+sine pad sound, kept as a clear,
    // simple option for pure theory practice.
    const osc = makeOsc("triangle", 1);
    const g = ctx.createGain();
    const release = Math.min(0.25, duration * 0.3);
    const sustainEnd = Math.max(time + attack, time + duration - release);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(0.22 * gainScale, time + attack);
    g.gain.setValueAtTime(0.22 * gainScale, sustainEnd);
    g.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    osc.connect(g);
    g.connect(dest);
    osc.start(time);
    osc.stop(stopAt);

    const osc2 = makeOsc("sine", 2);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.0001, time);
    g2.gain.linearRampToValueAtTime(0.05 * gainScale, time + attack);
    g2.gain.setValueAtTime(0.05 * gainScale, sustainEnd);
    g2.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    osc2.connect(g2);
    g2.connect(dest);
    osc2.start(time);
    osc2.stop(stopAt);
  }

  playChord(midiNotes, bassNote, time, duration, timbre = "piano") {
    this.ensureContext();
    midiNotes.forEach((n) =>
      this._playVoice(n, 1, this.chordGain, time, duration, timbre),
    );
    this._playVoice(bassNote, 1.3, this.chordGain, time, duration, timbre);
  }
}

// ============================================================================
// SCHEDULING — beat-by-beat playback synced to a lookahead clock
// ============================================================================
// ScheduledBeat shape: { time, barIndex, beatInBar (0-based), isChordStart, chord?, voicing? }

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_S = 0.15;

// ============================================================================
// FIT-TO-SCREEN LAYOUT (used only in "hide controls" phone mode) — picks a
// grid (columns/rows) and a font size small enough that every bar's FULL
// chord text (root + quality, all chords in a multi-chord bar) fits inside
// its cell, and every bar fits within the available viewport with no
// scrolling. Unlike a naive "shrink based on bar count" approach, this
// looks at the actual text of the widest bar (e.g. a 2-chord bar like
// "A-7 · D7" needs more width than a 1-chord bar) so nothing gets clipped.
// Recomputed live via ResizeObserver whenever the container size or the
// song's bars change.
// ============================================================================

// The chord grid renders with the `font-mono` class (JetBrains Mono), which
// is a true monospace font — so a character's rendered width is a reliable,
// near-constant fraction of the font-size. This lets us predict text width
// from character count alone instead of measuring the DOM. The ratio is set
// a little generous (rather than the theoretical ~0.6) so estimates err on
// the side of a slightly-too-small font instead of overflow.
const MONO_CHAR_WIDTH_RATIO = 0.68; // px width per px of font-size, per character
const LINE_HEIGHT_RATIO = 1.3; // px line height per px of font-size
const CELL_PAD_X = 14; // px, combined left+right padding+border inside a cell
const CELL_PAD_Y = 10; // px, combined top+bottom padding+border inside a cell
const GRID_GAP = 6; // px, matches the gap-1.5 class used between grid cells
const SYMBOL_GAP = 4; // px, matches the gap-1 class used between chord symbols within a cell

// Estimates a bar's rendered chord text as { chars, fixedPx }: `chars` is
// the character count that scales with font-size (root + quality symbols +
// the "·" separators), and `fixedPx` is the flex `gap` spacing between
// symbols, which is a fixed pixel value that does NOT shrink with font-size
// — so it has to be subtracted from available width before dividing by
// per-character width, rather than folded into the character count.
function estimateBarMetrics(barChords) {
  let chars = 0;
  barChords.forEach((c, idx) => {
    if (idx > 0) chars += 1; // the "·" separator character itself
    if (c.isRest || c.root === "NC") {
      chars += 1;
      return;
    }
    chars += (c.root?.length || 1) + qualityLabel(c.quality).length;
    if (c.bassNote) chars += c.bassNote.length + 1;
  });
  const n = barChords.length;
  // n chords + (n-1) separators = (2n-1) flex children = (2n-2) gaps.
  const fixedPx = Math.max(0, 2 * n - 2) * SYMBOL_GAP;
  return { chars: Math.max(chars, 1), fixedPx };
}

function computeFitLayout(width, height, barsChords) {
  const count = barsChords.length;
  if (!count || width <= 0 || height <= 0) {
    return { columns: 1, rows: 1, fontSize: 16 };
  }
  const metrics = barsChords.map(estimateBarMetrics);

  let best = { columns: 1, rows: count, fontSize: 0 };
  for (let c = 1; c <= count; c++) {
    const rows = Math.ceil(count / c);
    const cellW = (width - GRID_GAP * (c - 1)) / c - CELL_PAD_X;
    const cellH = (height - GRID_GAP * (rows - 1)) / rows - CELL_PAD_Y;
    if (cellW <= 0 || cellH <= 0) continue;

    // The binding constraint is whichever bar needs the most width relative
    // to what's available — check every bar's own requirement, not a single
    // precomputed "widest" one, since fixed gap overhead vs. scaling
    // character width trade off differently at different font sizes.
    let minFontSizeForWidth = Infinity;
    for (const m of metrics) {
      const availableForChars = cellW - m.fixedPx;
      const fs =
        availableForChars <= 0
          ? 0
          : availableForChars / (m.chars * MONO_CHAR_WIDTH_RATIO);
      if (fs < minFontSizeForWidth) minFontSizeForWidth = fs;
    }
    const fontSizeForHeight = cellH / LINE_HEIGHT_RATIO;
    const fontSize = Math.min(minFontSizeForWidth, fontSizeForHeight);

    if (fontSize > best.fontSize) best = { columns: c, rows, fontSize };
  }

  // Only cap the upper bound — never force a minimum. A tiny font that
  // truly fits is the goal; flooring it here would silently reintroduce
  // overflow/clipping, which is exactly what we're trying to avoid.
  return {
    columns: best.columns,
    rows: best.rows,
    fontSize: Math.max(1, Math.min(48, best.fontSize)),
  };
}

// ============================================================================
// UI HELPER: chord symbol display
// ============================================================================

function ChordSymbol({ root, quality, isRest, bassNote }) {
  if (isRest || root === "NC") {
    return <span className="whitespace-nowrap text-[#8A8580]">—</span>; // em dash = no chord / rest
  }
  return (
    <span className="whitespace-nowrap">
      {root}
      <span className="text-[0.85em]">{qualityLabel(quality)}</span>
      {bassNote && (
        <span className="text-[0.8em] text-[#8A8580]">/{bassNote}</span>
      )}
    </span>
  );
}

export default function ChordProgressionPracticer() {
  // ---- Library state ----
  const [songs, setSongs] = useState(FALLBACK_SONGS);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    fetch("./jazz_standards.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("not found"))))
      .then((data) => {
        if (Array.isArray(data) && data.length) setSongs(data);
      })
      .catch(() => {
        setLoadError(
          "Using a small built-in song list \u2014 add jazz_standards.json to load the full set.",
        );
      });
  }, []);

  // ---- Search / selection state ----
  const [query, setQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [selectedSong, setSelectedSong] = useState(null);
  const searchContainerRef = useRef(null);

  useEffect(() => {
    function handleOutsideClick(e) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target)
      ) {
        setShowResults(false);
      }
    }
    function handleEscape(e) {
      if (e.key === "Escape") setShowResults(false);
    }
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      // Empty query (e.g. just clicked into the box) — show every song,
      // alphabetized, so the user can browse the full catalog instead of
      // only ever seeing results once they start typing.
      return [...songs].sort((a, b) => a.title.localeCompare(b.title));
    }
    return songs.filter((s) => s.title.toLowerCase().includes(q)).slice(0, 30);
  }, [songs, query]);

  // ---- Practice settings (reset to song defaults on song change) ----
  const [selectedKey, setSelectedKey] = useState("C");
  const [bpm, setBpm] = useState(120);
  // Tempo input is tracked as free-form text separately from the committed
  // numeric `bpm` used by playback. This lets the user type "1", "19",
  // "190" one digit at a time without each keystroke being clamped and
  // re-rendered back into the field (which is what caused the old
  // "auto-fills with a different number while typing" bug). The typed
  // text is only parsed/clamped into `bpm` on blur or Enter.
  const [bpmInput, setBpmInput] = useState("120");
  const [voicingStyle, setVoicingStyle] = useState("closed");
  const [articulation, setArticulation] = useState("block");
  const [timbre, setTimbre] = useState("piano");
  const [showChart, setShowChart] = useState(true);
  const [displayInstrument, setDisplayInstrument] = useState("C"); // cosmetic only — never affects audio

  // ---- Metronome settings ----
  const [metronomeOn, setMetronomeOn] = useState(true);
  const [subdivision, setSubdivision] = useState("quarter");
  const [accentMode, setAccentMode] = useState("downbeat");
  const [metroVolume, setMetroVolume] = useState(0.5);

  // ---- Playback state ----
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentBar, setCurrentBar] = useState(-1);

  // ---- "Just show me the chart" mode for small phone screens ----
  const [controlsHidden, setControlsHidden] = useState(false);

  const engineRef = useRef(null);
  if (!engineRef.current) engineRef.current = new AudioEngine();

  const lastVoicingRef = useRef(null);
  const rafRef = useRef(null);
  const playGenRef = useRef(0); // bumped on every start/stop so stale loop-scheduling closures become no-ops

  function commitBpmInput() {
    const parsed = parseInt(bpmInput, 10);
    const clamped = Math.max(
      1,
      Math.min(500, Number.isFinite(parsed) ? parsed : bpm),
    );
    setBpm(clamped);
    setBpmInput(String(clamped));
  }

  function selectSong(song) {
    setSelectedSong(song);
    setSelectedKey(song.key);
    // tempo.bpm may be the literal string "unknown" for songs imported from
    // sources that don't specify a tempo — fall back to a sensible default
    // rather than feeding a non-numeric value into beat-duration math.
    const bpmValue = typeof song.tempo?.bpm === "number" ? song.tempo.bpm : 120;
    setBpm(bpmValue);
    setBpmInput(String(bpmValue));
    setQuery(song.title);
    setShowResults(false);
    stopPlayback();
  }

  function pickRandomKey() {
    if (!selectedSong) return;
    const pool = selectedSong.mode === "minor" ? ALL_MINOR_KEYS : ALL_KEYS;
    const choice = pool[Math.floor(Math.random() * pool.length)];
    setSelectedKey(choice);
  }

  // ---- Transposed + flattened chart for the selected song & key ----
  // flattenSong now returns three separate buffers: intro/outro play once
  // (shown in the chart for reference, but not part of the practice loop),
  // and core is the main form, which is both displayed and the only part
  // that actually loops during playback.
  const flatSong = useMemo(() => {
    if (!selectedSong) return { intro: [], core: [], outro: [] };
    return flattenSong(selectedSong);
  }, [selectedSong]);

  const semitoneShift = useMemo(() => {
    if (!selectedSong) return 0;
    return keySemitone(selectedKey) - keySemitone(selectedSong.key);
  }, [selectedSong, selectedKey]);

  const transposeAll = useCallback(
    (chords) =>
      chords.map((c) => ({
        ...c,
        root: transposeRoot(c.root, semitoneShift, selectedKey),
      })),
    [semitoneShift, selectedKey],
  );

  const transposedIntro = useMemo(
    () => transposeAll(flatSong.intro),
    [flatSong.intro, transposeAll],
  );
  const transposedCore = useMemo(
    () => transposeAll(flatSong.core),
    [flatSong.core, transposeAll],
  );
  const transposedOutro = useMemo(
    () => transposeAll(flatSong.outro),
    [flatSong.outro, transposeAll],
  );

  // Groups a flat chord list into per-bar arrays (for the chart and for the player).
  function groupIntoBars(chords) {
    const out = [];
    chords.forEach((c) => {
      if (!out[c.barIndex]) out[c.barIndex] = [];
      out[c.barIndex].push(c);
    });
    return out;
  }

  const introBars = useMemo(
    () => groupIntoBars(transposedIntro),
    [transposedIntro],
  );
  const bars = useMemo(() => groupIntoBars(transposedCore), [transposedCore]); // the looping core — what actually plays
  const outroBars = useMemo(
    () => groupIntoBars(transposedOutro),
    [transposedOutro],
  );

  const totalBars = bars.length;

  // ---- Display-only instrument transposition (chart text, never audio) ----
  // Takes the already key-transposed concert-pitch bars and applies the
  // selected transposing-instrument's interval on top, purely for what's
  // shown in the chord chart. The audio engine always reads from `bars` /
  // `introBars` / `outroBars` above (concert pitch), never from these.
  const applyInstrumentDisplay = useCallback(
    (groupedBars) =>
      groupedBars.map((bar) =>
        bar.map((c) => ({
          ...c,
          root: transposeForInstrument(c.root, displayInstrument, selectedKey),
        })),
      ),
    [displayInstrument, selectedKey],
  );

  const displayIntroBars = useMemo(
    () => applyInstrumentDisplay(introBars),
    [introBars, applyInstrumentDisplay],
  );
  const displayBars = useMemo(
    () => applyInstrumentDisplay(bars),
    [bars, applyInstrumentDisplay],
  );
  const displayOutroBars = useMemo(
    () => applyInstrumentDisplay(outroBars),
    [outroBars, applyInstrumentDisplay],
  );

  // ---- Fit-to-screen sizing for the core "Form" grid ----
  // Measures the actual rendered space available for the form grid and
  // picks a column count + font size so every bar is visible at once,
  // without scrolling — recomputed on resize/orientation change and
  // whenever controls are hidden/shown (which changes available height).
  const formGridContainerRef = useRef(null);
  const [fitLayout, setFitLayout] = useState({
    columns: 4,
    rows: 1,
    fontSize: 16,
  });

  useEffect(() => {
    // The fit-to-screen shrink logic only applies in "hide controls" phone
    // mode (see render below) — in the normal view the chart flows
    // naturally and the page scrolls like any other page, so there's
    // nothing to measure/compute there.
    if (!controlsHidden) return;
    const el = formGridContainerRef.current;
    if (!el) return;
    const recompute = () => {
      const rect = el.getBoundingClientRect();
      setFitLayout(computeFitLayout(rect.width, rect.height, displayBars));
    };
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [displayBars, controlsHidden, showChart]);

  // ---- Stop playback & cleanup ----
  const stopPlayback = useCallback(() => {
    playGenRef.current += 1; // invalidate any in-flight scheduling/RAF closures from this point on
    setIsPlaying(false);
    setCurrentBar(-1);
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (engineRef.current) {
      engineRef.current.stopAll(); // actually silences every scheduled/playing oscillator
    }
    lastVoicingRef.current = null;
  }, []);

  useEffect(() => {
    // Changing song, key, or tempo stops playback; the user presses Play again
    // to hear the new settings (avoids the old and new versions overlapping).
    stopPlayback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSong, selectedKey, bpm]);

  // ---- Scheduler ----
  function startPlayback() {
    if (!selectedSong || bars.length === 0) return;
    const engine = engineRef.current;
    const ctx = engine.ensureContext();
    engine.setMetroVolume(metronomeOn ? metroVolume : 0);

    // Stop anything left over from a previous session and start a fresh
    // generation. Any closures captured by an older generation will see
    // their myGen !== playGenRef.current and bail out without scheduling
    // or silencing anything new — this is what prevents overlapping audio
    // when the user stops and restarts (e.g. after changing key).
    engine.stopAll();
    playGenRef.current += 1;
    const myGen = playGenRef.current;

    const num = selectedSong.timeSignature.numerator;
    const secPerBeat = 60 / bpm;

    // Flatten to a clean per-bar, per-beat structure for reliable scheduling.
    // BeatSlot shape: { beatInBar, chord }
    const barSlots = bars.map((barChords) => {
      const slots = [];
      let cursor = 0;
      barChords.forEach((c) => {
        slots.push({ beatInBar: cursor, chord: c });
        cursor += c.beats;
      });
      return slots;
    });

    const subDivCount =
      subdivision === "quarter" ? 1 : subdivision === "eighth" ? 2 : 4;

    // Builds one full pass through the song as a flat queue of timed events,
    // starting at `fromTime`. Returns the queue plus the time the pass ends
    // (i.e. where the next pass should begin, for seamless looping).
    function buildPassQueue(fromTime) {
      const passQueue = [];
      let t = fromTime;
      barSlots.forEach((slots, bIdx) => {
        for (let beat = 0; beat < num; beat++) {
          const slot = slots.find((s) => Math.abs(s.beatInBar - beat) < 0.001);
          for (let sub = 0; sub < subDivCount; sub++) {
            const subTime = t + (sub * secPerBeat) / subDivCount;
            passQueue.push({
              time: subTime,
              barIndex: bIdx,
              beatInBar: beat,
              chord: sub === 0 ? (slot?.chord ?? null) : null,
              isDownbeat: beat === 0 && sub === 0,
            });
          }
          t += secPerBeat;
        }
      });
      return { passQueue, endTime: t };
    }

    // Schedules audio (clicks + chords) for every item in a pass's queue.
    // `voicingRef` carries the last-played voicing across passes so the
    // loop's seam still voice-leads smoothly instead of jumping back to a
    // cold root-position chord every time it repeats.
    function scheduleQueue(passQueue) {
      passQueue.forEach((item) => {
        if (metronomeOn) {
          if (accentMode === "all") {
            engine.playClick(item.time, item.isDownbeat);
          } else if (item.isDownbeat) {
            engine.playClick(item.time, true);
          }
        }
        if (item.chord && !item.chord.isRest) {
          lastVoicingRef.current = generateVoicing(
            item.chord.root,
            item.chord.quality,
            voicingStyle,
            lastVoicingRef.current,
          );
          const fullDuration = item.chord.beats * secPerBeat;
          const duration =
            articulation === "staccato"
              ? Math.min(fullDuration * 0.45, fullDuration)
              : fullDuration;
          engine.playChord(
            lastVoicingRef.current.notes,
            lastVoicingRef.current.bass,
            item.time,
            duration,
            timbre,
          );
        }
      });
    }

    // ---- Count-in: one full bar of metronome clicks before the chart's
    // first chord sounds. This only happens once, right here at the very
    // start of playback — the seamless loop-continuation logic further
    // down (buildPassQueue/scheduleQueue for subsequent passes) is
    // untouched, so repeats of the form do NOT get an extra count-in bar.
    function scheduleCountIn(fromTime) {
      for (let beat = 0; beat < num; beat++) {
        engine.playClick(fromTime + beat * secPerBeat, beat === 0);
      }
      return fromTime + num * secPerBeat;
    }

    lastVoicingRef.current = null;
    setIsPlaying(true);

    const countInStart = ctx.currentTime + 0.1;
    const firstStart = scheduleCountIn(countInStart);
    let { passQueue: currentQueue, endTime: currentEndTime } =
      buildPassQueue(firstStart);
    scheduleQueue(currentQueue);

    // Holds the next lap's queue once it's been scheduled, until playback
    // time actually reaches the loop boundary and we swap it in as "current"
    // (so the RAF loop keeps reading from the right queue/index).
    const pendingSwap = { queue: null, endTime: 0 };
    let queueIdx = 0;

    // Visual sync + loop-continuation via RAF, comparing ctx.currentTime to
    // queue timestamps. Schedules the next pass shortly before the current
    // one ends, so playback continues seamlessly until stopPlayback() runs.
    function tick() {
      if (myGen !== playGenRef.current) return; // a stop (or a newer start) happened — abandon this loop

      const now = ctx.currentTime;
      while (
        queueIdx < currentQueue.length &&
        currentQueue[queueIdx].time <= now
      ) {
        if (
          currentQueue[queueIdx].chord ||
          currentQueue[queueIdx].beatInBar === 0
        ) {
          setCurrentBar(currentQueue[queueIdx].barIndex);
        }
        queueIdx++;
      }

      // Schedule the next lap once we're within 1 second of the current
      // lap's end, so there's no audible gap at the loop boundary.
      if (!pendingSwap.queue && currentEndTime - now < 1) {
        const next = buildPassQueue(currentEndTime);
        scheduleQueue(next.passQueue);
        pendingSwap.queue = next.passQueue;
        pendingSwap.endTime = next.endTime;
      }

      // Once playback actually reaches the boundary, swap the pending lap
      // in as "current" so the loop above keeps tracking the right bars.
      if (pendingSwap.queue && now >= currentEndTime) {
        currentQueue = pendingSwap.queue;
        currentEndTime = pendingSwap.endTime;
        queueIdx = 0;
        pendingSwap.queue = null;
      }

      rafRef.current = window.requestAnimationFrame(tick);
    }
    rafRef.current = window.requestAnimationFrame(tick);
  }

  function togglePlay() {
    if (isPlaying) {
      stopPlayback();
    } else {
      startPlayback();
    }
  }

  useEffect(() => {
    if (isPlaying && engineRef.current) {
      engineRef.current.setMetroVolume(metronomeOn ? metroVolume : 0);
    }
  }, [metronomeOn, metroVolume, isPlaying]);

  useEffect(() => stopPlayback, [stopPlayback]);

  // ---- Key options for the dropdown, matching the song's mode ----
  const keyOptions = selectedSong?.mode === "minor" ? ALL_MINOR_KEYS : ALL_KEYS;

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="min-h-screen w-full bg-[#1C1B1A] text-[#F2EDE4] font-sans">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300..900&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');
        .font-display { font-family: 'Fraunces', serif; }
        .font-sans { font-family: 'Inter', system-ui, sans-serif; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        .bar-glow {
          box-shadow: 0 0 0 2px #D4A24C, 0 0 18px rgba(212,162,76,0.35);
        }
        @media (prefers-reduced-motion: reduce) {
          * { transition: none !important; animation: none !important; }
        }
        input[type="range"] {
          -webkit-appearance: none;
          height: 4px;
          border-radius: 2px;
          background: #4a4744;
        }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 14px; height: 14px; border-radius: 50%;
          background: #D4A24C; cursor: pointer;
          margin-top: -5px;
        }
        input[type="range"]::-moz-range-thumb {
          width: 14px; height: 14px; border-radius: 50%;
          background: #D4A24C; cursor: pointer; border: none;
        }
      `}</style>

      {/* ============== ALWAYS-ON-SCREEN HIDE/SHOW CONTROLS BUTTON ============== */}
      {selectedSong && (
        <button
          onClick={() => setControlsHidden((v) => !v)}
          className="fixed top-3 right-3 z-50 flex items-center gap-1.5 px-3 py-2 rounded-full bg-[#272524]/90 border border-[#4a4744] backdrop-blur text-xs font-mono text-[#F2EDE4] shadow-lg hover:border-[#D4A24C] transition-colors"
          aria-label={controlsHidden ? "Show controls" : "Hide controls"}
        >
          <span>{controlsHidden ? "\u25BC" : "\u25B2"}</span>
          {controlsHidden ? "Show controls" : "Hide controls"}
        </button>
      )}

      {/* ============== HEADER / SEARCH ============== */}
      {!controlsHidden && (
        <header className="border-b border-[#3A3836] px-4 sm:px-6 py-4 sticky top-0 bg-[#1C1B1A]/95 backdrop-blur z-30">
          <div className="max-w-5xl mx-auto flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3">
              <h1 className="font-display text-2xl sm:text-3xl tracking-tight text-[#F2EDE4]">
                Jazz<span className="text-[#D4A24C]">Shed</span>
              </h1>
              <span className="text-xs font-mono text-[#8A8580] hidden sm:inline">
                practice changes, any key, any tempo
              </span>
            </div>

            <div className="relative" ref={searchContainerRef}>
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setShowResults(true);
                }}
                onFocus={() => {
                  // If the box currently just shows the selected song's title
                  // verbatim (i.e. the user hasn't typed anything new since
                  // picking it), clear it so refocusing browses the full list
                  // again rather than re-filtering down to that one song.
                  if (selectedSong && query === selectedSong.title) setQuery("");
                  setShowResults(true);
                }}
                placeholder="Search or click to browse all standards\u2026"
                className="w-full bg-[#272524] border border-[#4a4744] focus:border-[#D4A24C] focus:outline-none rounded-lg pl-4 pr-10 py-3 text-[#F2EDE4] placeholder-[#8A8580] text-base"
                aria-label="Search jazz standards"
              />
              <button
                type="button"
                onClick={() => {
                  setShowResults((v) => {
                    const opening = !v;
                    if (opening) setQuery(""); // browsing via the chevron always shows the full list
                    return opening;
                  });
                }}
                aria-label="Toggle song list"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-[#8A8580] hover:text-[#D4A24C] transition-colors"
              >
                <span
                  className={`inline-block transition-transform ${showResults ? "rotate-180" : ""}`}
                >
                  ▾
                </span>
              </button>
              {showResults && searchResults.length > 0 && (
                <ul className="absolute mt-1 w-full bg-[#272524] border border-[#4a4744] rounded-lg overflow-hidden shadow-2xl z-40 max-h-72 overflow-y-auto">
                  {searchResults.map((s) => (
                    <li key={s.title}>
                      <button
                        onClick={() => selectSong(s)}
                        className="w-full text-left px-4 py-2.5 hover:bg-[#3A3836] transition-colors flex items-baseline justify-between gap-2"
                      >
                        <span className="text-[#F2EDE4]">{s.title}</span>
                        <span className="text-xs font-mono text-[#8A8580] shrink-0">
                          {s.key} ·{" "}
                          {typeof s.tempo?.bpm === "number"
                            ? `${s.tempo.bpm} bpm`
                            : "tempo unknown"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {loadError && (
              <p className="text-xs text-[#C99A56] font-mono">{loadError}</p>
            )}
          </div>
        </header>
      )}

      {!selectedSong ? (
        <div className="max-w-5xl mx-auto px-6 py-20 text-center text-[#8A8580]">
          <p className="font-display text-xl text-[#F2EDE4] mb-2">
            Pick a standard to get started.
          </p>
          <p className="text-sm">
            Search above, or try one of:{" "}
            {songs
              .slice(0, 5)
              .map((s) => s.title)
              .join(", ")}
          </p>
        </div>
      ) : (
        <main
          className={`max-w-5xl mx-auto px-4 sm:px-6 flex flex-col gap-6 ${
            controlsHidden ? "py-3" : "py-6"
          }`}
        >
          {/* ============== SONG TITLE + KEY/TEMPO CONTROLS ============== */}
          {!controlsHidden && (
            <section className="flex flex-col gap-4">
              <div>
                <h2 className="font-display text-3xl sm:text-4xl text-[#F2EDE4]">
                  {selectedSong.title}{" "}
                  <span className="text-[#D4A24C] text-2xl sm:text-3xl">
                    ({selectedSong.key})
                  </span>
                </h2>
                {selectedSong.composer && (
                  <p className="text-sm text-[#8A8580] mt-1">
                    {selectedSong.composer}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {/* Key selector */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs uppercase tracking-wide text-[#8A8580] font-mono">
                    Key
                  </label>
                  <div className="flex gap-1.5">
                    <select
                      value={selectedKey}
                      onChange={(e) => setSelectedKey(e.target.value)}
                      className="flex-1 bg-[#272524] border border-[#4a4744] rounded-md px-2.5 py-2 text-sm focus:border-[#D4A24C] focus:outline-none"
                    >
                      {keyOptions.map((k) => (
                        <option key={k} value={k}>
                          {k}
                          {k === selectedSong.key ? " (orig.)" : ""}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={pickRandomKey}
                      title="Random key"
                      className="px-2.5 py-2 bg-[#3A3836] hover:bg-[#4a4744] rounded-md text-sm transition-colors"
                    >
                      🎲
                    </button>
                  </div>
                </div>

                {/* Tempo */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs uppercase tracking-wide text-[#8A8580] font-mono">
                    Tempo (bpm)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    inputMode="numeric"
                    value={bpmInput}
                    onChange={(e) => {
                      // Keep whatever the user typed as free-form text — no
                      // clamping/parsing here. This is what lets someone
                      // type "1", then "9", then "0" to reach 190 without
                      // each keystroke snapping to a different clamped
                      // value mid-way through typing.
                      setBpmInput(e.target.value);
                    }}
                    onBlur={commitBpmInput}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.currentTarget.blur();
                      }
                    }}
                    className="bg-[#272524] border border-[#4a4744] rounded-md px-2.5 py-2 text-sm focus:border-[#D4A24C] focus:outline-none font-mono"
                  />
                </div>

                {/* Voicing style */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs uppercase tracking-wide text-[#8A8580] font-mono">
                    Voicing
                  </label>
                  <select
                    value={voicingStyle}
                    onChange={(e) => setVoicingStyle(e.target.value)}
                    className="bg-[#272524] border border-[#4a4744] rounded-md px-2.5 py-2 text-sm focus:border-[#D4A24C] focus:outline-none"
                  >
                    {VOICING_STYLES.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Articulation */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs uppercase tracking-wide text-[#8A8580] font-mono">
                    Articulation
                  </label>
                  <select
                    value={articulation}
                    onChange={(e) => setArticulation(e.target.value)}
                    className="bg-[#272524] border border-[#4a4744] rounded-md px-2.5 py-2 text-sm focus:border-[#D4A24C] focus:outline-none"
                  >
                    <option value="block">Block (sustain)</option>
                    <option value="staccato">Staccato</option>
                  </select>
                </div>

                {/* Sound / timbre */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs uppercase tracking-wide text-[#8A8580] font-mono">
                    Sound
                  </label>
                  <select
                    value={timbre}
                    onChange={(e) => setTimbre(e.target.value)}
                    className="bg-[#272524] border border-[#4a4744] rounded-md px-2.5 py-2 text-sm focus:border-[#D4A24C] focus:outline-none"
                  >
                    <option value="piano">Piano</option>
                    <option value="epiano">Electric Piano</option>
                    <option value="synth">Synth</option>
                  </select>
                </div>
              </div>
            </section>
          )}

          {/* ============== METRONOME PANEL ============== */}
          {!controlsHidden && (
            <section className="bg-[#252320] border border-[#3A3836] rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="font-mono text-xs uppercase tracking-wide text-[#8A8580]">
                  Metronome
                </h3>
                <button
                  role="switch"
                  aria-checked={metronomeOn}
                  onClick={() => setMetronomeOn((v) => !v)}
                  className={`w-11 h-6 rounded-full transition-colors relative ${
                    metronomeOn ? "bg-[#5B7065]" : "bg-[#4a4744]"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-[#F2EDE4] rounded-full transition-transform ${
                      metronomeOn ? "translate-x-5" : ""
                    }`}
                  />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-[#8A8580]">Subdivision</label>
                  <div className="flex bg-[#1C1B1A] rounded-md p-1 gap-1">
                    {["quarter", "eighth", "sixteenth"].map((sd) => (
                      <button
                        key={sd}
                        onClick={() => setSubdivision(sd)}
                        className={`flex-1 text-xs py-1.5 rounded-md transition-colors capitalize ${
                          subdivision === sd
                            ? "bg-[#D4A24C] text-[#1C1B1A] font-semibold"
                            : "text-[#8A8580] hover:text-[#F2EDE4]"
                        }`}
                      >
                        {sd === "quarter"
                          ? "\u2669"
                          : sd === "eighth"
                            ? "\u266A"
                            : "\u266C"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-[#8A8580]">Click on</label>
                  <div className="flex bg-[#1C1B1A] rounded-md p-1 gap-1">
                    <button
                      onClick={() => setAccentMode("downbeat")}
                      className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${
                        accentMode === "downbeat"
                          ? "bg-[#D4A24C] text-[#1C1B1A] font-semibold"
                          : "text-[#8A8580] hover:text-[#F2EDE4]"
                      }`}
                    >
                      Beat 1 only
                    </button>
                    <button
                      onClick={() => setAccentMode("all")}
                      className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${
                        accentMode === "all"
                          ? "bg-[#D4A24C] text-[#1C1B1A] font-semibold"
                          : "text-[#8A8580] hover:text-[#F2EDE4]"
                      }`}
                    >
                      All beats
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 col-span-2 sm:col-span-1">
                  <label className="text-xs text-[#8A8580]">Volume</label>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={metroVolume}
                    onChange={(e) => setMetroVolume(Number(e.target.value))}
                    className="w-full mt-2"
                  />
                </div>
              </div>
            </section>
          )}

          {/* ============== CHORD CHART ============== */}
          <section className="flex flex-col gap-2 flex-1 min-h-0">
            {!controlsHidden && (
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h3 className="font-mono text-xs uppercase tracking-wide text-[#8A8580]">
                  Chord chart
                </h3>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] uppercase tracking-wide text-[#8A8580] font-mono">
                      Reading as
                    </span>
                    <div className="flex bg-[#1C1B1A] rounded-md p-1 gap-1">
                      {["C", "Bb", "Eb"].map((inst) => (
                        <button
                          key={inst}
                          onClick={() => setDisplayInstrument(inst)}
                          title={INSTRUMENT_LABELS[inst]}
                          className={`text-xs px-2.5 py-1 rounded-md transition-colors font-mono ${
                            displayInstrument === inst
                              ? "bg-[#D4A24C] text-[#1C1B1A] font-semibold"
                              : "text-[#8A8580] hover:text-[#F2EDE4]"
                          }`}
                        >
                          {inst === "C"
                            ? "C"
                            : inst === "Bb"
                              ? "B\u266D"
                              : "E\u266D"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => setShowChart((v) => !v)}
                    className="text-xs font-mono text-[#8A8580] hover:text-[#D4A24C] transition-colors underline"
                  >
                    {showChart ? "Hide (play by ear)" : "Show chart"}
                  </button>
                </div>
              </div>
            )}
            {!controlsHidden && displayInstrument !== "C" && (
              <p className="text-[10px] text-[#8A8580] font-mono -mt-1">
                Showing transposed for {INSTRUMENT_LABELS[displayInstrument]} —
                sounding pitch is unaffected.
              </p>
            )}

            {showChart && (
              <div
                className={
                  controlsHidden
                    ? "bg-[#252320] border border-[#3A3836] rounded-xl p-3 flex flex-col gap-2 flex-1 min-h-0"
                    : "bg-[#252320] border border-[#3A3836] rounded-xl p-3 sm:p-5 flex flex-col gap-4"
                }
                style={
                  controlsHidden
                    ? { height: "calc(100dvh - 1.5rem)" }
                    : undefined
                }
              >
                {introBars.length > 0 && !controlsHidden && (
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <span className="text-[10px] uppercase tracking-wider text-[#8A8580] font-mono">
                      Intro &middot; plays once
                    </span>
                    <div
                      className="grid gap-1.5"
                      style={{
                        gridTemplateColumns:
                          "repeat(auto-fill, minmax(150px, 1fr))",
                      }}
                    >
                      {displayIntroBars.map((barChords, i) => (
                        <div
                          key={i}
                          className="font-mono text-sm sm:text-base border border-[#4a4744] rounded-md px-2.5 py-2.5 flex items-center justify-center gap-1.5 flex-wrap bg-[#1f1d1b] opacity-70"
                        >
                          {barChords.map((c, j) => (
                            <React.Fragment key={j}>
                              {j > 0 && (
                                <span className="text-[#8A8580]">·</span>
                              )}
                              <ChordSymbol
                                root={c.root}
                                quality={c.quality}
                                isRest={c.isRest}
                                bassNote={c.bassNote}
                              />
                            </React.Fragment>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div
                  ref={formGridContainerRef}
                  className={
                    controlsHidden
                      ? "flex-1 min-h-0 flex flex-col gap-1"
                      : "flex flex-col gap-1.5"
                  }
                >
                  {(introBars.length > 0 || outroBars.length > 0) &&
                    !controlsHidden && (
                      <span className="text-[10px] uppercase tracking-wider text-[#D4A24C] font-mono shrink-0">
                        Form &middot; loops during playback
                      </span>
                    )}

                  {controlsHidden ? (
                    // ---- Phone "focus mode": pack every bar into the
                    // viewport with no scrolling. Font size and column
                    // count are computed from the actual chord text of
                    // every bar (see computeFitLayout / estimateBarChars),
                    // so a bar with two chords (e.g. "A-7 · D7") is never
                    // clipped — cells use nowrap + visible overflow as a
                    // safety net in case the estimate runs a touch tight.
                    <div
                      className="grid gap-1.5 flex-1 min-h-0 min-w-0"
                      style={{
                        gridTemplateColumns: `repeat(${fitLayout.columns}, 1fr)`,
                        gridTemplateRows: `repeat(${fitLayout.rows}, 1fr)`,
                        fontSize: `${fitLayout.fontSize}px`,
                      }}
                    >
                      {displayBars.map((barChords, i) => (
                        <div
                          key={i}
                          className={`font-mono border border-[#4a4744] rounded-md px-1 flex items-center justify-center gap-1 flex-nowrap whitespace-nowrap min-w-0 min-h-0 transition-all duration-150 ${
                            currentBar === i
                              ? "bar-glow bg-[#3A3836]"
                              : "bg-[#1f1d1b]"
                          }`}
                        >
                          {barChords.map((c, j) => (
                            <React.Fragment key={j}>
                              {j > 0 && (
                                <span className="text-[#8A8580]">·</span>
                              )}
                              <ChordSymbol
                                root={c.root}
                                quality={c.quality}
                                isRest={c.isRest}
                                bassNote={c.bassNote}
                              />
                            </React.Fragment>
                          ))}
                        </div>
                      ))}
                    </div>
                  ) : (
                    // ---- Normal view: natural page flow, no forced
                    // height, page scrolls if the form is long. Multi-chord
                    // bars simply wrap to a second line inside their own
                    // cell rather than ever being clipped.
                    <div
                      className="grid gap-1.5"
                      style={{
                        gridTemplateColumns:
                          "repeat(auto-fill, minmax(140px, 1fr))",
                      }}
                    >
                      {displayBars.map((barChords, i) => (
                        <div
                          key={i}
                          className={`font-mono text-sm sm:text-base border border-[#4a4744] rounded-md px-2.5 py-2.5 flex items-center justify-center gap-1.5 flex-wrap transition-all duration-150 ${
                            currentBar === i
                              ? "bar-glow bg-[#3A3836]"
                              : "bg-[#1f1d1b]"
                          }`}
                        >
                          {barChords.map((c, j) => (
                            <React.Fragment key={j}>
                              {j > 0 && (
                                <span className="text-[#8A8580]">·</span>
                              )}
                              <ChordSymbol
                                root={c.root}
                                quality={c.quality}
                                isRest={c.isRest}
                                bassNote={c.bassNote}
                              />
                            </React.Fragment>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {outroBars.length > 0 && !controlsHidden && (
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <span className="text-[10px] uppercase tracking-wider text-[#8A8580] font-mono">
                      Tag / Coda &middot; not played while looping
                    </span>
                    <div
                      className="grid gap-1.5"
                      style={{
                        gridTemplateColumns:
                          "repeat(auto-fill, minmax(150px, 1fr))",
                      }}
                    >
                      {displayOutroBars.map((barChords, i) => (
                        <div
                          key={i}
                          className="font-mono text-sm sm:text-base border border-[#4a4744] rounded-md px-2.5 py-2.5 flex items-center justify-center gap-1.5 flex-wrap bg-[#1f1d1b] opacity-70"
                        >
                          {barChords.map((c, j) => (
                            <React.Fragment key={j}>
                              {j > 0 && (
                                <span className="text-[#8A8580]">·</span>
                              )}
                              <ChordSymbol
                                root={c.root}
                                quality={c.quality}
                                isRest={c.isRest}
                                bassNote={c.bassNote}
                              />
                            </React.Fragment>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        </main>
      )}

      {/* ============== TRANSPORT (fixed) ============== */}
      {selectedSong && !controlsHidden && (
        <div className="sticky bottom-0 border-t border-[#3A3836] bg-[#1C1B1A]/95 backdrop-blur px-4 sm:px-6 py-4">
          <div className="max-w-5xl mx-auto flex items-center justify-center gap-4">
            <button
              onClick={togglePlay}
              className={`px-8 py-3 rounded-full font-semibold text-base transition-colors flex items-center gap-2 ${
                isPlaying
                  ? "bg-[#8B3A3A] hover:bg-[#9c4444] text-[#F2EDE4]"
                  : "bg-[#D4A24C] hover:bg-[#e0b15e] text-[#1C1B1A]"
              }`}
            >
              {isPlaying ? "\u25A0 Stop" : "\u25B6 Play changes"}
            </button>
            <span className="text-xs font-mono text-[#8A8580]">
              {bpm} bpm · {selectedSong.timeSignature.numerator}/
              {selectedSong.timeSignature.denominator}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
