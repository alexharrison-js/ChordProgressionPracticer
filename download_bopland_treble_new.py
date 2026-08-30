#!/usr/bin/env python3

"""
Download the Treble Clef Bopland lick images and generate browser metadata.

Project layout expected:

    ./bopland.sqlite3
    ./download_bopland_treble.py

Output:

    ./public/bopland/<hash>.png
    ./src/bopland.json

The React app only needs the generated JSON and PNGs. SQLite is not shipped
to the browser.

Bopland image endpoint observed from the site's network traffic:

    https://bopland.org/data/<HASH>.png

Only the "Treble Clef Licks" database is included.
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
DATABASE_NAME = "Treble Clef Licks"

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

    parser.add_argument(
        "--db",
        type=Path,
        default=DEFAULT_DB,
        help=f"SQLite database (default: {DEFAULT_DB})",
    )

    parser.add_argument(
        "--image-dir",
        type=Path,
        default=DEFAULT_IMAGE_DIR,
        help=f"PNG output directory (default: {DEFAULT_IMAGE_DIR})",
    )

    parser.add_argument(
        "--json",
        dest="json_path",
        type=Path,
        default=DEFAULT_JSON,
        help=f"Metadata JSON output (default: {DEFAULT_JSON})",
    )

    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Download at most N images. Useful for testing.",
    )

    parser.add_argument(
        "--start",
        type=int,
        default=0,
        help="Start at this zero-based database index.",
    )

    parser.add_argument(
        "--force",
        action="store_true",
        help="Redownload images that already exist.",
    )

    parser.add_argument(
        "--no-download",
        action="store_true",
        help="Only generate bopland.json; do not download images.",
    )

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
        raise RuntimeError(
            f'Could not find database "{DATABASE_NAME}" in SQLite database.'
        )

    return {
        "name": row["name"],
        "title": row["title"],
        "count": row["count"],
    }


def load_licks(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    """
    Load every lick belonging to the Treble Clef database.

    Progressions are stored in lick_progressions, potentially with multiple
    index types for the same lick. We preserve all distinct progression
    strings, while avoiding duplicates.
    """

    rows = conn.execute(
        """
        SELECT
            l.hash,
            l.database_name,
            l.database_title
        FROM licks AS l
        WHERE l.database_name = ?
        ORDER BY l.hash
        """,
        (DATABASE_NAME,),
    ).fetchall()

    licks: list[dict[str, Any]] = []

    for row in rows:
        lick_hash = row["hash"]

        progression_rows = conn.execute(
            """
            SELECT progression
            FROM lick_progressions
            WHERE hash = ?
              AND database_name = ?
            ORDER BY index_type, progression
            """,
            (lick_hash, DATABASE_NAME),
        ).fetchall()

        progressions: list[str] = []
        seen: set[str] = set()

        for progression_row in progression_rows:
            progression = progression_row["progression"]

            if progression is None:
                continue

            progression = str(progression).strip()

            if not progression or progression in seen:
                continue

            seen.add(progression)
            progressions.append(progression)

        time_signature_rows = conn.execute(
            """
            SELECT time_signature
            FROM lick_time_signatures
            WHERE hash = ?
              AND database_name = ?
            ORDER BY time_signature
            """,
            (lick_hash, DATABASE_NAME),
        ).fetchall()

        time_signatures: list[str] = []
        seen_ts: set[str] = set()

        for ts_row in time_signature_rows:
            ts = ts_row["time_signature"]

            if ts is None:
                continue

            ts = str(ts).strip()

            if not ts or ts in seen_ts:
                continue

            seen_ts.add(ts)
            time_signatures.append(ts)

        licks.append(
            {
                "id": f"bopland:{lick_hash}",
                "hash": lick_hash,
                "label": f"Bopland Lick {lick_hash}",
                "image": f"/bopland/{lick_hash}.png",
                "source": "Bopland",
                "databaseName": row["database_name"],
                "databaseTitle": row["database_title"],
                "progressions": progressions,
                "timeSignatures": time_signatures,
            }
        )

    return licks


def download_image(
    session: requests.Session,
    lick: dict[str, Any],
    output_path: Path,
) -> tuple[bool, str]:
    lick_hash = lick["hash"]
    url = f"{BASE_URL}/{lick_hash}.png"

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = session.get(
                url,
                timeout=REQUEST_TIMEOUT,
            )

            if response.status_code == 200:
                content_type = response.headers.get("Content-Type", "")

                if not response.content:
                    raise RuntimeError("empty response")

                # Don't make Content-Type mandatory because some simple
                # servers return image data without a useful MIME header.
                output_path.write_bytes(response.content)

                return True, f"downloaded ({len(response.content):,} bytes)"

            if response.status_code == 404:
                return False, "404 not found"

            if response.status_code in (429, 500, 502, 503, 504):
                if attempt < MAX_RETRIES:
                    delay = RETRY_DELAY * attempt
                    time.sleep(delay)
                    continue

            return False, f"HTTP {response.status_code}"

        except requests.RequestException as exc:
            if attempt < MAX_RETRIES:
                delay = RETRY_DELAY * attempt
                print(
                    f"      network error on attempt {attempt}/{MAX_RETRIES}: "
                    f"{exc}"
                )
                time.sleep(delay)
                continue

            return False, f"request failed: {exc}"

        except OSError as exc:
            return False, f"file error: {exc}"

        except Exception as exc:
            return False, f"unexpected error: {exc}"

    return False, "exhausted retries"


def write_json(
    json_path: Path,
    database_info: dict[str, Any],
    licks: list[dict[str, Any]],
) -> None:
    json_path.parent.mkdir(parents=True, exist_ok=True)

    payload = {
        "meta": {
            "source": "Bopland",
            "sourceUrl": "https://bopland.org",
            "databaseName": database_info["name"],
            "databaseTitle": database_info["title"],
            "generatedLickCount": len(licks),
            "imageBaseUrl": BASE_URL,
            "description": (
                "Treble-clef lick images from the Bopland "
                "Treble Clef Licks database."
            ),
        },
        "licks": licks,
    }

    with json_path.open("w", encoding="utf-8") as f:
        json.dump(
            payload,
            f,
            ensure_ascii=False,
            indent=2,
        )
        f.write("\n")


def main() -> int:
    args = parse_args()

    print("=" * 72)
    print("BOPLAND TREBLE CLEF DOWNLOADER")
    print("=" * 72)
    print(f"Database:     {args.db}")
    print(f"Images:       {args.image_dir}")
    print(f"Metadata:     {args.json_path}")
    print(f"Database:     {DATABASE_NAME}")
    print()

    try:
        conn = get_connection(args.db)
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    try:
        database_info = get_database_info(conn)

        print(
            f"SQLite reports {database_info['count']:,} licks "
            f"for {database_info['title']!r}"
        )

        licks = load_licks(conn)

        print(f"Loaded {len(licks):,} lick records from the licks table.")
        print()

        if not licks:
            print("ERROR: no licks found.", file=sys.stderr)
            return 1

        args.image_dir.mkdir(parents=True, exist_ok=True)

        # Always generate metadata, even in --no-download mode.
        write_json(args.json_path, database_info, licks)

        print(f"Wrote metadata: {args.json_path}")
        print()

        if args.no_download:
            print("--no-download specified; stopping.")
            return 0

        start = max(0, args.start)
        selected = licks[start:]

        if args.limit is not None:
            selected = selected[: max(0, args.limit)]

        total = len(selected)

        if total == 0:
            print("Nothing to download.")
            return 0

        session = requests.Session()
        session.headers.update(
            {
                "User-Agent": USER_AGENT,
                "Accept": "image/png,image/*;q=0.9,*/*;q=0.1",
            }
        )

        downloaded = 0
        skipped = 0
        failed = 0

        print(f"Processing {total:,} images...")
        print()

        for i, lick in enumerate(selected, start=1):
            lick_hash = lick["hash"]
            output_path = args.image_dir / f"{lick_hash}.png"

            print(f"[{i:,}/{total:,}] {lick_hash}")

            if output_path.exists() and not args.force:
                skipped += 1
                print("    already exists — skipped")
                continue

            url = f"{BASE_URL}/{lick_hash}.png"
            print(f"    {url}")

            ok, message = download_image(
                session,
                lick,
                output_path,
            )

            if ok:
                downloaded += 1
                print(f"    ✓ {message}")
            else:
                failed += 1
                print(f"    ✗ {message}")

                # Make sure a failed/partial download doesn't look valid.
                try:
                    if output_path.exists():
                        output_path.unlink()
                except OSError:
                    pass

        print()
        print("=" * 72)
        print("COMPLETE")
        print("=" * 72)
        print(f"Metadata:   {args.json_path}")
        print(f"Downloaded: {downloaded:,}")
        print(f"Skipped:    {skipped:,}")
        print(f"Failed:     {failed:,}")
        print(f"Total:      {total:,}")
        print()

        if failed:
            print(
                "Some images failed. Run the script again; existing images "
                "will be skipped and failed ones retried."
            )
            return 2

        return 0

    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
