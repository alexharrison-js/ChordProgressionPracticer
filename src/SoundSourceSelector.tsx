import React from "react";
import { Timbre, SampleInstrumentId, SAMPLE_INSTRUMENTS } from "./musicEngine";

// ============================================================================
// SOUND SOURCE SELECTOR
// ============================================================================
// Shared control for picking between the built-in oscillator synth (the
// original three timbres) and real sample-based instrument playback (the
// full set ported from the ear trainer app). Used identically across the
// song player, pattern practicer, and lick practicer.
// ============================================================================

export type SoundMode = "synth" | "sample";

interface SoundSourceSelectorProps {
  soundMode: SoundMode;
  onChangeSoundMode: (mode: SoundMode) => void;
  timbre: Timbre;
  onChangeTimbre: (t: Timbre) => void;
  sampleInstrument: SampleInstrumentId;
  onChangeSampleInstrument: (id: SampleInstrumentId) => void;
  samplesLoading: boolean;
}

export default function SoundSourceSelector({
  soundMode,
  onChangeSoundMode,
  timbre,
  onChangeTimbre,
  sampleInstrument,
  onChangeSampleInstrument,
  samplesLoading,
}: SoundSourceSelectorProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs uppercase tracking-wide text-[#8A8580] font-mono">
        Sound
      </label>

      <div className="flex bg-[#1C1B1A] rounded-md p-1 gap-1 mb-1">
        <button
          onClick={() => onChangeSoundMode("synth")}
          className={`flex-1 text-xs py-1.5 rounded-md transition-colors font-mono ${
            soundMode === "synth"
              ? "bg-[#D4A24C] text-[#1C1B1A] font-semibold"
              : "text-[#8A8580] hover:text-[#F2EDE4]"
          }`}
        >
          Synth
        </button>
        <button
          onClick={() => onChangeSoundMode("sample")}
          className={`flex-1 text-xs py-1.5 rounded-md transition-colors font-mono ${
            soundMode === "sample"
              ? "bg-[#D4A24C] text-[#1C1B1A] font-semibold"
              : "text-[#8A8580] hover:text-[#F2EDE4]"
          }`}
        >
          Samples
        </button>
      </div>

      {soundMode === "synth" ? (
        <select
          value={timbre}
          onChange={(e) => onChangeTimbre(e.target.value as Timbre)}
          className="bg-[#272524] border border-[#4a4744] rounded-md px-2.5 py-2 text-sm focus:border-[#D4A24C] focus:outline-none"
        >
          <option value="piano">Piano</option>
          <option value="epiano">Electric Piano</option>
          <option value="synth">Synth</option>
        </select>
      ) : (
        <div className="flex flex-col gap-1">
          <select
            value={sampleInstrument}
            onChange={(e) =>
              onChangeSampleInstrument(e.target.value as SampleInstrumentId)
            }
            disabled={samplesLoading}
            className="bg-[#272524] border border-[#4a4744] rounded-md px-2.5 py-2 text-sm focus:border-[#D4A24C] focus:outline-none disabled:opacity-50"
          >
            {SAMPLE_INSTRUMENTS.map((inst) => (
              <option key={inst.id} value={inst.id}>
                {inst.label}
              </option>
            ))}
          </select>
          {samplesLoading && (
            <span className="text-[10px] text-[#D4A24C] font-mono animate-pulse">
              Loading samples&hellip;
            </span>
          )}
        </div>
      )}
    </div>
  );
}
