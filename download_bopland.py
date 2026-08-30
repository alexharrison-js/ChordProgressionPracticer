#!/usr/bin/env python3

import argparse
import json
import re
import sqlite3
import time
from pathlib import Path
from urllib.parse import urljoin

import requests


BASE_URL = "https://bopland.org/"

DATABASES = {
    "treble-clef-licks": "data/treble-clef-licks.js?t=1335",
    "bass-clef-licks": "data/bass-clef-licks.js?t=1335",
    "walking-bass-lines": "data/walking-bass-lines.js?t=1335",
    "guitar-licks": "data/guitar-licks.js?t=1335",
    "guitar-chords": "data/guitar-chords.js?t=1335",
}

DEFAULT_DB = "bopland.sqlite3"
DEFAULT_ASSET_DIR = "bopland_assets"


session = requests.Session()
session.headers.update({
    "User-Agent": "BopLand research downloader/1.0"
})


# ---------------------------------------------------------------------------
# Download
# ---------------------------------------------------------------------------

def download(url, retries=3, timeout=30):
    for attempt in range(retries):
        try:
            response = session.get(
                url,
                timeout=timeout,
            )
            response.raise_for_status()
            return response
        except requests.RequestException as exc:
            if attempt == retries - 1:
                raise

            wait = 2 ** attempt
            print(f"  request failed: {exc}")
            print(f"  retrying in {wait}s...")
            time.sleep(wait)


# ---------------------------------------------------------------------------
# Parse BopLand's JavaScript database format
#
# Each file looks like:
#
# bopland.db.register({...});
#
# The object itself is valid JSON, so we only need to remove the JS wrapper.
# ---------------------------------------------------------------------------

def fetch_database(db_name):
    relative_url = DATABASES[db_name]
    url = urljoin(BASE_URL, relative_url)

    print(f"Downloading database: {db_name}")
    print(f"  {url}")

    response = download(url)

    text = response.text.strip()

    prefix = "bopland.db.register("
    suffix = ");"

    if not text.startswith(prefix):
        raise RuntimeError(
            f"Unexpected database format for {db_name}"
        )

    if not text.endswith(suffix):
        raise RuntimeError(
            f"Unexpected database ending for {db_name}"
        )

    json_text = text[len(prefix):-len(suffix)]

    return json.loads(json_text)


# ---------------------------------------------------------------------------
# Build lick records from the BopLand indexes
# ---------------------------------------------------------------------------

def extract_licks(db):
    """
    Convert BopLand's nested chord indexes into flat records.

    A single lick hash can appear in multiple indexes:
        chords
        changes
        harmony

    We merge those occurrences into one lick record.
    """

    records = {}

    data = db["data"]

    for index_type in ("chords", "changes", "harmony"):
        index = data.get(index_type, {})

        for time_signature, progressions in index.items():

            for progression, hashes in progressions.items():

                for lick_hash in hashes:

                    if lick_hash not in records:
                        records[lick_hash] = {
                            "hash": lick_hash,
                            "database": db["name"],
                            "title": db["title"],
                            "time_signatures": set(),
                            "chords": set(),
                            "changes": set(),
                            "harmony": set(),
                        }

                    record = records[lick_hash]

                    record["time_signatures"].add(
                        time_signature
                    )

                    record[index_type].add(progression)

    return list(records.values())


# ---------------------------------------------------------------------------
# Build named progression information
# ---------------------------------------------------------------------------

def build_progression_catalog(db):
    """
    BopLand's `input` and `index` structures map names such as:

        major 2 5 1
        ii v i
        251

    to canonical chord progressions.
    """

    result = []

    inputs = db.get("input", {})
    chapters = db.get("index", [])

    for name, location in inputs.items():

        chapter_index = location[0]
        section_index = location[1]

        if chapter_index >= len(chapters):
            continue

        chapter = chapters[chapter_index]

        if section_index >= len(chapter["keys"]):
            continue

        section = chapter["keys"][section_index]

        result.append({
            "name": name,
            "time_signature": chapter["time"],
            "key": section[0],
            "key_name": section[1],
            "progression": section[2],
        })

    return result


