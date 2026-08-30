#!/usr/bin/env python3
"""
test_bopland_omr.py

Download a small sample of BopLand lick notation images, run Oemer on them,
convert the resulting MusicXML into the Lick/VexFlow JSON shape used by
ChordProgressionPracticer, and write a test corpus.

Expected project layout:

    ChordProgressionPracticer/
    ├── bopland.sqlite3
    └── test_bopland_omr.py

Install:
    python3 -m pip install requests
    python3 -m pip install oemer

Run:
    python3 test_bopland_omr.py

Optional:
    python3 test_bopland_omr.py --count 10
    python3 test_bopland_omr.py --count 3 --output bopland_test
    python3 test_bopland_omr.py --db /path/to/bopland.sqlite3

The script deliberately processes only a small sample first. Once the OMR
accuracy looks good, this can be expanded into the full 2,458-lick importer.
"""

from __future__ import annotations

import argparse
import json
import shutil
import sqlite3
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any


BOPLAND_BASE = "https://bopland.org/data"
DEFAULT_DB = Path(__file__).resolve().parent / "bopland.sqlite3"
DEFAULT_OUTPUT = Path(__file__).resolve().parent / "bopland_test"

USER_AGENT = (
    "ChordProgressionPracticer/1.0 "
    "(BopLand lick corpus test importer)"
)

# MusicXML duration -> VexFlow duration code.
# We also calculate from <duration>/<divisions>, which is more reliable than
# relying only on the MusicXML <type> string.
TYPE_TO_VEX = {
    "whole": "w",
    "half": "h",
    "quarter": "q",
    "eighth": "8",
    "16th": "16",
    "32nd": "32",
    "64th": "64",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Test BopLand PNG -> Oemer -> MusicXML -> VexFlow JSON pipeline."
    )
    parser.add_argument(
        "--db",
        type=Path,
        default=DEFAULT_DB,
        help=f"Path to bopland.sqlite3 (default: {DEFAULT_DB})",
    )
    parser.add_argument(
        "--count",
        type=int,
        default=10,
        help="Number of licks to process (default: 10)",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help=f"Output directory (default: {DEFAULT_OUTPUT})",
    )
    parser.add_argument(
        "--keep-xml",
        action="store_true",
        help="Keep the Oemer MusicXML files (default: keep them anyway; this "
             "flag is retained for compatibility/future expansion).",
    )
    return parser.parse_args()


def check_executable(name: str) -> None:
    if shutil.which(name) is None:
        raise RuntimeError(
            f"Could not find '{name}' on PATH.\n"
            f"Install it first, then try again."
        )


def load_sample_from_sqlite(db_path: Path, count: int) -> list[dict[str, Any]]:
    """
    The BopLand SQLite database already gives us the lick hash and progression,
    so there is no reason to scrape the JavaScript index for this test.
    """
    if not db_path.exists():
        raise FileNotFoundError(f"Database not found: {db_path}")

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    try:
        rows = conn.execute(
            """
            SELECT
                l.hash,
                l.database_name,
                l.database_title,
                GROUP_CONCAT(
                    DISTINCT CASE
                        WHEN lp.progression IS NOT NULL
                        THEN lp.progression
                    END
                ) AS progressions
            FROM licks AS l
            LEFT JOIN lick_progressions AS lp
                ON lp.hash = l.hash
            GROUP BY
                l.hash,
                l.database_name,
                l.database_title
            ORDER BY l.hash
            LIMIT ?
            """,
            (count,),
        ).fetchall()
    finally:
        conn.close()

    result = []
    for row in rows:
        progressions = []
        raw = row["progressions"] or ""

        # GROUP_CONCAT uses commas as separators. Progression strings in the
        # database are expected to be distinct progression representations.
        for p in raw.split(","):
            p = p.strip()
            if p and p not in progressions:
                progressions.append(p)

        result.append(
            {
                "hash": row["hash"],
                "databaseName": row["database_name"],
                "databaseTitle": row["database_title"],
                "progressions": progressions,
            }
        )

    return result


