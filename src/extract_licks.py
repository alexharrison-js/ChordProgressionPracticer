import sqlite3
import json
import random
import re
import collections

DB_PATH = "wjazzd.db"
# NOTE: the version of wjazzd.db bundled in github.com/jazzomat/article_2016
# only has 10 of the performers below. For the other 6 (Chris Potter, Ravi
# Coltrane, Mark Turner, Ben Wendel, Eric Alexander, George Coleman),
# download the expanded v2.1 database (456 solos) directly from:
#   https://jazzomat.hfm-weimar.de/download/downloads/wjazzd.db
# and replace this file with that one before running this script — anyone
# not present in whichever db you're using is simply skipped (0 solos found,
# 0 licks generated for them), so it's safe to run either way.

# ----------------------------------------------------------------------------
# Note-name spelling (mirrors the app's flat/sharp key convention)
# ----------------------------------------------------------------------------
SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]
FLAT_KEY_ROOTS = {"F", "Bb", "Eb", "Ab", "Db", "Gb", "Cb"}
NOTE_TO_SEMITONE = {n: i for i, n in enumerate(SHARP_NAMES)}
NOTE_TO_SEMITONE.update({n: i for i, n in enumerate(FLAT_NAMES)})
NOTE_TO_SEMITONE["E#"] = 5
NOTE_TO_SEMITONE["B#"] = 0
NOTE_TO_SEMITONE["Fb"] = 4
NOTE_TO_SEMITONE["Cb"] = 11


def key_prefers_flats(key_field: str) -> bool:
    if not key_field:
        return False
    root = key_field.split("-")[0].strip()
    root = re.sub(r"(maj|min|dor|blues|mix|lyd|phr|loc)$", "", root, flags=re.I)
    return root in FLAT_KEY_ROOTS or "b" in root


def midi_to_name(midi: float, prefer_flats: bool):
    n = round(midi)
    pc = n % 12
    octave = n // 12 - 1
    name = (FLAT_NAMES if prefer_flats else SHARP_NAMES)[pc]
    return name, octave


# ----------------------------------------------------------------------------
# Rhythm quantization: division/tatum -> VexFlow duration string
# ----------------------------------------------------------------------------
DIVISION_TO_BEATFRAC = {1: 1.0, 2: 0.5, 3: 1.0 / 3, 4: 0.25, 5: 0.2}

STANDARD_DURATIONS = [
    (4.0, "w"),
    (3.0, "hd"),
    (2.0, "h"),
    (1.5, "qd"),
    (1.0, "q"),
    (0.75, "8d"),
    (0.5, "8"),
    (0.25, "16"),
    (0.125, "32"),
]


def nearest_duration(beats: float):
    beats = max(0.1, beats)
    best = min(STANDARD_DURATIONS, key=lambda sd: abs(sd[0] - beats))
    return best[1], best[0]


# ----------------------------------------------------------------------------
# Chord parsing + functional classification (for harmonic pattern matching)
# ----------------------------------------------------------------------------
CHORD_ROOT_RE = re.compile(r"^([A-G][b#]?)(.*)$")


def parse_chord(token: str):
    """Returns (root_semitone, quality_bucket) or None for NC/unparseable."""
    if not token or token in ("NC", "N.C.", ""):
        return None
    m = CHORD_ROOT_RE.match(token)
    if not m:
        return None
    root, rest = m.group(1), m.group(2)
    root_semi = NOTE_TO_SEMITONE.get(root)
    if root_semi is None:
        return None

    rest_lower = rest.lower()
    if rest_lower.startswith("-7b5") or rest_lower.startswith("o7") or rest_lower.startswith("h7"):
        bucket = "min7b5"
    elif rest_lower.startswith("-") or rest_lower.startswith("m") and not rest_lower.startswith("maj"):
        bucket = "min"
    elif rest_lower.startswith("maj") or rest_lower in ("", "6", "69") or rest_lower.startswith("6"):
        bucket = "maj"
    elif rest_lower.startswith("7") or "7" in rest_lower or rest_lower.startswith("9") or rest_lower.startswith("13"):
        bucket = "dom"
    elif rest_lower.startswith("o") or rest_lower.startswith("dim"):
        bucket = "dim"
    else:
        bucket = "other"
    return root_semi, bucket


def semitone_diff(a: int, b: int) -> int:
    """Shortest-path-agnostic forward distance a -> b, 0-11."""
    return (b - a) % 12


# ----------------------------------------------------------------------------
# Chord-span + section loading
# ----------------------------------------------------------------------------
def load_sections(cur, melid, section_type):
    cur.execute(
        "SELECT start,end,value FROM sections WHERE melid=? AND type=? ORDER BY start",
        (melid, section_type),
    )
    return cur.fetchall()


def chord_for_bar(chord_spans, bar):
    chord = "NC"
    for start, end, value in chord_spans:
        if start <= bar:
            chord = value
        else:
            break
    return chord


def form_label_for_bar(form_spans, bar):
    label = None
    for start, end, value in form_spans:
        if start <= bar <= end:
            return value
        if start <= bar:
            label = value
    return label


