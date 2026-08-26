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

const ROW_HEIGHT = 90;
// Uniform shrink applied after layout is computed (via viewBox, not by
// rendering smaller from scratch) — this is what lets dense passages pack
// more compactly on screen without risking the overlap that a naive
// "just render everything smaller" approach could reintroduce, since all
// of VexFlow's own collision-free spacing decisions are preserved and
// simply scaled down together.
const NOTATION_SCALE = 0.72;

interface VexFlowLickProps {
  lick: Lick;
  displayInstrument: Instrument;
}

export default function VexFlowLick({
  lick,
  displayInstrument,
}: VexFlowLickProps) {
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

      // ---- Pass 1: build each bar's notes/voice and ask VexFlow how much
      // width it actually needs. A fixed width-per-bar (the earlier
      // approach) meant a sparse 2-note bar and a dense 11-note bebop run
      // got the same space — the dense bar would be crammed ~8x tighter
      // than it needed, which is what made the notation unreadable.
      interface BarLayout {
        barIdx: number;
        staveNotes: any[];
        voice: any;
        width: number;
      }
      const bars: BarLayout[] = [];

      for (let barIdx = 0; barIdx < barCount; barIdx++) {
        const barNotes = notesByBar[barIdx];
        const specs = barNotes.length
          ? barNotes
          : [{ rest: true, duration: "w", bar: barIdx } as VexFlowNoteSpec];

        try {
          const staveNotes = specs.map((n) => {
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
            if (n.duration.includes("d")) sn.addModifier(new Dot(), 0);
            return sn;
          });

          const voice = new Voice({ num_beats: 4, beat_value: 4 });
          voice.setStrict(false);
          voice.addTickables(staveNotes);

          // Accidentals are applied before measuring width, since an
          // accidental glyph takes real horizontal space too — measuring
          // first and adding accidentals after would under-count it.
          Accidental.applyAccidentals([voice], "C");

          const minWidth = new Formatter().preCalculateMinTotalWidth([voice]);
          const clefPadding = barIdx === 0 ? 45 : 0;
          const width = Math.ceil(minWidth) + 30 + clefPadding;

          bars.push({ barIdx, staveNotes, voice, width });
        } catch (e) {
          // A malformed bar is skipped rather than blanking the whole lick.
          continue;
        }
      }

      // ---- Pass 2: greedily wrap bars into rows that fit the container
      // width — this is what replaces horizontal scrolling with wrapping
      // to a new line, using each bar's REAL measured width rather than
      // an assumed fixed one. The wrap budget is the container width
      // divided by NOTATION_SCALE (the shrink factor applied at the end),
      // so packing decisions are made in terms of final on-screen size,
      // not the larger natural size notation is measured/drawn at.
      interface PlacedBar extends BarLayout {
        x: number;
        row: number;
      }
      const wrapWidth = containerWidth / NOTATION_SCALE;
      const placed: PlacedBar[] = [];
      let rowX = 0;
      let row = 0;
      for (const bar of bars) {
        if (rowX > 0 && rowX + bar.width > wrapWidth) {
          row += 1;
          rowX = 0;
        }
        placed.push({ ...bar, x: rowX, row });
        rowX += bar.width;
      }
      const rowCount = row + 1;
      const naturalWidth = Math.max(
        containerWidth,
        ...placed.map((b) => b.x + b.width),
      );
      const naturalHeight = rowCount * ROW_HEIGHT + 20;

      const renderer = new Renderer(container, Renderer.Backends.SVG);
      renderer.resize(naturalWidth, naturalHeight);
      const context = renderer.getContext();
      context.setFont("Arial", 9);

      // ---- Pass 3: actually draw each stave/voice/beam at its computed
      // position and width.
      for (const bar of placed) {
        const y = bar.row * ROW_HEIGHT + 10;
        const stave = new Stave(bar.x + 2, y, bar.width - 4);
        if (bar.barIdx === 0) {
          stave.addClef("treble");
        }
        stave.setContext(context).draw();

        try {
          new Formatter()
            .joinVoices([bar.voice])
            .format([bar.voice], bar.width - 30 - (bar.barIdx === 0 ? 45 : 0));
          bar.voice.draw(context, stave);

          const beams = Beam.generateBeams(bar.staveNotes);
          beams.forEach((b: any) => b.setContext(context).draw());
        } catch (e) {
          // Skip drawing this bar's notes/beams if formatting fails, but
          // leave its (empty) stave in place so the rest of the lick still
          // renders in the right position.
          continue;
        }
      }

      // Scale the whole rendered notation down via viewBox rather than
      // rendering smaller from the start — this shrinks the final size
      // while preserving every spacing decision VexFlow already made to
      // avoid collisions, so it can't reintroduce overlap the way trying
      // to render at a smaller size from scratch could.
      const svgEl = container.querySelector("svg");
      if (svgEl) {
        svgEl.setAttribute("viewBox", `0 0 ${naturalWidth} ${naturalHeight}`);
        svgEl.setAttribute(
          "width",
          `${Math.round(naturalWidth * NOTATION_SCALE)}`,
        );
        svgEl.setAttribute(
          "height",
          `${Math.round(naturalHeight * NOTATION_SCALE)}`,
        );
      }
    }

    render();
    return () => {
      cancelled = true;
    };
  }, [lick, displayInstrument, containerWidth]);

  return (
    <div ref={wrapperRef} className="w-full overflow-x-auto">
      <div ref={containerRef} />
    </div>
  );
}
