import React, { useEffect, useRef, useState } from "react";
import { Lick, VexFlowNoteSpec } from "./licks";
import { Instrument } from "./musicEngine";

// ============================================================================
// VEXFLOW LICK NOTATION
// ============================================================================
// Renders a lick as small, wrapping staves — one stave per bar, laid out in
// a grid that wraps to a new row instead of ever requiring horizontal
// scroll. Notes are grouped/beamed per-bar using the real bar membership
// recorded during extraction (each note carries its source `bar` index),
// rather than inferring measure boundaries from accumulated durations —
// that inference is what caused the earlier "notes not grouped properly"
// problem, since small quantization rounding errors could drift the
// running beat count out of sync with the actual bar lines.
//
// Transposition for Bb/Eb display instruments is applied to the rendered
// pitches only — playback always uses the lick's original concert pitch.
// ============================================================================

function transposeVexKey(
  vexKey: string,
  semitoneShift: number,
  preferFlats: boolean,
): string {
  if (semitoneShift === 0) return vexKey;
  const [pitchPart, octavePart] = vexKey.split("/");
  const NOTE_INDEX: Record<string, number> = {
    c: 0,
    "c#": 1,
    db: 1,
    d: 2,
    "d#": 3,
    eb: 3,
    e: 4,
    f: 5,
    "f#": 6,
    gb: 6,
    g: 7,
    "g#": 8,
    ab: 8,
    a: 9,
    "a#": 10,
    bb: 10,
    b: 11,
  };
  const SHARP = ["c", "c#", "d", "d#", "e", "f", "f#", "g", "g#", "a", "a#", "b"];
  const FLAT = ["c", "db", "d", "eb", "e", "f", "gb", "g", "ab", "a", "bb", "b"];

  const pc = NOTE_INDEX[pitchPart.toLowerCase()] ?? 0;
  const octave = parseInt(octavePart, 10);
  const absolute = octave * 12 + pc + semitoneShift;
  const newOctave = Math.floor(absolute / 12);
  const newPc = ((absolute % 12) + 12) % 12;
  const newName = (preferFlats ? FLAT : SHARP)[newPc];
  return `${newName}/${newOctave}`;
}

const STAVE_WIDTH = 130;
const ROW_HEIGHT = 90;
const MIN_STAVES_PER_ROW = 1;

interface VexFlowLickProps {
  lick: Lick;
  displayInstrument: Instrument;
}

export default function VexFlowLick({ lick, displayInstrument }: VexFlowLickProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(340);

  // Width comes from window resize events (not a ResizeObserver on our own
  // output element) — measuring what we ourselves render is what caused a
  // resize feedback loop elsewhere in this app; window-level resize can't
  // be triggered by our own re-render, so there's nothing to loop.
  useEffect(() => {
    const measure = () => {
      if (wrapperRef.current) {
        setContainerWidth(Math.max(200, wrapperRef.current.clientWidth));
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      const container = containerRef.current;
      if (!container) return;
      container.innerHTML = "";

      let VF: any;
      try {
        VF = await import("vexflow");
      } catch (e) {
        container.innerHTML =
          '<div style="opacity:0.6;font-size:12px;">Install the "vexflow" package to see notation.</div>';
        return;
      }
      if (cancelled || !containerRef.current) return;

      const { Renderer, Stave, StaveNote, Voice, Formatter, Accidental, Dot, Beam } = VF;

      const shift =
        displayInstrument === "C" ? 0 : displayInstrument === "Bb" ? 2 : 9;
      const preferFlats = lick.preferFlats;

      // Group notes by their real source bar.
      const barCount = Math.max(1, lick.barCount);
      const notesByBar: VexFlowNoteSpec[][] = Array.from(
        { length: barCount },
        () => [],
      );
      lick.notes.forEach((n) => {
        const b = Math.max(0, Math.min(barCount - 1, n.bar));
        notesByBar[b].push(n);
      });

      const stavesPerRow = Math.max(
        MIN_STAVES_PER_ROW,
        Math.floor(containerWidth / STAVE_WIDTH),
      );
      const rows = Math.ceil(barCount / stavesPerRow);
      const svgWidth = Math.min(containerWidth, stavesPerRow * STAVE_WIDTH);
      const svgHeight = rows * ROW_HEIGHT + 20;

      const renderer = new Renderer(container, Renderer.Backends.SVG);
      renderer.resize(svgWidth, svgHeight);
      const context = renderer.getContext();
      context.setFont("Arial", 9);

      for (let barIdx = 0; barIdx < barCount; barIdx++) {
        const col = barIdx % stavesPerRow;
        const row = Math.floor(barIdx / stavesPerRow);
        const x = col * STAVE_WIDTH + 2;
        const y = row * ROW_HEIGHT + 10;

        const stave = new Stave(x, y, STAVE_WIDTH - 4);
        if (barIdx === 0) {
          stave.addClef("treble");
        }
        stave.setContext(context).draw();

        const barNotes = notesByBar[barIdx];
        const specs = barNotes.length
          ? barNotes
          : [{ rest: true, duration: "w", bar: barIdx } as VexFlowNoteSpec];

        let staveNotes: any[];
        try {
          staveNotes = specs.map((n) => {
            if (n.rest || !n.keys) {
              const sn = new StaveNote({
                keys: ["b/4"],
                duration: `${n.duration}r`,
              });
              if (n.duration.includes("d")) sn.addModifier(new Dot(), 0);
              return sn;
            }
            const transposedKeys = n.keys.map((k) =>
              transposeVexKey(k, shift, preferFlats),
            );
            const sn = new StaveNote({
              keys: transposedKeys,
              duration: n.duration,
            });
            transposedKeys.forEach((k, idx) => {
              const accidental = k.split("/")[0].slice(1);
              if (accidental) sn.addModifier(new Accidental(accidental), idx);
            });
            if (n.duration.includes("d")) sn.addModifier(new Dot(), 0);
            return sn;
          });

          const voice = new Voice({ num_beats: 4, beat_value: 4 });
          voice.setStrict(false);
          voice.addTickables(staveNotes);

          new Formatter().joinVoices([voice]).format([voice], STAVE_WIDTH - 30);
          voice.draw(context, stave);

          const beams = Beam.generateBeams(staveNotes);
          beams.forEach((b: any) => b.setContext(context).draw());
        } catch (e) {
          // A single malformed bar shouldn't blank the whole lick — skip
          // just that bar's notes and keep going.
          continue;
        }
      }
    }

    render();
    return () => {
      cancelled = true;
    };
  }, [lick, displayInstrument, containerWidth]);

  return (
    <div ref={wrapperRef} className="w-full">
      <div ref={containerRef} />
    </div>
  );
}