# ---------------------------------------------------------------------------
# SQLite
# ---------------------------------------------------------------------------

def create_schema(conn):

    conn.executescript("""
        CREATE TABLE IF NOT EXISTS databases (
            name TEXT PRIMARY KEY,
            title TEXT,
            count INTEGER
        );

        CREATE TABLE IF NOT EXISTS licks (
            hash TEXT,
            database_name TEXT,
            database_title TEXT,

            PRIMARY KEY (
                hash,
                database_name
            )
        );

        CREATE TABLE IF NOT EXISTS lick_time_signatures (
            hash TEXT,
            database_name TEXT,
            time_signature TEXT,

            PRIMARY KEY (
                hash,
                database_name,
                time_signature
            )
        );

        CREATE TABLE IF NOT EXISTS lick_progressions (
            hash TEXT,
            database_name TEXT,
            index_type TEXT,
            progression TEXT,

            PRIMARY KEY (
                hash,
                database_name,
                index_type,
                progression
            )
        );

        CREATE TABLE IF NOT EXISTS named_progressions (
            database_name TEXT,
            name TEXT,
            time_signature TEXT,
            key TEXT,
            key_name TEXT,
            progression TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_lick_hash
        ON licks(hash);

        CREATE INDEX IF NOT EXISTS idx_progression
        ON lick_progressions(progression);

        CREATE INDEX IF NOT EXISTS idx_index_type
        ON lick_progressions(index_type);
    """)


