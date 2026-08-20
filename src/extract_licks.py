import sqlite3
import json
import random
import re

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


def key_prefers_flats(key_field: str) -> bool:
    if not key_field:
        return False
    root = key_field.split("-")[0].strip()
    # normalize things like "Bbmin" -> "Bb"
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
# duration in beats implied by (tatum position, division count)
DIVISION_TO_BEATFRAC = {1: 1.0, 2: 0.5, 3: 1.0 / 3, 4: 0.25, 5: 0.2}

# nearest standard notatable duration (in beats) -> vexflow duration code
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
# Chord-change parsing (from the `sections` table, type='CHORD', which we
# confirmed spans are indexed directly by the melody table's `bar` column)
# ----------------------------------------------------------------------------
def load_chord_spans(cur, melid):
    cur.execute(
        "SELECT start,end,value FROM sections WHERE melid=? AND type='CHORD' ORDER BY start",
        (melid,),
    )
    return cur.fetchall()


def chord_for_bar(spans, bar):
    chord = "NC"
    for start, end, value in spans:
        if start <= bar:
            chord = value
        else:
            break
    return chord


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
    # Only present in the expanded v2.1/456-solo database — see the note
    # above DB_PATH. Harmless to leave in either way; a performer with 0
    # solos in whichever db is loaded just yields 0 licks for them.
    "Chris Potter",
    "Ravi Coltrane",
    "Mark Turner",
    "Ben Wendel",
    "Eric Alexander",
    "George Coleman",
]

# The user asked for extra attention (more licks) for these.
PRIORITY_PERFORMERS = {
    "Charlie Parker",
    "John Coltrane",
    "Sonny Stitt",
    "Sonny Rollins",
    "Chris Potter",
    "Ravi Coltrane",
    "Mark Turner",
}

CHUNK_BARS = 8  # bars per candidate lick
MIN_NOTES = 5
MAX_NOTES = 100

random.seed(42)


def extract_licks_for_solo(cur, melid, performer, title, key_field, tempo, style):
    prefer_flats = key_prefers_flats(key_field)
    spans = load_chord_spans(cur, melid)

    cur.execute(
        "SELECT bar,beat,tatum,division,pitch FROM melody WHERE melid=? ORDER BY eventid",
        (melid,),
    )
    notes = cur.fetchall()
    if not notes:
        return []

    max_bar = max(n[0] for n in notes)
    licks = []

    for chunk_start in range(0, max_bar + 1, CHUNK_BARS):
        chunk_end = chunk_start + CHUNK_BARS
        chunk_notes = [n for n in notes if chunk_start <= n[0] < chunk_end]
        if len(chunk_notes) < MIN_NOTES or len(chunk_notes) > MAX_NOTES:
            continue

        vf_notes = []
        chunk_start_beat = chunk_start * 4.0
        chunk_end_beat = chunk_end * 4.0
        current_beat = chunk_start_beat

        for i, (bar, beat, tatum, division, pitch) in enumerate(chunk_notes):
            # Calculate absolute beat position of this note
            abs_beat = (bar * 4.0) + (beat - 1.0) + ((tatum - 1.0) / max(1.0, division))
            
            # Find when this note ends (onset of next note, or end of chunk)
            if i + 1 < len(chunk_notes):
                n_bar, n_beat, n_tatum, n_div, _ = chunk_notes[i+1]
                next_abs_beat = (n_bar * 4.0) + (n_beat - 1.0) + ((n_tatum - 1.0) / max(1.0, n_div))
                end_beat = min(next_abs_beat, chunk_end_beat)
            else:
                end_beat = min(abs_beat + 1.0, chunk_end_beat) # Cap final note at 1 beat max

            # 1. Fill any gap BEFORE this note with rests
            if abs_beat > current_beat:
                rest_beats = abs_beat - current_beat
                for r_code in decompose_beats(rest_beats):
                    vf_notes.append({"rest": True, "duration": r_code})

            # 2. Add the note itself
            dur_beats = end_beat - abs_beat
            name, octave = midi_to_name(pitch, prefer_flats)
            
            note_codes = decompose_beats(dur_beats)
            for j, n_code in enumerate(note_codes):
                # If a note is split into two durations (e.g., 1.25 beats = q + 16), 
                # they should technically be tied, but placing consecutive identical pitches 
                # is standard VexFlow phrasing for now.
                vf_notes.append({
                    "keys": [f"{name.lower()}/{octave}"],
                    "duration": n_code,
                    "midi": round(pitch)
                })

            current_beat = abs_beat + sum(val for val, code in 
                                          [(4.0, "w"), (3.0, "hd"), (2.0, "h"), (1.5, "qd"), 
                                           (1.0, "q"), (0.75, "8d"), (0.5, "8"), (0.25, "16")] 
                                          if code in note_codes)

        # 3. Fill the end of the chunk with rests if it didn't perfectly reach 8 beats
        if current_beat < chunk_end_beat:
            for r_code in decompose_beats(chunk_end_beat - current_beat):
                vf_notes.append({"rest": True, "duration": r_code})

        chords_in_chunk = []
        seen = set()
        for b in range(chunk_start, chunk_end):
            c = chord_for_bar(spans, b)
            if c and c not in seen or not chords_in_chunk:
                chords_in_chunk.append(c)
                seen.add(c)

        licks.append({
            "performer": performer,
            "sourceTune": title,
            "sourceKey": key_field,
            "sourceTempo": tempo,
            "style": style,
            "barStart": chunk_start,
            "barCount": CHUNK_BARS,
            "chordContext": chords_in_chunk,
            "notes": vf_notes,
            "preferFlats": prefer_flats,
        })

    return licks

def decompose_beats(beats: float):
    """Breaks a floating point beat duration into exact VexFlow standard durations."""
    beats = round(beats * 4) / 4.0 # snap to exact 16th note grid
    codes = []
    mapping = [
        (4.0, "w"), (3.0, "hd"), (2.0, "h"), (1.5, "qd"),
        (1.0, "q"), (0.75, "8d"), (0.5, "8"), (0.25, "16")
    ]
    
    while beats > 0.1: # tolerance for floating point
        for val, code in mapping:
            if beats >= val - 0.01:
                codes.append(code)
                beats -= val
                break
        else:
            break
    return codes

def main():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    all_licks = []
    per_performer_count = {}

    for performer in TARGET_PERFORMERS:
        cur.execute(
            "SELECT melid,title,key,avgtempo,style FROM solo_info WHERE performer=?",
            (performer,),
        )
        solos = cur.fetchall()
        performer_licks = []
        for melid, title, key_field, tempo, style in solos:
            performer_licks.extend(
                extract_licks_for_solo(
                    cur, melid, performer, title, key_field, tempo, style
                )
            )
        random.shuffle(performer_licks)

        quota = 30 if performer in PRIORITY_PERFORMERS else 14
        chosen = performer_licks[:quota]
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