# ----------------------------------------------------------------------------
# Harmonic pattern matching — finds real ii-V / ii-V-I / minor-ii-V-i
# occurrences in the chord-span sequence (transposition-invariant: matches
# on quality bucket + relative root motion, not absolute chord names).
# ----------------------------------------------------------------------------
def find_harmonic_units(chord_spans):
    """Returns list of (start_bar, end_bar, label) for detected cadential units."""
    parsed = []
    for start, end, value in chord_spans:
        p = parse_chord(value)
        if p:
            parsed.append((start, end, p[0], p[1], value))

    units = []
    n = len(parsed)
    for i in range(n):
        s1, e1, r1, q1, v1 = parsed[i]

        # ii-V (and ii-V-I): minor7 (or min7b5) -> dominant a 4th up
        if q1 in ("min", "min7b5") and i + 1 < n:
            s2, e2, r2, q2, v2 = parsed[i + 1]
            if q2 == "dom" and semitone_diff(r1, r2) == 5:
                # try to extend to ii-V-I
                if i + 2 < n:
                    s3, e3, r3, q3, v3 = parsed[i + 2]
                    resolves_major = q3 in ("maj",) and semitone_diff(r2, r3) == 5
                    resolves_minor = q3 in ("min",) and semitone_diff(r2, r3) == 5
                    if resolves_major or resolves_minor:
                        kind = "ii-V-I" if q1 == "min" else "ii-V-i (minor)"
                        units.append((s1, e3, kind))
                        continue
                kind = "ii-V" if q1 == "min" else "ii-V (minor)"
                units.append((s1, e2, kind))

        # Plain V-I / V-i cadence not already captured above
        if q1 == "dom" and i + 1 < n:
            s2, e2, r2, q2, v2 = parsed[i + 1]
            if q2 in ("maj", "min") and semitone_diff(r1, r2) == 5:
                units.append((s1, e2, "V-I" if q2 == "maj" else "V-i"))

    return units


# ----------------------------------------------------------------------------
# Melody note grouping — converts a bar range into VexFlow-ready note data,
# with each note tagged with its bar position RELATIVE to the lick's start
# (so the renderer can group/beam notes per-measure reliably instead of
# re-deriving bar membership from accumulated durations).
# ----------------------------------------------------------------------------
def build_note_data(notes_in_range, bar_start, prefer_flats):
    vf_notes = []
    prev_pos = None
    for bar, beat, tatum, division, pitch in notes_in_range:
        rel_bar = bar - bar_start
        beat_in_bar = (beat - 1) + ((tatum - 1) / max(1, division))
        beat_in_lick = rel_bar * 4 + beat_in_bar

        frac = DIVISION_TO_BEATFRAC.get(division, 0.25)
        dur_code, dur_beats = nearest_duration(frac)
        name, octave = midi_to_name(pitch, prefer_flats)

        if prev_pos is not None:
            gap = beat_in_lick - prev_pos
            if gap > 0.2:
                rest_code, _ = nearest_duration(gap)
                # attribute the rest to whichever bar it starts in
                vf_notes.append(
                    {"rest": True, "duration": rest_code, "bar": rel_bar}
                )

        vf_notes.append(
            {
                "keys": [f"{name.lower()}/{octave}"],
                "duration": dur_code,
                "midi": round(pitch),
                "bar": rel_bar,
            }
        )
        prev_pos = beat_in_lick + dur_beats

    return vf_notes


# ----------------------------------------------------------------------------
# Main extraction
# ----------------------------------------------------------------------------
TARGET_PERFORMERS = [
    "Charlie Parker",
    "Dizzy Gillespie",
    "John Coltrane",
    "Michael Brecker",
    "Sonny Stitt",
    "Sonny Rollins",
    "Joe Henderson",
    "Cannonball Adderley",
    "Dexter Gordon",
    "Joe Lovano",
    "Chris Potter",
    "Ravi Coltrane",
    "Mark Turner",
    "Ben Wendel",
    "Eric Alexander",
    "George Coleman",
]

PRIORITY_PERFORMERS = {
    "Charlie Parker",
    "John Coltrane",
    "Sonny Stitt",
    "Sonny Rollins",
    "Chris Potter",
    "Ravi Coltrane",
    "Mark Turner",
}

MIN_NOTES = 5
MAX_NOTES = 60
MAX_LICK_BARS = 12  # long phrases get chopped into ~12-bar pieces on bar lines

random.seed(42)


