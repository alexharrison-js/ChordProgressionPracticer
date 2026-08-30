#!/usr/bin/env python3

"""
Download the Treble Clef Bopland lick images and generate browser metadata.

Project layout expected:

    ./bopland.sqlite3
    ./download_bopland_treble.py

Output:

    ./public/bopland/<hash>.png
    ./src/bopland.json
"""

from __future__ import annotations

import argparse
import json
import sqlite3
import sys
import time
from pathlib import Path
from typing import Any

import requests

PROJECT_ROOT = Path(__file__).resolve().parent
DEFAULT_DB = PROJECT_ROOT / "bopland.sqlite3"
DEFAULT_IMAGE_DIR = PROJECT_ROOT / "public" / "bopland"
DEFAULT_JSON = PROJECT_ROOT / "src" / "bopland.json"

BASE_URL = "https://bopland.org/data"
DATABASE_NAME = "treble-clef-licks"  # Internal database name 

USER_AGENT = (
    "ChordProgressionPracticer/1.0 "
    "(Bopland image downloader; personal research use)"
)

REQUEST_TIMEOUT = 30
MAX_RETRIES = 4
RETRY_DELAY = 2.0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Download Treble Clef Bopland lick images."
    )
    parser.add_argument("--db", type=Path, default=DEFAULT_DB, help=f"SQLite database (default: {DEFAULT_DB})")
    parser.add_argument("--image-dir", type=Path, default=DEFAULT_IMAGE_DIR, help=f"PNG output directory (default: {DEFAULT_IMAGE_DIR})")
    parser.add_argument("--json", dest="json_path", type=Path, default=DEFAULT_JSON, help=f"Metadata JSON output (default: {DEFAULT_JSON})")
    parser.add_argument("--limit", type=int, default=None, help="Download at most N images. Useful for testing.")
    parser.add_argument("--start", type=int, default=0, help="Start at this zero-based database index.")
    parser.add_argument("--force", action="store_true", help="Redownload images that already exist.")
    parser.add_argument("--no-download", action="store_true", help="Only generate bopland.json; do not download images.")
    return parser.parse_args()


def get_connection(db_path: Path) -> sqlite3.Connection:
    if not db_path.exists():
        raise FileNotFoundError(f"SQLite database not found: {db_path}")
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    return conn


def get_database_info(conn: sqlite3.Connection) -> dict[str, Any]:
    row = conn.execute(
        """
        SELECT name, title, count
        FROM databases
        WHERE name = ?
        """,
        (DATABASE_NAME,),
    ).fetchone()

    if row is None:
        raise RuntimeError(f'Could not find database "{DATABASE_NAME}" in SQLite database.')

    return {
        "name": row["name"],
        "title": row["title"],
        "count": row["count"],
    }