def download_file(url: str, destination: Path) -> None:
    import requests

    destination.parent.mkdir(parents=True, exist_ok=True)

    if destination.exists() and destination.stat().st_size > 0:
        print(f"  already downloaded: {destination.name}")
        return

    print(f"  downloading: {url}")

    response = requests.get(
        url,
        headers={"User-Agent": USER_AGENT},
        timeout=30,
    )
    response.raise_for_status()

    destination.write_bytes(response.content)

    if destination.stat().st_size == 0:
        raise RuntimeError(f"Downloaded empty file: {destination}")


def run_oemer(image_path: Path, xml_path: Path) -> Path:
    """
    Run Oemer and return the MusicXML file it produced.

    Oemer's current CLI accepts:
        oemer <image> -o <output-path>

    Some versions interpret the output path as a directory while others
    accept a filename, so this function handles both cases.
    """
    xml_path.parent.mkdir(parents=True, exist_ok=True)

    # Put each lick into its own output directory. This makes the script
    # robust to Oemer versions that choose their own output filename.
    output_dir = xml_path.parent / f"{image_path.stem}_oemer"
    output_dir.mkdir(parents=True, exist_ok=True)

    command = [
        "oemer",
        str(image_path),
        "-o",
        str(output_dir),
    ]

    print("  running Oemer...")
    print("   ", " ".join(command))

    result = subprocess.run(
        command,
        capture_output=True,
        text=True,
    )

    if result.stdout.strip():
        print("  Oemer:", result.stdout.strip()[-1200:])

    if result.returncode != 0:
        print("  Oemer stderr:", result.stderr.strip()[-2000:])
        raise RuntimeError(
            f"Oemer failed for {image_path.name} with exit code "
            f"{result.returncode}"
        )

    candidates = sorted(output_dir.glob("*.musicxml"))
    if not candidates:
        candidates = sorted(output_dir.glob("*.xml"))

    if not candidates:
        raise RuntimeError(
            f"Oemer completed but no MusicXML file was found in {output_dir}"
        )

    # Usually there is exactly one.
    produced = candidates[0]

    shutil.copy2(produced, xml_path)

    return xml_path


def strip_namespace(tag: str) -> str:
    if "}" in tag:
        return tag.rsplit("}", 1)[1]
    return tag


def child(element: ET.Element, name: str) -> ET.Element | None:
    for c in element:
        if strip_namespace(c.tag) == name:
            return c
    return None


def child_text(element: ET.Element, name: str, default: str = "") -> str:
    c = child(element, name)
    return c.text.strip() if c is not None and c.text else default


def midi_from_pitch(step: str, octave: int, alter: int = 0) -> int:
    base = {
        "C": 0,
        "D": 2,
        "E": 4,
        "F": 5,
        "G": 7,
        "A": 9,
        "B": 11,
    }[step]
    return (octave + 1) * 12 + base + alter


def vex_key_from_pitch(step: str, octave: int, alter: int) -> str:
    """
    Produce VexFlow-compatible pitch spelling.

    We preserve MusicXML's accidental spelling where possible rather than
    converting everything to sharps/flats based only on pitch class.
    """
    names = {
        -2: "bb",
        -1: "b",
        0: "",
        1: "#",
        2: "##",
    }

    accidental = names.get(alter)
    if accidental is None:
        # Fallback for unusual MusicXML alterations.
        accidental = "#" * alter if alter > 0 else "b" * (-alter)

    return f"{step.lower()}{accidental}/{octave}"


def vex_duration(
    note_type: str,
    dotted: bool,
    duration_value: int | None,
    divisions: int,
) -> str:
    """
    Convert MusicXML duration to the VexFlow duration codes used by the app.

    We prefer the MusicXML <type>, but use duration/divisions as a fallback.
    """
    if note_type in TYPE_TO_VEX:
        code = TYPE_TO_VEX[note_type]
    else:
        if divisions <= 0 or duration_value is None:
            code = "q"
        else:
            beats = duration_value / divisions

            candidates = [
                (4.0, "w"),
                (3.0, "hd"),
                (2.0, "h"),
                (1.5, "qd"),
                (1.0, "q"),
                (0.75, "8d"),
                (0.5, "8"),
                (0.25, "16"),
                (0.125, "32"),
                (0.0625, "64"),
            ]
            code = min(
                candidates,
                key=lambda pair: abs(pair[0] - beats),
            )[1]

    if dotted and not code.endswith("d"):
        code += "d"

    return code


