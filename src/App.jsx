import { useState } from "react";
import ChordProgressionPracticer from "./ChordProgressionPracticer";
import ChordPatternPracticer from "./ChordPatternPracticer";
import LickPracticer from "./LickPracticer";

export default function App() {
  const [mode, setMode] = useState("song");
  const [displayInstrument, setDisplayInstrument] = useState("piano");

  return (
    <div>
      <nav>
        <button onClick={() => setMode("song")}>Songs</button>
        <button onClick={() => setMode("pattern")}>Patterns</button>
        <button onClick={() => setMode("licks")}>Licks</button>
      </nav>

      {mode === "song" && <ChordProgressionPracticer />}

      {mode === "pattern" && <ChordPatternPracticer />}

      {mode === "licks" && (
        <LickPracticer
          displayInstrument={displayInstrument}
          onChangeDisplayInstrument={setDisplayInstrument}
        />
      )}
    </div>
  );
}
