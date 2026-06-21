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

// Generates a voicing for a chord, optionally voice-led from the previous voicing.
function generateVoicing(root, quality, style, prevVoicing, centerMidi = 65) {
  const rootPc = NOTE_TO_SEMITONE[root] ?? 0;
  const pitchClasses = [
    ...new Set(
      qualityIntervals(quality).map((i) => (((i + rootPc) % 12) + 12) % 12),
    ),
  ];
  const bass = rootMidi(root, 2);

  // Reference point to voice-lead against: average of the previous chord's notes,
  // or a comfortable center register if this is the first chord.
  const reference =
    prevVoicing && prevVoicing.notes.length
      ? prevVoicing.notes.reduce((a, b) => a + b, 0) / prevVoicing.notes.length
      : centerMidi;

  if (style === "root") {
    // Root-position stack built straight up from the bass note's octave.
    const base = rootMidi(root, 3);
    const notes = qualityIntervals(quality).map(
      (i) => base + (i % 12 === i ? i : i % 12),
    );
    return { notes: notes.sort((a, b) => a - b), bass };
  }

  if (style === "closed") {
    const notes = pitchClasses
      .map((pc) => closestOctaveNote(pc, reference))
      .sort((a, b) => a - b);
    return { notes, bass };
  }

  if (style === "drop2") {
    const closed = pitchClasses
      .map((pc) => closestOctaveNote(pc, reference))
      .sort((a, b) => a - b);
    if (closed.length < 3) return { notes: closed, bass };
    const idx = closed.length - 2;
    const dropped = [...closed];
    dropped[idx] -= 12;
    return { notes: dropped.sort((a, b) => a - b), bass };
  }

  if (style === "open") {
    // Spread voicing: alternate notes pushed up/down an octave from closed position
    // for a wider, more open sound (roughly: keep 1 & 3 low, spread 2 & 4 up).
    const closed = pitchClasses
      .map((pc) => closestOctaveNote(pc, reference))
      .sort((a, b) => a - b);
    const spread = closed.map((n, i) => (i % 2 === 1 ? n + 12 : n));
    return { notes: spread.sort((a, b) => a - b), bass };
  }

  if (style === "block") {
    // Block/"shout" style: closed voicing doubled with the root an octave below,
    // giving a fuller, more percussive chord.
    const closed = pitchClasses
      .map((pc) => closestOctaveNote(pc, reference))
      .sort((a, b) => a - b);
    const lowRoot = closestOctaveNote(rootPc, reference - 12);
    return { notes: [lowRoot, ...closed].sort((a, b) => a - b), bass };
  }

  // fallback
  return {
    notes: pitchClasses.map((pc) => closestOctaveNote(pc, reference)),
    bass,
  };
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

function flattenSong(song) {
  const num = song.timeSignature.numerator;
  const out = [];
  let barOffset = 0;

  const appendSection = (label) => {
    const section = song.sections[label];
    if (!section) return;
    const flat = flattenSection(label, section, num);
    const repeated = section.repeat ? [...flat, ...flat] : flat;
    const reindexed = repeated.map((c) => ({
      ...c,
      barIndex: c.barIndex + barOffset,
    }));
    out.push(...reindexed);
    const barsInSection = section.measures.reduce(
      (sum, m) => sum + (m.spansBars ?? 1),
      0,
    );
    barOffset += section.repeat ? barsInSection * 2 : barsInSection;
  };

  // Lead-in: Intro, if present and not already explicitly listed in form.
  if (song.sections["Intro"] && !song.form.includes("Intro")) {
    appendSection("Intro");
  }

  song.form.forEach((label) => appendSection(label));

  // Tail: Coda / Tag, if present and not already explicitly listed in form.
  if (song.sections["Coda"] && !song.form.includes("Coda")) {
    appendSection("Coda");
  }
  if (song.sections["Tag"] && !song.form.includes("Tag")) {
    appendSection("Tag");
  }

  return out;
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
  }

  playChord(midiNotes, bassNote, time, duration) {
    const ctx = this.ensureContext();
    const attack = 0.015;
    const release = Math.min(0.25, duration * 0.3);
    const sustainEnd = Math.max(time + attack, time + duration - release);

    const playVoice = (midi, gainScale, dest) => {
      const freq = 440 * Math.pow(2, (midi - 69) / 12);
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = freq;
      const osc2 = ctx.createOscillator();
      osc2.type = "sine";
      osc2.frequency.value = freq * 2;
      const g = ctx.createGain();
      const g2 = ctx.createGain();
      g.gain.setValueAtTime(0.0001, time);
      g.gain.linearRampToValueAtTime(0.22 * gainScale, time + attack);
      g.gain.setValueAtTime(0.22 * gainScale, sustainEnd);
      g.gain.exponentialRampToValueAtTime(0.0001, time + duration);
      g2.gain.setValueAtTime(0.0001, time);
      g2.gain.linearRampToValueAtTime(0.05 * gainScale, time + attack);
      g2.gain.setValueAtTime(0.05 * gainScale, sustainEnd);
      g2.gain.exponentialRampToValueAtTime(0.0001, time + duration);
      osc.connect(g);
      g.connect(dest);
      osc2.connect(g2);
      g2.connect(dest);
      osc.start(time);
      osc.stop(time + duration + 0.05);
      osc2.start(time);
      osc2.stop(time + duration + 0.05);
    };

    midiNotes.forEach((n) => playVoice(n, 1, this.chordGain));
    playVoice(bassNote, 1.3, this.chordGain);
  }
}