def parse_musicxml(xml_path: Path) -> tuple[list[dict[str, Any]], int, int]:
    """
    Convert Oemer MusicXML into the note representation expected by the app.

    Returns:
        notes, bar_count, divisions
    """
    tree = ET.parse(xml_path)
    root = tree.getroot()

    notes: list[dict[str, Any]] = []

    # Find all parts. For this test we primarily expect one treble-clef part.
    parts = [
        element
        for element in root.iter()
        if strip_namespace(element.tag) == "part"
    ]

    if not parts:
        raise RuntimeError(f"No <part> elements found in {xml_path}")

    bar_index = 0
    first_divisions = 1

    for part in parts:
        measures = [
            element
            for element in part
            if strip_namespace(element.tag) == "measure"
        ]

        # If there are multiple parts, keep the first part as the melodic
        # source. BopLand's treble-clef lick images should normally contain
        # one melodic staff.
        for measure in measures:
            attributes = child(measure, "attributes")
            divisions = first_divisions

            if attributes is not None:
                d = child_text(attributes, "divisions")
                if d:
                    try:
                        divisions = int(d)
                        first_divisions = divisions
                    except ValueError:
                        pass

            # MusicXML position is measured in divisions from the beginning
            # of the measure. This is useful for reporting/debugging, while
            # VexFlow gets the actual duration sequence.
            for mx_note in measure:
                if strip_namespace(mx_note.tag) != "note":
                    continue

                duration_text = child_text(mx_note, "duration")
                try:
                    duration_value = int(duration_text) if duration_text else None
                except ValueError:
                    duration_value = None

                rest = child(mx_note, "rest") is not None
                dotted = child(mx_note, "dot") is not None
                note_type = child_text(mx_note, "type")

                duration = vex_duration(
                    note_type,
                    dotted,
                    duration_value,
                    divisions,
                )

                item: dict[str, Any] = {
                    "duration": duration,
                    "bar": bar_index,
                }

                if rest:
                    item["rest"] = True
                else:
                    pitch = child(mx_note, "pitch")
                    if pitch is None:
                        continue

                    step = child_text(pitch, "step", "C")
                    octave_text = child_text(pitch, "octave", "4")
                    alter_text = child_text(pitch, "alter", "0")

                    try:
                        octave = int(octave_text)
                    except ValueError:
                        octave = 4

                    try:
                        alter = int(float(alter_text))
                    except ValueError:
                        alter = 0

                    item["keys"] = [
                        vex_key_from_pitch(step, octave, alter)
                    ]
                    item["midi"] = midi_from_pitch(step, octave, alter)

                notes.append(item)

            bar_index += 1

        # Use the first part only. This avoids duplicating notes if Oemer emits
        # additional tracks/staves.
        break

    return notes, max(1, bar_index), first_divisions


def infer_context_label(progressions: list[str]) -> str:
    if not progressions:
        return "BopLand lick"

    p = progressions[0].lower()

    if "dm7" in p and "g7" in p and "cmaj" in p:
        return "ii–V–I"

    if "ii" in p and "v" in p and "i" in p:
        return "ii–V–I"

    if "ii" in p and "v" in p:
        return "ii–V"

    return "BopLand harmonic vocabulary"


def build_lick(
    item: dict[str, Any],
    notes: list[dict[str, Any]],
    bar_count: int,
) -> dict[str, Any]:
    progressions = item["progressions"]

    return {
        "id": f"bopland_{item['hash']}",
        "label": f"BopLand Lick #{item['hash']}",
        "contextLabel": infer_context_label(progressions),
        "selectionMethod": "bopland",
        "performer": "BopLand",
        "style": "BEBOP",
        "sourceTune": "BopLand",
        "sourceKey": "",
        "sourceTempo": None,
        "barStart": 0,
        "barCount": bar_count,
        "chordContext": progressions,
        "preferFlats": True,
        "notes": notes,
        "source": "bopland",
        "boplandHash": item["hash"],
        "boplandDatabase": item["databaseName"],
        "boplandDatabaseTitle": item["databaseTitle"],
    }


