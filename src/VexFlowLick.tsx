import React, { useEffect, useRef } from "react";
import { Lick, VexFlowNoteSpec } from "./licks";
import { Instrument } from "./musicEngine";

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

  const SHARP = [
    "c",
    "c#",
    "d",
    "d#",
    "e",
    "f",
    "f#",
    "g",
    "g#",
    "a",
    "a#",
    "b",
  ];
  const FLAT = [
    "c",
    "db",
    "d",
    "eb",
    "e",
    "f",
    "gb",
    "g",
    "ab",
    "a",
    "bb",
    "b",
  ];

  const pc = NOTE_INDEX[pitchPart.toLowerCase()] ?? 0;
  const octave = parseInt(octavePart, 10);

  const absolute = octave * 12 + pc + semitoneShift;
  const newOctave = Math.floor(absolute / 12);
  const newPc = ((absolute % 12) + 12) % 12;

  const newName = (preferFlats ? FLAT : SHARP)[newPc];

  return `${newName}/${newOctave}`;
}

interface VexFlowLickProps {
  lick: Lick;
  displayInstrument: Instrument;
  width?: number;
  height?: number;
}

export default function VexFlowLick({
  lick,
  displayInstrument,
  width = 520,
  height = 160,
}: VexFlowLickProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      const container = containerRef.current;
      if (!container) return;
      container.innerHTML = "";

      try {
        const VF = await import("vexflow");
        if (cancelled || !container) return;

        const {
          Renderer,
          Stave,
          StaveNote,
          Voice,
          Formatter,
          Accidental,
          Dot,
          Beam,
        } = VF;

        const renderer = new Renderer(container, Renderer.Backends.SVG);
        renderer.resize(width, height);
        const context = renderer.getContext();

        const stave = new Stave(10, 20, width - 20);
        stave.addClef("treble").addTimeSignature("4/4");
        stave.setContext(context).draw();

        const shift =
          displayInstrument === "C" ? 0 : displayInstrument === "Bb" ? 2 : 9;
        const preferFlats = lick.preferFlats;

        const vfNotes = lick.notes.map((n: VexFlowNoteSpec) => {
          let staveNote;

          if (n.rest || !n.keys) {
            staveNote = new StaveNote({
              keys: ["b/4"],
              duration: `${n.duration}r`,
            });
            if (n.duration.includes("d")) staveNote.addModifier(new Dot(), 0);
          } else {
            const transposedKeys = n.keys.map((key) =>
              transposeVexKey(key, shift, preferFlats),
            );

            staveNote = new StaveNote({
              keys: transposedKeys,
              duration: n.duration,
            });

            transposedKeys.forEach((key, index) => {
              const accidental = key.split("/")[0].substring(1);
              if (accidental) {
                staveNote.addModifier(new Accidental(accidental), index);
              }
            });

            if (n.duration.includes("d")) staveNote.addModifier(new Dot(), 0);
          }

          return staveNote;
        });

        const voice = new Voice({ time: "4/4" });
        voice.setStrict(false);
        voice.addTickables(vfNotes);

        const beams = Beam.generateBeams(vfNotes);

        new Formatter().joinVoices([voice]).format([voice], width - 100);

        voice.draw(context, stave);
        beams.forEach((b) => b.setContext(context).draw());
      } catch (error) {
        console.error("VexFlow rendering failed:", error);
        if (containerRef.current) {
          containerRef.current.innerHTML = `
            <div style="color: #8A8580; font-size: 12px; font-family: monospace; padding: 12px;">
              Could not render notation.
            </div>
          `;
        }
      }
    }

    render();

    return () => {
      cancelled = true;
    };
  }, [lick, displayInstrument, width, height]);

  return <div ref={containerRef} className="w-full overflow-x-auto" />;
}