// ============================================================================
// SCHEDULING — beat-by-beat playback synced to a lookahead clock
// ============================================================================
// ScheduledBeat shape: { time, barIndex, beatInBar (0-based), isChordStart, chord?, voicing? }

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_S = 0.15;

// ============================================================================
// UI HELPER: chord symbol display
// ============================================================================

function ChordSymbol({ root, quality }) {
  return (
    <span className="whitespace-nowrap">
      {root}
      <span className="text-[0.85em]">{qualityLabel(quality)}</span>
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

  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.trim().toLowerCase();
    return songs.filter((s) => s.title.toLowerCase().includes(q)).slice(0, 8);
  }, [songs, query]);

  // ---- Practice settings (reset to song defaults on song change) ----
  const [selectedKey, setSelectedKey] = useState("C");
  const [bpm, setBpm] = useState(120);
  const [voicingStyle, setVoicingStyle] = useState("closed");
  const [articulation, setArticulation] = useState("block");
  const [showChart, setShowChart] = useState(true);

  // ---- Metronome settings ----
  const [metronomeOn, setMetronomeOn] = useState(true);
  const [subdivision, setSubdivision] = useState("quarter");
  const [accentMode, setAccentMode] = useState("downbeat");
  const [metroVolume, setMetroVolume] = useState(0.5);

  // ---- Playback state ----
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentBar, setCurrentBar] = useState(-1);

  const engineRef = useRef(null);
  if (!engineRef.current) engineRef.current = new AudioEngine();

  const schedulerTimerRef = useRef(null);
  const nextBeatTimeRef = useRef(0);
  const beatCursorRef = useRef(0); // index into flattened-beats timeline
  const lastVoicingRef = useRef(null);
  const playStartedAtBarRef = useRef(0);
  const visibleBarRef = useRef(-1);
  const rafRef = useRef(null);
  const beatTimelineRef = useRef([]);

  function selectSong(song) {
    setSelectedSong(song);
    setSelectedKey(song.key);
    setBpm(song.tempo.bpm);
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
  const flatChords = useMemo(() => {
    if (!selectedSong) return [];
    return flattenSong(selectedSong);
  }, [selectedSong]);

  const semitoneShift = useMemo(() => {
    if (!selectedSong) return 0;
    return keySemitone(selectedKey) - keySemitone(selectedSong.key);
  }, [selectedSong, selectedKey]);

  const transposedChords = useMemo(() => {
    return flatChords.map((c) => ({
      ...c,
      root: transposeRoot(c.root, semitoneShift, selectedKey),
    }));
  }, [flatChords, semitoneShift, selectedKey]);

  // Group transposed chords into bars (for the chart and for the player)
  const bars = useMemo(() => {
    const out = [];
    transposedChords.forEach((c) => {
      if (!out[c.barIndex]) out[c.barIndex] = [];
      out[c.barIndex].push(c);
    });
    return out;
  }, [transposedChords]);

  const totalBars = bars.length;

  // ---- Stop playback & cleanup ----
  const stopPlayback = useCallback(() => {
    setIsPlaying(false);
    setCurrentBar(-1);
    if (schedulerTimerRef.current !== null) {
      window.clearInterval(schedulerTimerRef.current);
      schedulerTimerRef.current = null;
    }
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    lastVoicingRef.current = null;
  }, []);

  useEffect(() => {
    // stopping playback whenever the song, key or bpm changes avoids desync
    stopPlayback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSong, selectedKey]);

  // ---- Scheduler ----
  function startPlayback() {
    if (!selectedSong || bars.length === 0) return;
    const engine = engineRef.current;
    const ctx = engine.ensureContext();
    engine.setMetroVolume(metronomeOn ? metroVolume : 0);

    const num = selectedSong.timeSignature.numerator;
    const secPerBeat = 60 / bpm;

    // Flatten to a clean per-bar, per-beat structure for reliable scheduling.
    // For each bar, figure out the beat onsets (chord starts) within it.
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

    lastVoicingRef.current = null;
    setIsPlaying(true);

    const startTime = ctx.currentTime + 0.1;

    // subdivision ticks per beat for metronome
    const subDivCount =
      subdivision === "quarter" ? 1 : subdivision === "eighth" ? 2 : 4;

    // Precompute a flat queue of {time, barIndex, beatInBar, chord|null, isDownbeat}
    const queue = [];

    let t = startTime;
    barSlots.forEach((slots, bIdx) => {
      for (let beat = 0; beat < num; beat++) {
        const slot = slots.find((s) => Math.abs(s.beatInBar - beat) < 0.001);
        for (let sub = 0; sub < subDivCount; sub++) {
          const subTime = t + (sub * secPerBeat) / subDivCount;
          queue.push({
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

    // Schedule audio for every item up front (Web Audio handles future-scheduled
    // precisely; we don't need a rolling lookahead for a bounded song length).
    let voicing = null;
    queue.forEach((item) => {
      if (metronomeOn) {
        // "downbeat" mode: only click on beat 1 of each bar.
        // "all" mode: click on every beat (and every subdivision tick).
        if (accentMode === "all") {
          engine.playClick(item.time, item.isDownbeat);
        } else if (item.isDownbeat) {
          engine.playClick(item.time, true);
        }
      }
      if (item.chord) {
        voicing = generateVoicing(
          item.chord.root,
          item.chord.quality,
          voicingStyle,
          voicing,
        );
        const barDurationBeats = item.chord.beats;
        const fullDuration = barDurationBeats * secPerBeat;
        const duration =
          articulation === "staccato"
            ? Math.min(fullDuration * 0.45, fullDuration)
            : fullDuration;
        engine.playChord(voicing.notes, voicing.bass, item.time, duration);
      }
    });

    const songEndTime = t;

    // Visual sync via RAF, comparing ctx.currentTime to queue timestamps.
    let queueIdx = 0;
    function tick() {
      const now = ctx.currentTime;
      while (queueIdx < queue.length && queue[queueIdx].time <= now) {
        if (queue[queueIdx].chord || queue[queueIdx].beatInBar === 0) {
          setCurrentBar(queue[queueIdx].barIndex);
        }
        queueIdx++;
      }
      if (now >= songEndTime + 0.2) {
        stopPlayback();
        return;
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

      {/* ============== HEADER / SEARCH ============== */}
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

          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowResults(true);
              }}
              onFocus={() => setShowResults(true)}
              placeholder="Search a jazz standard\u2026"
              className="w-full bg-[#272524] border border-[#4a4744] focus:border-[#D4A24C] focus:outline-none rounded-lg px-4 py-3 text-[#F2EDE4] placeholder-[#8A8580] text-base"
              aria-label="Search jazz standards"
            />
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
                        {s.key} · {s.tempo.bpm} bpm
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
        <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">
          {/* ============== SONG TITLE + KEY/TEMPO CONTROLS ============== */}
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

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
                  min={30}
                  max={400}
                  value={bpm}
                  onChange={(e) =>
                    setBpm(
                      Math.max(30, Math.min(400, Number(e.target.value) || 0)),
                    )
                  }
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
            </div>
          </section>

          {/* ============== METRONOME PANEL ============== */}
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

          {/* ============== CHORD CHART ============== */}
          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="font-mono text-xs uppercase tracking-wide text-[#8A8580]">
                Chord chart
              </h3>
              <button
                onClick={() => setShowChart((v) => !v)}
                className="text-xs font-mono text-[#8A8580] hover:text-[#D4A24C] transition-colors underline"
              >
                {showChart ? "Hide (play by ear)" : "Show chart"}
              </button>
            </div>

            {showChart && (
              <div className="bg-[#252320] border border-[#3A3836] rounded-xl p-3 sm:p-5">
                <div
                  className="grid gap-1.5"
                  style={{
                    gridTemplateColumns:
                      "repeat(auto-fill, minmax(150px, 1fr))",
                  }}
                >
                  {bars.map((barChords, i) => (
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
                          {j > 0 && <span className="text-[#8A8580]">·</span>}
                          <ChordSymbol root={c.root} quality={c.quality} />
                        </React.Fragment>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </main>
      )}

      {/* ============== TRANSPORT (fixed) ============== */}
      {selectedSong && (
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
