// ============================================================================
// SHARED MUSIC ENGINE
// ============================================================================
// Theory utilities, chord-voicing generation, and the Web Audio playback
// engine, extracted from ChordProgressionPracticer.tsx so they can be reused
// by any practice mode (song chart player, pattern/cycle drill, lick
// playback, etc.) without duplicating logic or drifting out of sync.
// ============================================================================

// ----------------------------------------------------------------------------
// Note / key utilities
// ----------------------------------------------------------------------------

export const NOTE_TO_SEMITONE: Record<string, number> = {
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

export const SEMITONE_TO_SHARP = [
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
export const SEMITONE_TO_FLAT = [
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
export const FLAT_KEY_ROOTS = new Set([
  "F",
  "Bb",
  "Eb",
  "Ab",
  "Db",
  "Gb",
  "Cb",
]);

export const ALL_KEYS = [
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
export const ALL_MINOR_KEYS = ALL_KEYS.map((k) => `${k}m`);

export function keyRoot(key: string): string {
  return key.endsWith("m") && key.length > 1 ? key.slice(0, -1) : key;
}

export function keySemitone(key: string): number {
  const r = keyRoot(key);
  return NOTE_TO_SEMITONE[r] ?? 0;
}

export function flatsPreferredForKey(key: string): boolean {
  return FLAT_KEY_ROOTS.has(keyRoot(key));
}

// Spells a semitone (0-11) as a note name, preferring flats or sharps.
export function spellSemitone(semitone: number, preferFlats: boolean): string {
  const s = ((semitone % 12) + 12) % 12;
  return preferFlats ? SEMITONE_TO_FLAT[s] : SEMITONE_TO_SHARP[s];
}

export function transposeRoot(
  root: string,
  semitoneShift: number,
  targetKey: string,
): string {
  const base = NOTE_TO_SEMITONE[root];
  if (base === undefined) return root;
  const newSemitone = (((base + semitoneShift) % 12) + 12) % 12;
  return spellSemitone(newSemitone, flatsPreferredForKey(targetKey));
}

// ----------------------------------------------------------------------------
// Transposing instrument display (Bb / Eb chart transposition — cosmetic
// only, never affects audio pitch)
// ----------------------------------------------------------------------------

export type Instrument = "C" | "Bb" | "Eb";

export const INSTRUMENT_SHIFT: Record<Instrument, number> = {
  C: 0,
  Bb: 2,
  Eb: 9,
};
export const INSTRUMENT_LABELS: Record<Instrument, string> = {
  C: "Concert C",
  Bb: "B\u266D Instrument",
  Eb: "E\u266D Instrument",
};

export function transposeForInstrument(
  root: string,
  instrument: Instrument,
  concertTargetKey: string,
): string {
  const shift = INSTRUMENT_SHIFT[instrument] ?? 0;
  if (shift === 0) return root;
  const displayKey = transposeRoot(
    keyRoot(concertTargetKey),
    shift,
    concertTargetKey,
  );
  return transposeRoot(root, shift, displayKey);
}

// ----------------------------------------------------------------------------
// Chord qualities
// ----------------------------------------------------------------------------

export const QUALITY_INTERVALS: Record<string, number[]> = {
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
  "": [],
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

export function qualityIntervals(quality: string): number[] {
  return QUALITY_INTERVALS[quality] || QUALITY_INTERVALS["7"];
}

const QUALITY_LABEL_MAP: Record<string, string> = {
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
  "": "",
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
  maj: "",
  maj6: "6",
  maj69: "6/9",
  "maj7#11": "maj7#11",
  "maj7#5": "maj7#5",
};

export function qualityLabel(quality: string): string {
  return QUALITY_LABEL_MAP[quality] ?? quality;
}

// ----------------------------------------------------------------------------
// Voicing generation
// ----------------------------------------------------------------------------

export type VoicingStyleId = "root" | "closed" | "open" | "block" | "drop2";

export interface VoicedChord {
  notes: number[];
  closedNotes: number[];
  bass: number;
}

export const VOICING_STYLES: { id: VoicingStyleId; label: string }[] = [
  { id: "closed", label: "Closed" },
  { id: "open", label: "Open" },
  { id: "drop2", label: "Drop 2" },
  { id: "block", label: "Block" },
  { id: "root", label: "Root position" },
];

function rootMidi(root: string, octave: number): number {
  return (octave + 1) * 12 + (NOTE_TO_SEMITONE[root] ?? 0);
}

function closestOctaveNote(pitchClass: number, referenceMidi: number): number {
  const base = referenceMidi - (((referenceMidi % 12) + 12) % 12) + pitchClass;
  let best = base;
  for (const cand of [base - 12, base, base + 12]) {
    if (Math.abs(cand - referenceMidi) < Math.abs(best - referenceMidi))
      best = cand;
  }
  return best;
}

const VOICING_RANGE_MIN = 48; // C3
const VOICING_RANGE_MAX = 84; // C6
const VOICING_CENTER = 65; // F above middle C
const VOICING_CENTER_PULL = 0.22;

function clampReference(ref: number): number {
  return Math.max(VOICING_RANGE_MIN, Math.min(VOICING_RANGE_MAX, ref));
}

function pullTowardCenter(naturalReference: number): number {
  const blended =
    naturalReference * (1 - VOICING_CENTER_PULL) +
    VOICING_CENTER * VOICING_CENTER_PULL;
  return clampReference(blended);
}

// Generates a voicing for a chord, optionally voice-led from the previous
// voicing. The reference used to voice-lead the NEXT chord is always derived
// from the closed-position pitch classes, never a style's spread/dropped
// notes, so consecutive style transforms don't compound drift out of range.
export function generateVoicing(
  root: string,
  quality: string,
  style: VoicingStyleId,
  prevVoicing: VoicedChord | null,
  centerMidi: number = 65,
): VoicedChord {
  const rootPc = NOTE_TO_SEMITONE[root] ?? 0;
  const pitchClasses = [
    ...new Set(
      qualityIntervals(quality).map((i) => (((i + rootPc) % 12) + 12) % 12),
    ),
  ];
  const bass = rootMidi(root, 2);

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
    const base = rootMidi(root, 3);
    const notes = qualityIntervals(quality).map(
      (i) => base + (i % 12 === i ? i : i % 12),
    );
    return { notes: notes.sort((a, b) => a - b), closedNotes: closed, bass };
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
    const spread = closed.map((n, i) => (i % 2 === 1 ? n + 12 : n));
    return { notes: spread.sort((a, b) => a - b), closedNotes: closed, bass };
  }

  if (style === "block") {
    const lowRoot = closestOctaveNote(rootPc, reference - 12);
    return {
      notes: [lowRoot, ...closed].sort((a, b) => a - b),
      closedNotes: closed,
      bass,
    };
  }

  return { notes: closed, closedNotes: closed, bass };
}

// ----------------------------------------------------------------------------
// Flattened chord representation shared by every practice mode's chart /
// scheduler. `sectionLabel` is free-form (song section name, "Pattern", etc).
// ----------------------------------------------------------------------------

export interface FlatChord {
  root: string;
  quality: string;
  beats: number;
  isNewBar: boolean;
  barIndex: number;
  sectionLabel: string;
  isRest?: boolean;
  bassNote?: string;
}

export function groupIntoBars(chords: FlatChord[]): FlatChord[][] {
  const out: FlatChord[][] = [];
  chords.forEach((c) => {
    if (!out[c.barIndex]) out[c.barIndex] = [];
    out[c.barIndex].push(c);
  });
  return out;
}

// ----------------------------------------------------------------------------
// Web Audio playback engine
// ----------------------------------------------------------------------------

export type Timbre = "piano" | "epiano" | "synth";

// ----------------------------------------------------------------------------
// Sample-based instruments — ported from the ear trainer app's instrument
// list verbatim, so the same sample pack (expected at
// /public/samples/{id}-mp3/{NoteName}{Octave}.mp3, e.g. "C4.mp3") works
// here without renaming anything.
// ----------------------------------------------------------------------------

export const SAMPLE_INSTRUMENTS: { id: string; label: string }[] = [
  { id: "accordion", label: "Accordion" },
  { id: "acoustic_grand_piano", label: "Grand Piano" },
  { id: "alto_sax", label: "Alto Sax" },
  { id: "baritone_sax", label: "Baritone Sax" },
  { id: "bassoon", label: "Bassoon" },
  { id: "bright_acoustic_piano", label: "Bright Piano" },
  { id: "celesta", label: "Celesta" },
  { id: "cello", label: "Cello" },
  { id: "clarinet", label: "Clarinet" },
  { id: "dulcimer", label: "Dulcimer" },
  { id: "electric_guitar_clean", label: "Clean Guitar" },
  { id: "electric_guitar_jazz", label: "Jazz Guitar" },
  { id: "electric_piano_1", label: "E. Piano 1" },
  { id: "electric_piano_2", label: "E. Piano 2" },
  { id: "english_horn", label: "English Horn" },
  { id: "flute", label: "Flute" },
  { id: "french_horn", label: "French Horn" },
  { id: "muted_trumpet", label: "Muted Trumpet" },
  { id: "oboe", label: "Oboe" },
  { id: "tenor_sax", label: "Tenor Sax" },
  { id: "trombone", label: "Trombone" },
  { id: "trumpet", label: "Trumpet" },
  { id: "viola", label: "Viola" },
  { id: "violin", label: "Violin" },
];

export type SampleInstrumentId = (typeof SAMPLE_INSTRUMENTS)[number]["id"];

// A SoundSource is either "play this through the built-in oscillator synth
// with this timbre" (existing behavior, unchanged) or "play this through
// real recorded samples of this instrument" (new). Every place that used to
// take a bare `Timbre` now takes one of these instead, so the caller picks
// the sound the same way regardless of which underlying engine produces it.
export type SoundSource =
  | { kind: "synth"; timbre: Timbre }
  | { kind: "sample"; instrumentId: SampleInstrumentId };

export const DEFAULT_SOUND_SOURCE: SoundSource = {
  kind: "synth",
  timbre: "piano",
};

export class AudioEngine {
  ctx: AudioContext | null = null;
  masterGain: GainNode | null = null;
  metroGain: GainNode | null = null;
  chordGain: GainNode | null = null;
  // Holds both oscillators (synth) and buffer sources (samples) — widening
  // this from oscillator-only to include AudioBufferSourceNode is what lets
  // stopAll() immediately silence either sound source uniformly, with no
  // separate cleanup path needed for samples.
  activeNodes: Set<OscillatorNode | AudioBufferSourceNode> = new Set();

  // Decoded sample buffers, cached by "{instrumentId}_{midi}" so a note is
  // only ever fetched/decoded once per instrument per session.
  private bufferCache: Map<string, AudioBuffer> = new Map();
  // In-flight fetches, keyed the same way, so concurrent requests for the
  // same note (e.g. preloading several notes of a chord at once) share one
  // network request instead of firing duplicates.
  private pendingFetches: Map<string, Promise<AudioBuffer | null>> = new Map();

  ensureContext(): AudioContext {
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
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

  setMetroVolume(v: number): void {
    if (this.metroGain) this.metroGain.gain.value = v;
  }

  // ----------------------------------------------------------------------
  // Sample loading (ported from the ear trainer app's getBuffer)
  // ----------------------------------------------------------------------
  // Converts a MIDI note number to the sample filename convention used by
  // the shared sample pack: flat spelling + octave, e.g. 60 -> "C4".
  private midiToSampleName(midi: number): string {
    const FLAT = [
      "C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B",
    ];
    return `${FLAT[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
  }

  private sampleBaseUrl(): string {
    // Vite exposes the configured base path here; falls back to "/" for
    // any non-Vite environment so this doesn't throw.
    try {
      const base = (import.meta as any)?.env?.BASE_URL ?? "/";
      return String(base).replace(/\/$/, "");
    } catch {
      return "";
    }
  }

  // Fetches (and caches) the sample for `targetMidi` on `instrumentId`. If
  // no sample exists for that exact pitch, searches outward (±1, ±2, ...
  // up to an octave) for the nearest pitch that DOES have a sample, and
  // reports back how many semitones of pitch-shift (via playbackRate) are
  // needed to make that sample sound like the target note. This means a
  // sample pack doesn't need a recording of every single semitone to sound
  // right across the full range used in a chord voicing.
  private async getSampleBuffer(
    instrumentId: string,
    targetMidi: number,
  ): Promise<{ buffer: AudioBuffer; semitoneShift: number } | null> {
    const exactKey = `${instrumentId}_${targetMidi}`;
    const exact = this.bufferCache.get(exactKey);
    if (exact) {
      return { buffer: exact, semitoneShift: 0 };
    }

    const offsets = [0, -1, 1, -2, 2, -3, 3, -4, 4, -5, 5, -6, 6, -7, 7, -8, 8, -9, 9, -10, 10, -11, 11, -12, 12];
    for (const off of offsets) {
      const midi = targetMidi + off;
      const key = `${instrumentId}_${midi}`;
      if (off !== 0) {
        const cached = this.bufferCache.get(key);
        if (cached) return { buffer: cached, semitoneShift: -off };
      }
      if (off === 0) {
        const buf = await this.fetchAndDecode(instrumentId, midi, key);
        if (buf) return { buffer: buf, semitoneShift: 0 };
      }
    }
    return null;
  }

  private fetchAndDecode(
    instrumentId: string,
    midi: number,
    cacheKey: string,
  ): Promise<AudioBuffer | null> {
    const pending = this.pendingFetches.get(cacheKey);
    if (pending) return pending;

    const promise = (async () => {
      try {
        const ctx = this.ensureContext();
        const url = `${this.sampleBaseUrl()}/samples/${instrumentId}-mp3/${this.midiToSampleName(midi)}.mp3`;
        const res = await fetch(url);
        if (!res.ok) return null;
        const buf = await ctx.decodeAudioData(await res.arrayBuffer());
        this.bufferCache.set(cacheKey, buf);
        return buf;
      } catch {
        return null;
      } finally {
        this.pendingFetches.delete(cacheKey);
      }
    })();

    this.pendingFetches.set(cacheKey, promise);
    return promise;
  }

  // Ensures every note that's about to be needed is already decoded and
  // cached BEFORE playback starts. Sample fetching is asynchronous
  // (network + decode), but the scheduler plays notes at precisely
  // computed lookahead times — without preloading, the first occurrence
  // of a given pitch could start late while its sample is still loading.
  // Call this (and await it) once before starting playback whenever the
  // sound source is sample-based.
  async preloadSamples(
    instrumentId: SampleInstrumentId,
    midiNotes: number[],
  ): Promise<void> {
    const unique = Array.from(new Set(midiNotes));
    await Promise.all(
      unique.map((midi) => this.getSampleBuffer(instrumentId, midi)),
    );
  }

  // Eagerly loads every note across a practical playing range for an
  // instrument, all at once, rather than waiting to discover which exact
  // pitches a given piece needs. Meant to be called once — right when the
  // user selects a sample instrument, with a loading indicator in the UI
  // — so that every song/pattern/lick played afterward is instant with no
  // further preload step. Notes the sample pack doesn't actually have an
  // individual file for simply 404 and are skipped silently; the
  // nearest-neighbor fallback in getSampleBuffer already covers those
  // gaps at playback time using whichever nearby notes DID load.
  //
  // Default range (MIDI 36–96, roughly C2–C7) comfortably covers this
  // app's chord-voicing range (48–84) plus typical melodic lick content;
  // widen it if a particular instrument/use case needs more.
  async preloadInstrumentRange(
    instrumentId: SampleInstrumentId,
    minMidi = 36,
    maxMidi = 96,
  ): Promise<void> {
    const notes: number[] = [];
    for (let m = minMidi; m <= maxMidi; m++) notes.push(m);
    await this.preloadSamples(instrumentId, notes);
  }

  stopAll(): void {
    const ctx = this.ctx;
    this.activeNodes.forEach((osc) => {
      try {
        osc.stop(ctx ? ctx.currentTime : 0);
      } catch (e) {
        // already stopped — safe to ignore
      }
      try {
        osc.disconnect();
      } catch (e) {
        // already disconnected — safe to ignore
      }
    });
    this.activeNodes.clear();
  }

  playClick(time: number, accent: boolean): void {
    const ctx = this.ensureContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = accent ? 1500 : 1000;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(accent ? 1 : 0.6, time + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.035);
    osc.connect(gain);
    gain.connect(this.metroGain!);
    osc.start(time);
    osc.stop(time + 0.04);
    this.activeNodes.add(osc);
    osc.onended = () => this.activeNodes.delete(osc);
  }

  _playVoice(
    midi: number,
    gainScale: number,
    dest: GainNode,
    time: number,
    duration: number,
    timbre: Timbre,
  ): void {
    const ctx = this.ctx!;
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    const attack =
      timbre === "piano" ? 0.006 : timbre === "epiano" ? 0.008 : 0.015;
    const stopAt = time + duration + 0.08;

    const makeOsc = (
      type: OscillatorType,
      freqMult: number,
      detuneCents = 0,
    ): OscillatorNode => {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq * freqMult;
      if (detuneCents) osc.detune.value = detuneCents;
      this.activeNodes.add(osc);
      osc.onended = () => this.activeNodes.delete(osc);
      return osc;
    };

    const connectWithEnvelope = (
      osc: OscillatorNode,
      peakGain: number,
      decayShape: (g: GainNode, peak: number) => void,
    ): void => {
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
      const fundamental = makeOsc("triangle", 1);
      connectWithEnvelope(fundamental, 0.5, (g) => {
        g.gain.setTargetAtTime(0.0001, time + attack, duration * 0.45);
      });
      const partial2 = makeOsc("sine", 2.0);
      connectWithEnvelope(partial2, 0.16, (g) => {
        g.gain.setTargetAtTime(0.0001, time + attack, duration * 0.18);
      });
      const partial3 = makeOsc("sine", 3.01);
      connectWithEnvelope(partial3, 0.07, (g) => {
        g.gain.setTargetAtTime(0.0001, time + attack, duration * 0.08);
      });
      return;
    }

    if (timbre === "epiano") {
      const fundamental = makeOsc("sine", 1);
      connectWithEnvelope(fundamental, 0.5, (g) => {
        g.gain.setTargetAtTime(0.0001, time + attack, duration * 0.6);
      });
      const bark = makeOsc("sine", 4.0, 8);
      connectWithEnvelope(bark, 0.12, (g) => {
        g.gain.setTargetAtTime(0.0001, time + attack, 0.05);
      });
      return;
    }

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

  // Plays one note through real recorded samples rather than an
  // oscillator. The gain envelope here is what prevents "bleed" between
  // fast chord changes: it ramps to near-silence by `time + duration` and
  // hard-stops the underlying buffer source shortly after, regardless of
  // how long the raw sample recording naturally rings on for. Without
  // this, a piano sample's multi-second decay tail would still be
  // audible under the start of the next chord.
  private _playSampledVoice(
    instrumentId: SampleInstrumentId,
    midi: number,
    gainScale: number,
    dest: GainNode,
    time: number,
    duration: number,
  ): void {
    const ctx = this.ensureContext();
    this.getSampleBuffer(instrumentId, midi).then((result) => {
      // If playback was stopped (or this note's time has already passed)
      // before the sample finished loading, don't start it late.
      if (!result || ctx.currentTime > time + duration) return;

      const source = ctx.createBufferSource();
      source.buffer = result.buffer;
      if (result.semitoneShift) {
        source.playbackRate.value = Math.pow(2, result.semitoneShift / 12);
      }

      const gain = ctx.createGain();
      gain.gain.value = 0;
      source.connect(gain);
      gain.connect(dest);

      const attack = 0.02;
      const release = Math.min(0.3, duration * 0.4);
      const sustainEnd = Math.max(time + attack, time + duration - release);
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.5 * gainScale, time + attack);
      gain.gain.setValueAtTime(0.5 * gainScale, sustainEnd);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

      source.start(time);
      source.stop(time + duration + 0.1); // hard cutoff — no ring-past-duration
      this.activeNodes.add(source);
      source.onended = () => this.activeNodes.delete(source);
    });
  }

  playChord(
    midiNotes: number[],
    bassNote: number,
    time: number,
    duration: number,
    soundSource: SoundSource = DEFAULT_SOUND_SOURCE,
  ): void {
    this.ensureContext();
    if (soundSource.kind === "sample") {
      const { instrumentId } = soundSource;
      midiNotes.forEach((n) =>
        this._playSampledVoice(instrumentId, n, 1, this.chordGain!, time, duration),
      );
      this._playSampledVoice(instrumentId, bassNote, 1.3, this.chordGain!, time, duration);
      return;
    }
    const { timbre } = soundSource;
    midiNotes.forEach((n) =>
      this._playVoice(n, 1, this.chordGain!, time, duration, timbre),
    );
    this._playVoice(bassNote, 1.3, this.chordGain!, time, duration, timbre);
  }

  // Plays a single melodic note (for lick playback) through the same
  // timbre/envelope machinery used for chords, at a lighter gain so it
  // reads as a lead line rather than a chord stab.
  playNote(
    midi: number,
    time: number,
    duration: number,
    soundSource: SoundSource = DEFAULT_SOUND_SOURCE,
  ): void {
    this.ensureContext();
    if (soundSource.kind === "sample") {
      this._playSampledVoice(soundSource.instrumentId, midi, 0.9, this.chordGain!, time, duration);
      return;
    }
    this._playVoice(midi, 0.9, this.chordGain!, time, duration, soundSource.timbre);
  }
}