def extract_phrase_licks(cur, melid, performer, title, key_field, tempo, style):
    """Primary strategy: use the transcribers' own PHRASE boundaries, tagged
    with the song-form section (e.g. "Bridge (B1)") they occur in."""
    prefer_flats = key_prefers_flats(key_field)
    chord_spans = load_sections(cur, melid, "CHORD")
    form_spans = load_sections(cur, melid, "FORM")
    phrase_spans = load_sections(cur, melid, "PHRASE")

    cur.execute(
        "SELECT bar,beat,tatum,division,pitch FROM melody WHERE melid=? ORDER BY eventid",
        (melid,),
    )
    all_notes = cur.fetchall()
    if not all_notes:
        return []

    licks = []
    for start, end, _label in phrase_spans:
        # Chop long phrases into <= MAX_LICK_BARS pieces on bar boundaries,
        # rather than either truncating or showing a 30-bar wall of notes.
        piece_start = start
        while piece_start <= end:
            piece_end = min(end, piece_start + MAX_LICK_BARS - 1)

            chunk_notes = [
                n for n in all_notes if piece_start <= n[0] <= piece_end
            ]
            if MIN_NOTES <= len(chunk_notes) <= MAX_NOTES:
                form_label = form_label_for_bar(form_spans, piece_start)
                chords_in_chunk = []
                seen = set()
                for b in range(piece_start, piece_end + 1):
                    c = chord_for_bar(chord_spans, b)
                    if c not in seen:
                        chords_in_chunk.append(c)
                        seen.add(c)

                licks.append(
                    {
                        "performer": performer,
                        "sourceTune": title,
                        "sourceKey": key_field,
                        "sourceTempo": tempo,
                        "style": style,
                        "barStart": piece_start,
                        "barCount": piece_end - piece_start + 1,
                        "chordContext": chords_in_chunk,
                        "notes": build_note_data(chunk_notes, piece_start, prefer_flats),
                        "preferFlats": prefer_flats,
                        "selectionMethod": "phrase",
                        "contextLabel": (
                            f"Phrase over {form_label}" if form_label else "Phrase"
                        ),
                    }
                )
            piece_start = piece_end + 1

    return licks


def extract_harmonic_unit_licks(cur, melid, performer, title, key_field, tempo, style):
    """Secondary strategy: find real ii-V / ii-V-I / minor-ii-V-i / V-I
    motion in the actual chord changes and pull the melody played over
    exactly that harmonic unit."""
    prefer_flats = key_prefers_flats(key_field)
    chord_spans = load_sections(cur, melid, "CHORD")
    form_spans = load_sections(cur, melid, "FORM")
    units = find_harmonic_units(chord_spans)
    if not units:
        return []

    cur.execute(
        "SELECT bar,beat,tatum,division,pitch FROM melody WHERE melid=? ORDER BY eventid",
        (melid,),
    )
    all_notes = cur.fetchall()
    if not all_notes:
        return []

    licks = []
    for start, end, kind in units:
        chunk_notes = [n for n in all_notes if start <= n[0] <= end]
        if not (MIN_NOTES <= len(chunk_notes) <= MAX_NOTES):
            continue
        form_label = form_label_for_bar(form_spans, start)
        chords_in_chunk = []
        seen = set()
        for b in range(start, end + 1):
            c = chord_for_bar(chord_spans, b)
            if c not in seen:
                chords_in_chunk.append(c)
                seen.add(c)

        licks.append(
            {
                "performer": performer,
                "sourceTune": title,
                "sourceKey": key_field,
                "sourceTempo": tempo,
                "style": style,
                "barStart": start,
                "barCount": end - start + 1,
                "chordContext": chords_in_chunk,
                "notes": build_note_data(chunk_notes, start, prefer_flats),
                "preferFlats": prefer_flats,
                "selectionMethod": "harmony",
                "contextLabel": (
                    f"{kind} over {form_label}" if form_label else kind
                ),
            }
        )

    return licks


def main():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    all_licks = []
    per_performer_count = collections.OrderedDict()

    for performer in TARGET_PERFORMERS:
        cur.execute(
            "SELECT melid,title,key,avgtempo,style FROM solo_info WHERE performer=?",
            (performer,),
        )
        solos = cur.fetchall()
        performer_licks = []
        for melid, title, key_field, tempo, style in solos:
            performer_licks.extend(
                extract_harmonic_unit_licks(
                    cur, melid, performer, title, key_field, tempo, style
                )
            )
            performer_licks.extend(
                extract_phrase_licks(
                    cur, melid, performer, title, key_field, tempo, style
                )
            )

        # Prefer harmony-matched licks first (most "sensible"/legible framing
        # for practice), then fill out with phrase-based ones, shuffled
        # within each group so repeated runs aren't always the same subset.
        harmony = [l for l in performer_licks if l["selectionMethod"] == "harmony"]
        phrase = [l for l in performer_licks if l["selectionMethod"] == "phrase"]
        random.shuffle(harmony)
        random.shuffle(phrase)

        quota = 30 if performer in PRIORITY_PERFORMERS else 14
        harmony_quota = min(len(harmony), max(3, quota // 2))
        chosen = harmony[:harmony_quota] + phrase[: quota - harmony_quota]

        per_performer_count[performer] = len(chosen)
        all_licks.extend(chosen)

    for i, lick in enumerate(all_licks):
        lick["id"] = f"wjd_{i+1:04d}"

    print("Per-performer counts:", json.dumps(per_performer_count, indent=2))
    print("Total licks:", len(all_licks))

    with open("licks_raw.json", "w") as f:
        json.dump(all_licks, f, indent=1)


if __name__ == "__main__":
    main()
