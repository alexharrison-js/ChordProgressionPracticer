# ChordProgressionPracticer

Practice Common Jazz Standards in original and transposed keys
Live: https://alexharrison-js.github.io/ChordProgressionPracticer/

# Claude Generated Readme

# Jazz Standards JSON — Schema Reference

`jazz_standards.json` contains 127 jazz standards as a JSON array, alphabetized by title.

## Schema

```json
{
  "title": "string",
  "composer": "string",
  "key": "string (e.g. 'Bb', 'F#', 'Eb')",
  "mode": "major | minor",
  "timeSignature": { "numerator": 4, "denominator": 4 },
  "tempo": { "bpm": 160, "source": "string describing where this BPM came from" },
  "verified": true | false,
  "notes": "optional string — context, caveats, alternate versions",
  "form": ["A", "A", "B", "A"],
  "sections": {
    "A": {
      "repeat": false,
      "measures": [
        {
          "chords": [
            { "root": "D", "quality": "-7", "beats": 4 }
          ],
          "spansBars": 1
        }
      ]
    }
  },
  "intro": { "measures": [...] },
  "coda": { "measures": [...] },
  "tag": { "measures": [...] }
}
```

## Critical convention: `beats` vs `spansBars`

This is the one rule a playback/transposition engine MUST get right:

- **`beats`** = how many beats _that chord_ occupies **within a single bar**, relative to `timeSignature.numerator`.
  - If a bar has ONE chord: `beats` always equals the time signature's numerator (e.g. `4` in 4/4, `3` in 3/4, `6` in 6/4).
  - If a bar has MULTIPLE chords: their `beats` values must **sum** to the numerator (e.g. two chords in 4/4 might be `2` and `2`, or `3` and `1`; two chords in 3/4 would be `1.5` and `1.5` or `2` and `1`).
- **`spansBars`** (optional, default `1`) = how many consecutive bars this _same_ measure entry covers. It does **not** multiply or change the `beats` value — `beats` still describes one bar's worth of value. Use this for vamps/pedal points (e.g. one chord held for 8 bars → `spansBars: 8`, `beats` still `4` in 4/4).
- `spansBars` should only appear on **single-chord** measures. A bar with multiple chords always represents exactly one bar (`spansBars` omitted or `1`).

### Examples

- One chord, one bar, 4/4: `{ "chords": [{ "root": "C", "quality": "maj7", "beats": 4 }] }`
- Two chords in one 4/4 bar (2 beats each): `{ "chords": [{ "root": "D", "quality": "-7", "beats": 2 }, { "root": "G", "quality": "7", "beats": 2 }] }`
- One chord held for 8 bars in 4/4 (vamp): `{ "chords": [{ "root": "D", "quality": "-7", "beats": 4 }], "spansBars": 8 }`
- One chord, one bar, 3/4 waltz: `{ "chords": [{ "root": "Bb", "quality": "maj7", "beats": 3 }] }`
- Two chords splitting one 3/4 bar evenly: `beats: 1.5` each

## Transposition

To transpose: map every `root` through your chromatic interval shift; **never touch `quality`**. Update the top-level `key` field. `mode` stays the same unless you're doing a major/minor reharmonization (rare/manual).

## Form, sections, and repeats

- `form` is the ordered list of section labels for the _main_ chorus (e.g. AABA = `["A","A","B","A"]`). Walk this array to build full playback order.
- `sections` holds each _unique_ section's chord data once — even if `form` repeats a label multiple times.
- `repeat: true` on a section means "play this section's measures twice" before moving to the next item in `form` (used for simple AB blues/bossa forms where the whole structure repeats once internally — check usage per song, as most multi-section AABA tunes encode repetition via `form` instead).
- `intro`, `coda`, and `tag` are top-level, optional, and **outside** the `form` array:
  - `intro` plays once before `form` starts.
  - `coda` plays once after `form` finishes (typically a different/extended ending).
  - `tag` plays once, typically appended after the final time through `form`.
  - All three use the same `measures`/`chords`/`spansBars` shape as regular sections.
  - Most songs omit these entirely (only included where commonly used, e.g. "Round Midnight").

## `verified` field — IMPORTANT CAVEAT

- **`verified: true`** (51 songs) — changes match commonly-documented/canonical versions of the tune with reasonable confidence.
- **`verified: false`** (76 songs) — changes are a good-faith reconstruction from general jazz-theory/repertoire knowledge, NOT independently checked against a specific New Real Book page. Treat these as a strong starting draft, not gospel — especially for:
  - Less common/specialty repertoire (e.g. "For Regulars Only," "Isotope," "Interplay")
  - Tunes with well-known alternate versions across different real books
  - Bridges and second-A variations on AABA standards (these are the most error-prone part of any transcription)

**Recommendation:** before using this commercially or relying on it for performance, spot-check the `verified: false` entries — particularly the ones you play most — against your actual Real Book or a trusted lead sheet.

## Tempo (`bpm`) caveat

Real Books almost never print tempo numbers. Every `tempo.bpm` value here is either:

- A reasonable estimate based on a well-known recording (`source` will reference the recording), or
- A generic "typical performance tempo" estimate, or
- The default fallback of **120 BPM** where no confident estimate was available (per your instruction).

These should be treated as a _starting point_ for your app, not authoritative.

## Known simplifications

- Some altered/extension chords are abbreviated generically as `7alt` (meaning "altered dominant — b9, #9, #11, or #5 per player's choice") rather than spelling out one specific alteration, since many tunes' real-book voicings vary by edition here. You may want a lookup table in your app that maps `7alt` to a default alteration (e.g. `7b9`) for sound playback purposes.
- Modal tunes (So What, Impressions, Milestones, Maiden Voyage) are represented as long single-chord vamps via `spansBars`, which is accurate to how they're actually played, but means there's less "chord content" to transpose/display than a typical changes-based tune — this is correct, not a bug.
