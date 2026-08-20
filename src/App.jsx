import { useState } from "react";
import ChordProgressionPracticer from "./ChordProgressionPracticer";
import ChordPatternPracticer from "./ChordPatternPracticer";
import LickPracticer from "./LickPracticer";

const MODES = [
  { id: "song", label: "Songs" },
  { id: "pattern", label: "Patterns" },
  { id: "licks", label: "Licks" },
];

export default function App() {
  const [mode, setMode] = useState("song");
  // "C" | "Bb" | "Eb" — the lick screen's display-transposition instrument.
  // (Not a timbre — that's a separate, per-screen "Sound" dropdown.)
  const [displayInstrument, setDisplayInstrument] = useState("C");

  return (
    <div className="min-h-screen w-full bg-[#1C1B1A] text-[#F2EDE4] font-sans">
      {/* Fonts + shared range-input styling, loaded once at the app shell
          level so switching modes never drops them (this used to live only
          inside ChordProgressionPracticer, so it disappeared whenever that
          component unmounted). */}
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

      <header className="border-b border-[#3A3836] px-4 sm:px-6 py-4 sticky top-0 bg-[#1C1B1A]/95 backdrop-blur z-30">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3 flex-wrap">
          <h1 className="font-display text-2xl sm:text-3xl tracking-tight text-[#F2EDE4]">
            Jazz<span className="text-[#D4A24C]">Shed</span>
          </h1>

          <nav className="flex bg-[#272524] border border-[#4a4744] rounded-full p-1 gap-1">
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`px-4 py-1.5 rounded-full text-sm font-mono transition-colors ${
                  mode === m.id
                    ? "bg-[#D4A24C] text-[#1C1B1A] font-semibold"
                    : "text-[#8A8580] hover:text-[#F2EDE4]"
                }`}
              >
                {m.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {mode === "song" && <ChordProgressionPracticer />}
        {mode === "pattern" && <ChordPatternPracticer />}
        {mode === "licks" && (
          <LickPracticer
            displayInstrument={displayInstrument}
            onChangeDisplayInstrument={setDisplayInstrument}
          />
        )}
      </main>
    </div>
  );
}