def main() -> int:
    args = parse_args()

    print("=" * 72)
    print("BOPLAND OMR TEST")
    print("=" * 72)

    print(f"Database : {args.db}")
    print(f"Samples  : {args.count}")
    print(f"Output   : {args.output}")
    print()

    check_executable("oemer")

    try:
        import requests  # noqa: F401
    except ImportError:
        raise RuntimeError(
            "Python package 'requests' is missing.\n"
            "Install it with:\n\n"
            "    python3 -m pip install requests\n"
        )

    args.output.mkdir(parents=True, exist_ok=True)
    image_dir = args.output / "images"
    xml_dir = args.output / "musicxml"
    image_dir.mkdir(exist_ok=True)
    xml_dir.mkdir(exist_ok=True)

    samples = load_sample_from_sqlite(args.db, args.count)

    if not samples:
        raise RuntimeError("No licks found in the BopLand database.")

    print(f"Selected {len(samples)} licks:\n")

    all_licks: list[dict[str, Any]] = []
    failures: list[dict[str, str]] = []

    for index, item in enumerate(samples, start=1):
        lick_hash = item["hash"]

        print("-" * 72)
        print(f"[{index}/{len(samples)}] {lick_hash}")
        print(f"  database: {item['databaseTitle']}")
        print(f"  progressions: {item['progressions']}")

        image_path = image_dir / f"{lick_hash}.png"
        xml_path = xml_dir / f"{lick_hash}.musicxml"

        try:
            download_file(
                f"{BOPLAND_BASE}/{lick_hash}.png",
                image_path,
            )

            # Avoid rerunning Oemer if the XML already exists.
            if xml_path.exists() and xml_path.stat().st_size > 0:
                print(f"  already processed: {xml_path.name}")
            else:
                run_oemer(image_path, xml_path)

            notes, bar_count, _divisions = parse_musicxml(xml_path)

            lick = build_lick(item, notes, bar_count)
            all_licks.append(lick)

            sounding = sum(1 for n in notes if not n.get("rest"))
            rests = sum(1 for n in notes if n.get("rest"))

            print(
                f"  ✓ parsed {bar_count} bars, "
                f"{sounding} notes, {rests} rests"
            )

            print("  notes:")
            for n in notes:
                if n.get("rest"):
                    print(f"    REST {n['duration']}  bar={n['bar']}")
                else:
                    print(
                        f"    {n['keys'][0]:8s} "
                        f"midi={n['midi']:3d} "
                        f"{n['duration']:3s} "
                        f"bar={n['bar']}"
                    )

        except Exception as exc:
            print(f"  ✗ FAILED: {exc}")
            failures.append(
                {
                    "hash": lick_hash,
                    "error": str(exc),
                }
            )

        # Be polite to the public server when processing multiple images.
        if index < len(samples):
            time.sleep(0.5)

    corpus = {
        "meta": {
            "source": "BopLand",
            "sourceUrl": "https://bopland.org",
            "license": "See BopLand's current terms/license before redistribution.",
            "attribution": "BopLand",
            "citation": "BopLand jazz lick database",
            "generatedLickCount": len(all_licks),
        },
        "licks": all_licks,
    }

    json_path = args.output / "bopland_test.json"
    json_path.write_text(
        json.dumps(corpus, indent=2),
        encoding="utf-8",
    )

    failures_path = args.output / "failures.json"
    failures_path.write_text(
        json.dumps(failures, indent=2),
        encoding="utf-8",
    )

    print()
    print("=" * 72)
    print("RESULT")
    print("=" * 72)
    print(f"Successful licks : {len(all_licks)}")
    print(f"Failed licks     : {len(failures)}")
    print(f"JSON             : {json_path}")
    print(f"Images           : {image_dir}")
    print(f"MusicXML         : {xml_dir}")
    print(f"Failures         : {failures_path}")
    print()

    if failures:
        print("Failures:")
        for failure in failures:
            print(f"  {failure['hash']}: {failure['error']}")

    print()
    print("Next step: inspect bopland_test.json and the MusicXML/PNG pairs.")
    print("If the OMR is accurate, we can expand this to the full corpus.")

    return 0 if all_licks else 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("\nInterrupted.")
        raise SystemExit(130)
    except Exception as exc:
        print(f"\nERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
