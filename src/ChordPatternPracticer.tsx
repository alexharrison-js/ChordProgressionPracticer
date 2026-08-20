import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AudioEngine,
  FlatChord,
  Instrument,
  INSTRUMENT_LABELS,
  Timbre,
  VoicingStyleId,
  VOICING_STYLES,
  VoicedChord,
  generateVoicing,
  groupIntoBars,
  qualityLabel,
  transposeForInstrument,
  ALL_KEYS,
} from "./musicEngine";
import {
  CHORD_PROGRESSION_CONCEPTS,
  CYCLE_TYPES,
  CycleTypeId,
  generatePatternBars,
} from "./chordProgressionConcepts";

// ============================================================================
// CHORD SYMBOL DISPLAY (matches the song player's ChordSymbol component)
// ============================================================================
function ChordSymbol({ root, quality }: { root: string; quality: string }) {
  return (
    <span className="whitespace-nowrap">
      {root}
      <span className="text-[0.85em]">{qualityLabel(quality)}</span>
    </span>
  );
}

const KEY_CENTERS_TO_GENERATE = 24; // enough that a loop feels effectively endless

export default function ChordPatternPracticer() {
  const [conceptId, setConceptId] = useState(CHORD_PROGRESSION_CONCEPTS[2].id); // ii-V-I
  const [cycleType, setCycleType] = useState<CycleTypeId>("circle_of_4ths");
  const [repeatsPerKey, setRepeatsPerKey] = useState(1);
  const [startKey, setStartKey] = useState("C");
  const [bpm, setBpm] = useState(120);
  const [bpmInput, setBpmInput] = useState("120");
  const [voicingStyle, setVoicingStyle] = useState<VoicingStyleId>("closed");
  const [timbre, setTimbre] = useState<Timbre>("piano");
  const [displayInstrument, setDisplayInstrument] = useState<Instrument>("C");

  const [metronomeOn, setMetronomeOn] = useState(true);
  const [metroVolume, setMetroVolume] = useState(0.5);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentBar, setCurrentBar] = useState(-1);

  const engineRef = useRef<AudioEngine | null>(null);
  if (!engineRef.current) engineRef.current = new AudioEngine();
  const lastVoicingRef = useRef<VoicedChord | null>(null);
  const rafRef = useRef<number | null>(null);
  const playGenRef = useRef(0);

  const concept = useMemo(
    () => CHORD_PROGRESSION_CONCEPTS.find((c) => c.id === conceptId)!,
    [conceptId],
  );

  const startKeySemitone = ALL_KEYS.indexOf(startKey);

  const coreBars: FlatChord[] = useMemo(
    () =>
      generatePatternBars({
        concept,
        startKeySemitone: startKeySemitone < 0 ? 0 : startKeySemitone,
        cycleType,
        repeatsPerKey,
        keyCentersCount: KEY_CENTERS_TO_GENERATE,
        preferFlats: true,
      }),
    [concept, startKeySemitone, cycleType, repeatsPerKey],
  );

  const bars = useMemo(() => groupIntoBars(coreBars), [coreBars]);

  const displayBars = useMemo(
    () =>
      bars.map((bar) =>
        bar.map((c) => ({
          ...c,
          root: transposeForInstrument(c.root, displayInstrument, startKey),
        })),
      ),
    [bars, displayInstrument, startKey],
  );

  function commitBpmInput() {
    const parsed = parseInt(bpmInput, 10);
    const clamped = Math.max(
      1,
      Math.min(500, Number.isFinite(parsed) ? parsed : bpm),
    );
    setBpm(clamped);
    setBpmInput(String(clamped));
  }

  const stopPlayback = useCallback(() => {
    playGenRef.current += 1;
    setIsPlaying(false);
    setCurrentBar(-1);
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    engineRef.current?.stopAll();
    lastVoicingRef.current = null;
  }, []);

  useEffect(() => {
    stopPlayback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conceptId, cycleType, repeatsPerKey, startKey, bpm]);

  useEffect(() => stopPlayback, [stopPlayback]);

  useEffect(() => {
    if (isPlaying)
      engineRef.current?.setMetroVolume(metronomeOn ? metroVolume : 0);
  }, [metronomeOn, metroVolume, isPlaying]);

  function startPlayback() {
    if (bars.length === 0) return;
    const engine = engineRef.current!;
    const ctx = engine.ensureContext();
    engine.setMetroVolume(metronomeOn ? metroVolume : 0);
    engine.stopAll();
    playGenRef.current += 1;
    const myGen = playGenRef.current;

    const secPerBeat = 60 / bpm;
    const NUM = 4; // pattern mode is always 4/4

    interface QueueItem {
      time: number;
      barIndex: number;
      beatInBar: number;
      chord: FlatChord | null;
      isDownbeat: boolean;
    }

    function buildPassQueue(fromTime: number): {
      passQueue: QueueItem[];
      endTime: number;
    } {
      const passQueue: QueueItem[] = [];
      let t = fromTime;
      bars.forEach((barChords, bIdx) => {
        for (let beat = 0; beat < NUM; beat++) {
          passQueue.push({
            time: t,
            barIndex: bIdx,
            beatInBar: beat,
            chord: beat === 0 ? (barChords[0] ?? null) : null,
            isDownbeat: beat === 0,
          });
          t += secPerBeat;
        }
      });
      return { passQueue, endTime: t };
    }

    function scheduleQueue(passQueue: QueueItem[]) {
      passQueue.forEach((item) => {
        if (metronomeOn && item.isDownbeat) {
          engine.playClick(item.time, true);
        }
        if (item.chord) {
          lastVoicingRef.current = generateVoicing(
            item.chord.root,
            item.chord.quality,
            voicingStyle,
            lastVoicingRef.current,
          );
          engine.playChord(
            lastVoicingRef.current.notes,
            lastVoicingRef.current.bass,
            item.time,
            item.chord.beats * secPerBeat,
            timbre,
          );
        }
      });
    }

    function scheduleCountIn(fromTime: number): number {
      for (let beat = 0; beat < NUM; beat++) {
        engine.playClick(fromTime + beat * secPerBeat, beat === 0);
      }
      return fromTime + NUM * secPerBeat;
    }

    lastVoicingRef.current = null;
    setIsPlaying(true);

    const firstStart = scheduleCountIn(ctx.currentTime + 0.1);
    let { passQueue: currentQueue, endTime: currentEndTime } =
      buildPassQueue(firstStart);
    scheduleQueue(currentQueue);

    const pendingSwap: { queue: QueueItem[] | null; endTime: number } = {
      queue: null,
      endTime: 0,
    };
    let queueIdx = 0;

    function tick() {
      if (myGen !== playGenRef.current) return;
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
      if (!pendingSwap.queue && currentEndTime - now < 1) {
        const next = buildPassQueue(currentEndTime);
        scheduleQueue(next.passQueue);
        pendingSwap.queue = next.passQueue;
        pendingSwap.endTime = next.endTime;
      }
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
    if (isPlaying) stopPlayback();
    else startPlayback();
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ---- Concept / cycle / key controls ---- */}
      <section className="flex flex-col gap-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="flex flex-col gap-1.5 col-span-2">
            <label className="text-xs uppercase tracking-wide text-[#8A8580] font-mono">
              Progression
            </label>
            <select
              value={conceptId}
              onChange={(e) => setConceptId(e.target.value)}
              className="bg-[#272524] border border-[#4a4744] rounded-md px-2.5 py-2 text-sm focus:border-[#D4A24C] focus:outline-none"
            >
              {CHORD_PROGRESSION_CONCEPTS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.shortLabel})
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5 col-span-2">
            <label className="text-xs uppercase tracking-wide text-[#8A8580] font-mono">
              Cycle
            </label>
            <select
              value={cycleType}
              onChange={(e) => setCycleType(e.target.value as CycleTypeId)}
              className="bg-[#272524] border border-[#4a4744] rounded-md px-2.5 py-2 text-sm focus:border-[#D4A24C] focus:outline-none"
            >
              {CYCLE_TYPES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs uppercase tracking-wide text-[#8A8580] font-mono">
              Repeats/key
            </label>
            <select
              value={repeatsPerKey}
              onChange={(e) => setRepeatsPerKey(Number(e.target.value))}
              className="bg-[#272524] border border-[#4a4744] rounded-md px-2.5 py-2 text-sm focus:border-[#D4A24C] focus:outline-none"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}x
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs uppercase tracking-wide text-[#8A8580] font-mono">
              Start key
            </label>
            <select
              value={startKey}
              onChange={(e) => setStartKey(e.target.value)}
              className="bg-[#272524] border border-[#4a4744] rounded-md px-2.5 py-2 text-sm focus:border-[#D4A24C] focus:outline-none"
            >
              {ALL_KEYS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
              onChange={(e) => setBpmInput(e.target.value)}
              onBlur={commitBpmInput}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              className="bg-[#272524] border border-[#4a4744] rounded-md px-2.5 py-2 text-sm focus:border-[#D4A24C] focus:outline-none font-mono"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs uppercase tracking-wide text-[#8A8580] font-mono">
              Voicing
            </label>
            <select
              value={voicingStyle}
              onChange={(e) =>
                setVoicingStyle(e.target.value as VoicingStyleId)
              }
              className="bg-[#272524] border border-[#4a4744] rounded-md px-2.5 py-2 text-sm focus:border-[#D4A24C] focus:outline-none"
            >
              {VOICING_STYLES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs uppercase tracking-wide text-[#8A8580] font-mono">
              Sound
            </label>
            <select
              value={timbre}
              onChange={(e) => setTimbre(e.target.value as Timbre)}
              className="bg-[#272524] border border-[#4a4744] rounded-md px-2.5 py-2 text-sm focus:border-[#D4A24C] focus:outline-none"
            >
              <option value="piano">Piano</option>
              <option value="epiano">Electric Piano</option>
              <option value="synth">Synth</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs uppercase tracking-wide text-[#8A8580] font-mono">
              Reading as
            </label>
            <div className="flex bg-[#1C1B1A] rounded-md p-1 gap-1">
              {(["C", "Bb", "Eb"] as Instrument[]).map((inst) => (
                <button
                  key={inst}
                  onClick={() => setDisplayInstrument(inst)}
                  title={INSTRUMENT_LABELS[inst]}
                  className={`flex-1 text-xs py-1.5 rounded-md transition-colors font-mono ${
                    displayInstrument === inst
                      ? "bg-[#D4A24C] text-[#1C1B1A] font-semibold"
                      : "text-[#8A8580] hover:text-[#F2EDE4]"
                  }`}
                >
                  {inst === "C" ? "C" : inst === "Bb" ? "B\u266D" : "E\u266D"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="text-xs text-[#8A8580]">{concept.description}</p>
      </section>

      {/* ---- Metronome ---- */}
      <section className="bg-[#252320] border border-[#3A3836] rounded-xl p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
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
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={metroVolume}
          onChange={(e) => setMetroVolume(Number(e.target.value))}
          className="w-32"
        />
      </section>

      {/* ---- Chart ---- */}
      <section className="bg-[#252320] border border-[#3A3836] rounded-xl p-3 sm:p-5">
        <div
          className="grid gap-1.5"
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
          }}
        >
          {displayBars.slice(0, 48).map((barChords, i) => (
            <div
              key={i}
              className={`font-mono text-sm sm:text-base border border-[#4a4744] rounded-md px-2.5 py-2.5 flex items-center justify-center gap-1.5 flex-wrap transition-all duration-150 ${
                currentBar === i ? "bar-glow bg-[#3A3836]" : "bg-[#1f1d1b]"
              }`}
            >
              {barChords.map((c, j) => (
                <ChordSymbol key={j} root={c.root} quality={c.quality} />
              ))}
            </div>
          ))}
        </div>
        <p className="text-[10px] text-[#8A8580] font-mono mt-3">
          Showing the first {Math.min(48, displayBars.length)} bars — playback
          loops the generated cycle continuously.
        </p>
      </section>

      {/* ---- Transport ---- */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={togglePlay}
          className={`px-8 py-3 rounded-full font-semibold text-base transition-colors flex items-center gap-2 ${
            isPlaying
              ? "bg-[#8B3A3A] hover:bg-[#9c4444] text-[#F2EDE4]"
              : "bg-[#D4A24C] hover:bg-[#e0b15e] text-[#1C1B1A]"
          }`}
        >
          {isPlaying ? "\u25A0 Stop" : "\u25B6 Play pattern"}
        </button>
        <span className="text-xs font-mono text-[#8A8580]">
          {bpm} bpm &middot; 4/4
        </span>
      </div>
    </div>
  );
}