def insert_database(conn, db, records):

    conn.execute(
        """
        INSERT OR REPLACE INTO databases
        (name, title, count)
        VALUES (?, ?, ?)
        """,
        (
            db["name"],
            db["title"],
            db["count"],
        )
    )

    for record in records:

        conn.execute(
            """
            INSERT OR REPLACE INTO licks
            (hash, database_name, database_title)
            VALUES (?, ?, ?)
            """,
            (
                record["hash"],
                record["database"],
                record["title"],
            )
        )

        for ts in record["time_signatures"]:

            conn.execute(
                """
                INSERT OR IGNORE INTO lick_time_signatures
                (hash, database_name, time_signature)
                VALUES (?, ?, ?)
                """,
                (
                    record["hash"],
                    record["database"],
                    ts,
                )
            )

        for index_type in (
            "chords",
            "changes",
            "harmony",
        ):

            for progression in record[index_type]:

                conn.execute(
                    """
                    INSERT OR IGNORE INTO lick_progressions
                    (
                        hash,
                        database_name,
                        index_type,
                        progression
                    )
                    VALUES (?, ?, ?, ?)
                    """,
                    (
                        record["hash"],
                        record["database"],
                        index_type,
                        progression,
                    )
                )

    # Named searches such as "major 2 5 1"
    named = build_progression_catalog(db)

    for p in named:

        conn.execute(
            """
            INSERT INTO named_progressions
            (
                database_name,
                name,
                time_signature,
                key,
                key_name,
                progression
            )
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                db["name"],
                p["name"],
                p["time_signature"],
                p["key"],
                p["key_name"],
                p["progression"],
            )
        )

    conn.commit()


# ---------------------------------------------------------------------------
# Assets
# ---------------------------------------------------------------------------

def download_asset(
    lick_hash,
    asset_dir,
    extension,
    delay=0.1,
):

    path = asset_dir / f"{lick_hash}.{extension}"

    if path.exists():
        return

    url = f"{BASE_URL}data/{lick_hash}.{extension}"

    try:

        response = download(url)

        path.write_bytes(response.content)

        print(f"  downloaded {path.name}")

    except requests.HTTPError as exc:

        # Some databases may reference assets that aren't available
        # in every asset type.
        print(
            f"  unavailable: {url} ({exc})"
        )

    time.sleep(delay)


def download_assets(
    conn,
    database_name,
    asset_dir,
    download_png=True,
    download_mp3=False,
    delay=0.1,
):

    asset_dir.mkdir(
        parents=True,
        exist_ok=True
    )

    rows = conn.execute(
        """
        SELECT hash
        FROM licks
        WHERE database_name = ?
        ORDER BY hash
        """,
        (database_name,)
    ).fetchall()

    print(
        f"{len(rows)} unique licks in "
        f"{database_name}"
    )

    for i, (lick_hash,) in enumerate(rows, 1):

        print(
            f"[{i}/{len(rows)}] {lick_hash}"
        )

        if download_png:
            download_asset(
                lick_hash,
                asset_dir,
                "png",
                delay
            )

        if download_mp3:
            download_asset(
                lick_hash,
                asset_dir,
                "mp3",
                delay
            )


# ---------------------------------------------------------------------------
# JSON export
# ---------------------------------------------------------------------------

def export_json(conn, output_path):

    rows = conn.execute(
        """
        SELECT
            l.hash,
            l.database_name,
            l.database_title
        FROM licks l
        ORDER BY l.database_name, l.hash
        """
    ).fetchall()

    output = []

    for lick_hash, db_name, db_title in rows:

        ts = [
            r[0]
            for r in conn.execute(
                """
                SELECT time_signature
                FROM lick_time_signatures
                WHERE hash = ?
                  AND database_name = ?
                """,
                (lick_hash, db_name)
            )
        ]

        progressions = {}

        for index_type, progression in conn.execute(
            """
            SELECT index_type, progression
            FROM lick_progressions
            WHERE hash = ?
              AND database_name = ?
            """,
            (lick_hash, db_name)
        ):

            progressions.setdefault(
                index_type,
                []
            ).append(progression)

        output.append({
            "hash": lick_hash,
            "database": db_name,
            "databaseTitle": db_title,
            "timeSignatures": ts,
            "progressions": progressions,

            "assets": {
                "png": f"data/{lick_hash}.png",
                "mp3": f"data/{lick_hash}.mp3",
            }
        })

    with open(
        output_path,
        "w",
        encoding="utf-8"
    ) as f:

        json.dump(
            output,
            f,
            indent=2,
            ensure_ascii=False
        )

    print(
        f"Wrote {len(output)} licks to "
        f"{output_path}"
    )


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():

    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--db",
        default=DEFAULT_DB
    )

    parser.add_argument(
        "--assets",
        default=DEFAULT_ASSET_DIR
    )

    parser.add_argument(
        "--database",
        default="treble-clef-licks"
    )

    parser.add_argument(
        "--all-databases",
        action="store_true"
    )

    parser.add_argument(
        "--download-assets",
        action="store_true"
    )

    parser.add_argument(
        "--mp3",
        action="store_true",
        help="Also download MP3 files"
    )

    parser.add_argument(
        "--json",
        action="store_true",
        help="Also export flat JSON"
    )

    args = parser.parse_args()

    conn = sqlite3.connect(args.db)

    create_schema(conn)

    if args.all_databases:
        db_names = list(DATABASES.keys())
    else:
        db_names = [args.database]

    for db_name in db_names:

        db = fetch_database(db_name)

        print(
            f"  BopLand reports "
            f"{db['count']} entries"
        )

        records = extract_licks(db)

        print(
            f"  Found {len(records)} unique hashes"
        )

        insert_database(
            conn,
            db,
            records
        )

        if args.download_assets:

            download_assets(
                conn,
                db_name,
                Path(args.assets),
                download_png=True,
                download_mp3=args.mp3
            )

    if args.json:

        export_json(
            conn,
            "bopland_licks.json"
        )

    conn.close()


if __name__ == "__main__":
    main()