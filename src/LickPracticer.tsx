import React, { useCallback, useMemo, useRef, useState } from "react";

import { Lick, LICK_PERFORMERS, LICK_COMPENDIUM } from "./licks";

import {
  LickShuffleBag,
  useLickFavorites,
  FavoriteLick,
} from "./lickSelection";

import { ALL_BOPLAND_LICKS, BoplandLick, randomBoplandLick } from "./bopland";

import VexFlowLick from "./VexFlowLick";
import BoplandLickView from "./BoplandLick";

import {
  AudioEngine,
  Instrument,
  INSTRUMENT_LABELS,
  Timbre,
} from "./musicEngine";

// ============================================================================
// TYPES
// ============================================================================

type LickSource = "wjd" | "bopland";

const LICK_SOURCE_LABELS: Record<LickSource, string> = {
  wjd: "Weimar Jazz Database",
  bopland: "Bopland",
};

// VexFlow duration code -> length in quarter-note beats.
const DURATION_TO_BEATS: Record<string, number> = {
  w: 4,
  hd: 3,
  h: 2,
  qd: 1.5,
  q: 1,
  "8d": 0.75,
  "8": 0.5,
  "16": 0.25,
  "32": 0.125,
};

interface LickPracticerProps {
  displayInstrument: Instrument;
  onChangeDisplayInstrument: (i: Instrument) => void;
  controlsHidden?: boolean;
  onToggleControls?: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function LickPracticer({
  displayInstrument,
  onChangeDisplayInstrument,
  controlsHidden: controlsHiddenProp,
  onToggleControls,
}: LickPracticerProps) {
  // --------------------------------------------------------------------------
  // Source
  // --------------------------------------------------------------------------

  const [source, setSource] = useState<LickSource>("wjd");

  // --------------------------------------------------------------------------
  // WJD state
  // --------------------------------------------------------------------------

  const [selectedPerformer, setSelectedPerformer] = useState<string>("__ALL__");

  const [currentLick, setCurrentLick] = useState<Lick | null>(null);

  // --------------------------------------------------------------------------
  // Bopland state
  // --------------------------------------------------------------------------

  const [currentBoplandLick, setCurrentBoplandLick] =
    useState<BoplandLick | null>(null);

  // --------------------------------------------------------------------------
  // Shared UI state
  // --------------------------------------------------------------------------

  const [showNotation, setShowNotation] = useState(true);

  const [showChords, setShowChords] = useState(true);

  const [showFavorites, setShowFavorites] = useState(false);

  const [lickBpm, setLickBpm] = useState(140);

  const [lickBpmInput, setLickBpmInput] = useState("140");

  const [timbre, setTimbre] = useState<Timbre>("piano");

  const [isPlayingLick, setIsPlayingLick] = useState(false);

  // --------------------------------------------------------------------------
  // Controls
  // --------------------------------------------------------------------------

  const [internalControlsHidden, setInternalControlsHidden] = useState(false);

  const isControlledExternally = controlsHiddenProp !== undefined;

  const controlsHidden = isControlledExternally
    ? controlsHiddenProp
    : internalControlsHidden;

  const toggleControls =
    onToggleControls ?? (() => setInternalControlsHidden((v) => !v));

  // --------------------------------------------------------------------------
  // Existing WJD shuffle bag
  // --------------------------------------------------------------------------

  const bagRef = useRef<LickShuffleBag | null>(null);

  if (!bagRef.current) {
    bagRef.current = new LickShuffleBag();
  }

  // --------------------------------------------------------------------------
  // Audio
  // --------------------------------------------------------------------------

  const engineRef = useRef<AudioEngine | null>(null);

  if (!engineRef.current) {
    engineRef.current = new AudioEngine();
  }

  const rafRef = useRef<number | null>(null);

  const playGenRef = useRef(0);

  // --------------------------------------------------------------------------
  // Favorites
  // --------------------------------------------------------------------------

  const { isFavorite, toggleFavorite, favoriteLicks } = useLickFavorites();

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  function commitBpmInput() {
    const parsed = parseInt(lickBpmInput, 10);

    const clamped = Math.max(
      1,
      Math.min(400, Number.isFinite(parsed) ? parsed : lickBpm),
    );

    setLickBpm(clamped);
    setLickBpmInput(String(clamped));
  }

  const stopLick = useCallback(() => {
    playGenRef.current += 1;

    setIsPlayingLick(false);

    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);

      rafRef.current = null;
    }

    engineRef.current?.stopAll();
  }, []);

  function showNextLick() {
    stopLick();
    setShowFavorites(false);

    if (source === "bopland") {
      const lick = randomBoplandLick();
      setCurrentBoplandLick(lick);
      return;
    }

    const lick = bagRef.current!.next(selectedPerformer);

    setCurrentLick(lick);
  }

  function showLick(lick: Lick) {
    stopLick();

    setSource("wjd");
    setCurrentLick(lick);
    setCurrentBoplandLick(null);
    setShowFavorites(false);
  }

  function showBoplandLick(lick: BoplandLick) {
    stopLick();

    setSource("bopland");
    setCurrentLick(null);
    setCurrentBoplandLick(lick);
    setShowFavorites(false);
  }

  function handleSourceChange(nextSource: LickSource) {
    stopLick();

    setSource(nextSource);
    setShowFavorites(false);

    if (nextSource === "bopland") {
      setCurrentLick(null);
      setCurrentBoplandLick(randomBoplandLick());
    } else {
      setCurrentBoplandLick(null);
      setCurrentLick(null);
    }
  }

  function playLick() {
    if (!currentLick) return;

    const engine = engineRef.current!;

    const ctx = engine.ensureContext();

    engine.stopAll();

    playGenRef.current += 1;

    const myGen = playGenRef.current;

    const secPerBeat = 60 / lickBpm;

    let t = ctx.currentTime + 0.1;

    currentLick.notes.forEach((n) => {
      const beats = DURATION_TO_BEATS[n.duration.replace(/r$/, "")] ?? 0.5;

      if (!n.rest && n.midi !== undefined) {
        engine.playNote(n.midi, t, beats * secPerBeat * 0.9, timbre);
      }

      t += beats * secPerBeat;
    });

    const endTime = t;

    setIsPlayingLick(true);

    function tick() {
      if (myGen !== playGenRef.current) {
        return;
      }

      if (ctx.currentTime >= endTime) {
        setIsPlayingLick(false);
        rafRef.current = null;
        return;
      }

      rafRef.current = window.requestAnimationFrame(tick);
    }

    rafRef.current = window.requestAnimationFrame(tick);
  }

  // --------------------------------------------------------------------------
  // Picker
  // --------------------------------------------------------------------------

  const pickerOptions = useMemo(() => ["__ALL__", ...LICK_PERFORMERS], []);

  // --------------------------------------------------------------------------
  // Favorites
  // --------------------------------------------------------------------------

  function renderFavorite(favorite: FavoriteLick) {
    const isBopland = "hash" in favorite;

    return (
      <li
        key={favorite.id}
        className="py-3 flex items-center justify-between gap-3"
      >
        <button
          onClick={() =>
            isBopland
              ? showBoplandLick(favorite as BoplandLick)
              : showLick(favorite as Lick)
          }
          className="text-left text-sm text-[#F2EDE4] hover:text-[#D4A24C] transition-colors min-w-0"
        >
          <span>{favorite.label}</span>

          <span className="text-[#8A8580] text-xs ml-2 font-mono">
            {isBopland ? "Bopland" : (favorite as Lick).sourceTune}
          </span>
        </button>

        <button
          onClick={() => toggleFavorite(favorite.id)}
          className="text-[#D4A24C] text-lg leading-none shrink-0"
          aria-label="Remove favorite"
        >
          &#9733;
        </button>
      </li>
    );
  }

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-4">
      {!isControlledExternally && (
        <button
          onClick={toggleControls}
          className="fixed bottom-3 right-3 z-50 flex items-center gap-1.5 px-3 py-2 rounded-full bg-[#272524]/90 border border-[#4a4744] backdrop-blur text-xs font-mono text-[#F2EDE4] shadow-lg hover:border-[#D4A24C] transition-colors"
          aria-label={controlsHidden ? "Show controls" : "Hide controls"}
        >
          <span>{controlsHidden ? "▼" : "▲"}</span>

          {controlsHidden ? "Show controls" : "Hide controls"}
        </button>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Picker + controls                                                  */}
      {/* ------------------------------------------------------------------ */}

      {!controlsHidden && (
        <section className="flex flex-col gap-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Source */}

            <div className="flex flex-col gap-1.5 col-span-2">
              <label className="text-xs uppercase tracking-wide text-[#8A8580] font-mono">
                Source
              </label>

              <select
                value={source}
                onChange={(e) =>
                  handleSourceChange(e.target.value as LickSource)
                }
                className="bg-[#272524] border border-[#4a4744] rounded-md px-2.5 py-2 text-sm focus:border-[#D4A24C] focus:outline-none"
              >
                <option value="wjd">{LICK_SOURCE_LABELS.wjd}</option>

                <option value="bopland">{LICK_SOURCE_LABELS.bopland}</option>
              </select>
            </div>

            {/* WJD-only controls */}

            {source === "wjd" && (
              <>
                <div className="flex flex-col gap-1.5 col-span-2">
                  <label className="text-xs uppercase tracking-wide text-[#8A8580] font-mono">
                    Soloist
                  </label>

                  <select
                    value={selectedPerformer}
                    onChange={(e) => setSelectedPerformer(e.target.value)}
                    className="bg-[#272524] border border-[#4a4744] rounded-md px-2.5 py-2 text-sm focus:border-[#D4A24C] focus:outline-none"
                  >
                    <option value="__ALL__">Random (any soloist)</option>

                    {pickerOptions
                      .filter((p) => p !== "__ALL__")
                      .map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs uppercase tracking-wide text-[#8A8580] font-mono">
                    Lick tempo
                  </label>

                  <input
                    type="number"
                    min={1}
                    max={400}
                    inputMode="numeric"
                    value={lickBpmInput}
                    onChange={(e) => setLickBpmInput(e.target.value)}
                    onBlur={commitBpmInput}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.currentTarget.blur();
                      }
                    }}
                    className="bg-[#272524] border border-[#4a4744] rounded-md px-2.5 py-2 text-sm focus:border-[#D4A24C] focus:outline-none font-mono"
                  />
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
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={showNextLick}
              className="px-5 py-2.5 rounded-full bg-[#D4A24C] hover:bg-[#e0b15e] text-[#1C1B1A] font-semibold text-sm transition-colors"
            >
              {source === "bopland"
                ? "Show random Bopland lick"
                : selectedPerformer === "__ALL__"
                  ? "Show random lick"
                  : `Show ${selectedPerformer} lick`}
            </button>

            {/* WJD-only instrument controls */}

            {source === "wjd" && (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase tracking-wide text-[#8A8580] font-mono">
                    Reading as
                  </span>

                  <div className="flex bg-[#1C1B1A] rounded-md p-1 gap-1">
                    {(["C", "Bb", "Eb"] as Instrument[]).map((inst) => (
                      <button
                        key={inst}
                        onClick={() => onChangeDisplayInstrument(inst)}
                        title={INSTRUMENT_LABELS[inst]}
                        className={`text-xs px-2.5 py-1 rounded-md transition-colors font-mono ${
                          displayInstrument === inst
                            ? "bg-[#D4A24C] text-[#1C1B1A] font-semibold"
                            : "text-[#8A8580] hover:text-[#F2EDE4]"
                        }`}
                      >
                        {inst === "C" ? "C" : inst === "Bb" ? "B♭" : "E♭"}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => setShowNotation((v) => !v)}
                  className="text-xs font-mono text-[#8A8580] hover:text-[#D4A24C] underline transition-colors"
                >
                  {showNotation ? "Hide notation" : "Show notation"}
                </button>

                <button
                  onClick={() => setShowChords((v) => !v)}
                  className="text-xs font-mono text-[#8A8580] hover:text-[#D4A24C] underline transition-colors"
                >
                  {showChords ? "Hide chord context" : "Show chord context"}
                </button>
              </>
            )}

            <button
              onClick={() => setShowFavorites((v) => !v)}
              className="text-xs font-mono text-[#8A8580] hover:text-[#D4A24C] underline transition-colors"
            >
              {showFavorites
                ? "Back to lick"
                : `Favorites (${favoriteLicks.length})`}
            </button>
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Favorites                                                          */}
      {/* ------------------------------------------------------------------ */}

      {showFavorites && !controlsHidden ? (
        <section className="bg-[#252320] border border-[#3A3836] rounded-xl p-4 flex flex-col gap-2">
          <h3 className="font-mono text-xs uppercase tracking-wide text-[#8A8580]">
            Favorites
          </h3>

          {favoriteLicks.length === 0 ? (
            <p className="text-sm text-[#8A8580]">
              No favorites yet — tap the star on a lick to save it here.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-[#3A3836]">
              {favoriteLicks.map(renderFavorite)}
            </ul>
          )}
        </section>
      ) : (
        /* --------------------------------------------------------------- */
        /* Current lick                                                     */
        /* --------------------------------------------------------------- */

        <section className="bg-[#252320] border border-[#3A3836] rounded-xl p-4 flex flex-col gap-4">
          {source === "bopland" ? (
            currentBoplandLick ? (
              <>
                <BoplandLickView
                  lick={currentBoplandLick}
                  isFavorite={isFavorite(currentBoplandLick.id)}
                  onToggleFavorite={() => toggleFavorite(currentBoplandLick.id)}
                />
              </>
            ) : (
              <p className="text-sm text-[#8A8580] text-center py-8">
                Click "Show random Bopland lick" to get started.
              </p>
            )
          ) : !currentLick ? (
            <p className="text-sm text-[#8A8580] text-center py-8">
              Pick a soloist (or leave it on Random) and tap "Show lick" to get
              started.
            </p>
          ) : (
            <>
              {/* WJD header */}

              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="font-display text-2xl text-[#F2EDE4]">
                    {currentLick.label}
                  </h2>

                  <p className="text-xs text-[#D4A24C] font-mono mt-1 font-semibold">
                    {currentLick.contextLabel}
                  </p>

                  <p className="text-xs text-[#8A8580] font-mono mt-1">
                    from &ldquo;
                    {currentLick.sourceTune}
                    &rdquo; &middot; {currentLick.style} &middot; bar{" "}
                    {currentLick.barStart + 1}
                    {currentLick.sourceTempo
                      ? ` · originally ~${Math.round(
                          currentLick.sourceTempo,
                        )} bpm`
                      : ""}
                  </p>
                </div>

                <button
                  onClick={() => toggleFavorite(currentLick.id)}
                  className={`text-2xl leading-none transition-colors ${
                    isFavorite(currentLick.id)
                      ? "text-[#D4A24C]"
                      : "text-[#4a4744] hover:text-[#8A8580]"
                  }`}
                  aria-label="Toggle favorite"
                  title="Favorite this lick"
                >
                  &#9733;
                </button>
              </div>

              {showChords && (
                <div className="flex flex-wrap gap-1.5 font-mono text-sm text-[#D4A24C]">
                  {currentLick.chordContext.map((c, i) => (
                    <span
                      key={i}
                      className="border border-[#4a4744] rounded-md px-2 py-1 bg-[#1f1d1b]"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              )}

              {showNotation && (
                <div className="bg-[#F2EDE4] rounded-lg p-2">
                  <VexFlowLick
                    lick={currentLick}
                    displayInstrument={displayInstrument}
                  />
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  onClick={isPlayingLick ? stopLick : playLick}
                  className={`px-6 py-2.5 rounded-full font-semibold text-sm transition-colors ${
                    isPlayingLick
                      ? "bg-[#8B3A3A] hover:bg-[#9c4444] text-[#F2EDE4]"
                      : "bg-[#D4A24C] hover:bg-[#e0b15e] text-[#1C1B1A]"
                  }`}
                >
                  {isPlayingLick ? "■ Stop" : "▶ Play lick"}
                </button>

                <span className="text-xs font-mono text-[#8A8580]">
                  {lickBpm} bpm (independent of the chord progression tempo)
                </span>
              </div>
            </>
          )}
        </section>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Attribution                                                        */}
      {/* ------------------------------------------------------------------ */}

      {!controlsHidden && (
        <p className="text-[10px] text-[#8A8580] font-mono leading-relaxed">
          {source === "bopland" ? (
            <>
              <p className="text-[10px] text-[#8A8580] font-mono text-center mt-2">
                This lick came from{" "}
                <a
                  href="https://bopland.org"
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:text-[#D4A24C]"
                >
                  Bopland
                </a>
                . If you like it, consider purchasing a{" "}
                <a
                  href="https://bopland.org/books"
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:text-[#D4A24C]"
                >
                  book
                </a>
                .
              </p>
            </>
          ) : (
            <>
              Licks are short excerpts from real recorded solos, selected along
              natural phrase boundaries or real ii-V/ii-V-I harmonic motion,
              drawn from note-level transcriptions in the{" "}
              <a
                href={LICK_COMPENDIUM.meta.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-[#D4A24C]"
              >
                Weimar Jazz Database
              </a>{" "}
              (Jazzomat Research Project, HfM Weimar), licensed under{" "}
              {LICK_COMPENDIUM.meta.license}.
            </>
          )}
        </p>
      )}
    </div>
  );
}