def load_licks(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    """
    Load every lick belonging to the Treble Clef database and match it
    to the TypeScript `BoplandLick` interface.
    """
    rows = conn.execute(
        """
        SELECT hash, database_name, database_title
        FROM licks 
        WHERE database_name = ?
        ORDER BY hash
        """,
        (DATABASE_NAME,),
    ).fetchall()

    licks: list[dict[str, Any]] = []

    for row in rows:
        lick_hash = row["hash"]

        # Fetch progressions. Use PRAGMA table_info if time_signature isn't guaranteed,
        # but we'll extract it defensively using row.keys() down below.
        progression_rows = conn.execute(
            """
            SELECT *
            FROM lick_progressions
            WHERE hash = ? AND database_name = ?
            ORDER BY index_type, progression
            """,
            (lick_hash, DATABASE_NAME),
        ).fetchall()

        progressions: list[str] = []
        time_signatures: list[str] = []
        seen_prog: set[str] = set()
        seen_time: set[str] = set()

        for pr in progression_rows:
            prog = pr["progression"]
            if prog and prog not in seen_prog:
                seen_prog.add(prog)
                progressions.append(prog)

            # Some schemas might have 'time_signature' or 'timeSignature', safely fetch
            keys = pr.keys()
            time_sig = None
            if "time_signature" in keys:
                time_sig = pr["time_signature"]
            elif "timeSignature" in keys:
                time_sig = pr["timeSignature"]

            if time_sig and time_sig not in seen_time:
                seen_time.add(time_sig)
                time_signatures.append(time_sig)

        licks.append({
            "id": f"bopland:{lick_hash}",
            "hash": lick_hash,
            "label": f"Bopland Lick {lick_hash}",
            "image": f"/bopland/{lick_hash}.png",
            "source": "Bopland",
            "databaseName": row["database_name"],
            "databaseTitle": row["database_title"],
            "progressions": progressions,
            "timeSignatures": time_signatures,
        })

    return licks


def write_json(licks: list[dict[str, Any]], db_info: dict[str, Any], json_path: Path) -> None:
    """
    Generate JSON matching the `BoplandCompendium` TS interface.
    """
    compendium = {
        "meta": {
            "source": "Bopland",
            "sourceUrl": "https://bopland.org",
            "databaseName": db_info["name"],
            "databaseTitle": db_info["title"],
            "generatedLickCount": len(licks),
            "imageBaseUrl": "/bopland/",
            "description": "Bopland image-based lick collection."
        },
        "licks": licks
    }

    json_path.parent.mkdir(parents=True, exist_ok=True)
    with json_path.open("w", encoding="utf-8") as f:
        json.dump(compendium, f, indent=2, ensure_ascii=False)
        f.write("\n")


def download_images(licks: list[dict[str, Any]], image_dir: Path, force: bool) -> None:
    image_dir.mkdir(parents=True, exist_ok=True)
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})

    total = len(licks)
    print(f"\nDownloading {total} images to {image_dir}...")

    for i, lick in enumerate(licks, 1):
        lick_hash = lick["hash"]
        img_path = image_dir / f"{lick_hash}.png"

        if not force and img_path.exists() and img_path.stat().st_size > 0:
            print(f"[{i:4d}/{total}] {lick_hash}: already exists")
            continue

        url = f"{BASE_URL}/{lick_hash}.png"
        
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                resp = session.get(url, timeout=REQUEST_TIMEOUT)
                resp.raise_for_status()

                if not resp.content.startswith(b"\x89PNG"):
                    print(f"[{i:4d}/{total}] {lick_hash}: FAILED (not a PNG)")
                    break

                # Atomic write
                temp_path = img_path.with_suffix(".tmp")
                temp_path.write_bytes(resp.content)
                temp_path.replace(img_path)

                print(f"[{i:4d}/{total}] {lick_hash}: downloaded")
                break
            except Exception as exc:
                if attempt < MAX_RETRIES:
                    time.sleep(RETRY_DELAY)
                else:
                    print(f"[{i:4d}/{total}] {lick_hash}: FAILED ({exc})")
        
        # Minor delay to avoid hammering the server
        time.sleep(0.1)


def main() -> int:
    args = parse_args()

    print("Connecting to SQLite database...")
    conn = get_connection(args.db)
    
    db_info = get_database_info(conn)
    print(f"Found DB: {db_info['title']} (Expected items: {db_info['count']})")

    print("Loading licks...")
    licks = load_licks(conn)

    # Apply slicers if testing
    if args.start > 0:
        licks = licks[args.start:]
    if args.limit:
        licks = licks[:args.limit]

    print(f"Generated {len(licks)} application licks.")

    print(f"Writing {args.json_path}...")
    write_json(licks, db_info, args.json_path)

    if not args.no_download:
        download_images(licks, args.image_dir, args.force)
    else:
        print("\nSkipping image downloads due to --no-download flag.")

    print("\nDone!")
    return 0


if __name__ == "__main__":
    sys.exit(main())