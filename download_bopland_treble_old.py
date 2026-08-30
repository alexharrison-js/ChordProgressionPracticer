#!/usr/bin/env python3
"""
download_bopland_treble.py

Download and reconstruct the BopLand "Treble Clef Licks" dataset.

Based on the BopLand network structure observed in the supplied HAR:

    https://bopland.org/data/treble-clef-licks.js
    https://bopland.org/data/<LICK_HASH>.png

The JavaScript file contains BopLand's complete client-side index of the
Treble Clef Licks database, including:

    - 2,458 lick IDs
    - chord progressions
    - simplified chord-change progressions
    - harmony progressions
    - time signatures
    - searchable/indexed progression information

This script does NOT run OMR. It only reconstructs the dataset and downloads
the source notation images. OMR can be performed in a separate stage.

No third-party Python packages are required.

Usage:

    python3 download_bopland_treble.py

Optional:

    python3 download_bopland_treble.py --limit 10
    python3 download_bopland_treble.py --no-images
    python3 download_bopland_treble.py --workers 4
    python3 download_bopland_treble.py --output bopland_treble

Output:

    bopland_treble/
        treble-clef-licks.js
        metadata.json
        licks.json
        images/
            <hash>.png
            ...
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any


# ============================================================================
# Configuration
# ============================================================================

BASE_URL = "https://bopland.org"

# This is the endpoint observed in the supplied HAR.
TREBLE_DB_URL = (
    "https://bopland.org/data/treble-clef-licks.js?t=1335"
)

EXPECTED_COUNT = 2458

DEFAULT_OUTPUT = "bopland_treble"

USER_AGENT = (
    "Mozilla/5.0 "
    "(Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 "
    "(KHTML, like Gecko) "
    "Chrome/150.0 Safari/537.36"
)


# ============================================================================
# HTTP
# ============================================================================

def make_request(url: str) -> urllib.request.Request:
    return urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "*/*",
        },
    )


def download_bytes(
    url: str,
    retries: int = 3,
    timeout: int = 30,
) -> bytes:
    """
    Download a URL with a few retries.
    """

    last_error: Exception | None = None

    for attempt in range(1, retries + 1):
        try:
            req = make_request(url)

            with urllib.request.urlopen(req, timeout=timeout) as response:
                return response.read()

        except Exception as exc:
            last_error = exc

            if attempt < retries:
                wait = attempt * 2
                print(
                    f"    request failed ({attempt}/{retries}): "
                    f"{exc}; retrying in {wait}s..."
                )
                time.sleep(wait)

    raise RuntimeError(
        f"Failed to download {url}: {last_error}"
    )


# ============================================================================
# BopLand JavaScript parsing
# ============================================================================

def parse_bopland_database(js_text: str) -> dict[str, Any]:
    """
    BopLand's database file has the form:

        bopland.db.register({...});

    The {...} portion is JSON, so we can parse it directly.

    We intentionally do not execute JavaScript.
    """

    marker = "bopland.db.register("

    start = js_text.find(marker)

    if start == -1:
        raise ValueError(
            "Could not find 'bopland.db.register(' in the BopLand JS file."
        )

    json_start = start + len(marker)

    # The file ends with something equivalent to:
    #
    #     });
    #
    # Find the final closing parenthesis rather than trying to parse the
    # JavaScript itself.
    json_end = js_text.rfind(")")

    if json_end == -1 or json_end <= json_start:
        raise ValueError(
            "Could not locate the end of bopland.db.register(...)."
        )

    json_text = js_text[json_start:json_end].strip()

    try:
        return json.loads(json_text)
    except json.JSONDecodeError as exc:
        # Give a useful diagnostic if BopLand changes its file format.
        context_start = max(0, exc.pos - 200)
        context_end = min(len(json_text), exc.pos + 200)

        context = json_text[context_start:context_end]

        raise ValueError(
            "BopLand database did not contain valid JSON.\n"
            f"JSON error: {exc}\n"
            f"Context around error:\n{context}"
        ) from exc


# ============================================================================
# Metadata extraction
# ============================================================================

def add_context(
    record: dict[str, Any],
    index_type: str,
    time_signature: str,
    progression: str,
) -> None:
    """
    Add one progression occurrence to a lick's metadata.

    The same lick can occur under multiple BopLand indexes, so we preserve
    all of them rather than throwing information away.
    """

    context = {
        "indexType": index_type,
        "timeSignature": time_signature,
        "progression": progression,
    }

    existing = record["contexts"]

    if context not in existing:
        existing.append(context)


def extract_licks(db: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """
    Extract every lick ID from:

        data.chords
        data.changes
        data.harmony

    Returns:

        {
            "9sjJo9wH": {
                ...
            },
            ...
        }
    """

    licks: dict[str, dict[str, Any]] = {}

    data = db.get("data", {})

    for index_type in ("chords", "changes", "harmony"):
        index = data.get(index_type, {})

        if not isinstance(index, dict):
            continue

        for time_signature, progressions in index.items():

            if not isinstance(progressions, dict):
                continue

            for progression, lick_ids in progressions.items():

                if not isinstance(lick_ids, list):
                    continue

                for lick_id in lick_ids:

                    if not isinstance(lick_id, str):
                        continue

                    if lick_id not in licks:
                        licks[lick_id] = {
                            "id": lick_id,
                            "imageUrl": (
                                f"{BASE_URL}/data/{lick_id}.png"
                            ),
                            "database": db.get(
                                "name",
                                "treble-clef-licks",
                            ),
                            "databaseTitle": db.get(
                                "title",
                                "Treble Clef Licks",
                            ),
                            "contexts": [],
                        }

                    add_context(
                        licks[lick_id],
                        index_type,
                        str(time_signature),
                        str(progression),
                    )

    return licks


# ============================================================================
# Primary context selection
# ============================================================================

def clean_progression(progression: str) -> str:
    """
    Normalize whitespace while preserving BopLand's chord notation.
    """

    return re.sub(r"\s+", " ", progression).strip()


def choose_primary_context(
    contexts: list[dict[str, Any]],
) -> dict[str, Any] | None:
    """
    Choose the most useful representation for the application.

    Preference:

        chords > changes > harmony

    because "chords" contains the richest representation, e.g.

        | dm7 | g7 | cmaj |

    instead of:

        | dm | g7 | c |

    or:

         dm g c
    """

    if not contexts:
        return None

    priority = {
        "chords": 0,
        "changes": 1,
        "harmony": 2,
    }

    ordered = sorted(
        contexts,
        key=lambda c: (
            priority.get(c["indexType"], 99),
            c["timeSignature"],
            c["progression"],
        ),
    )

    return ordered[0]


def build_application_lick(
    raw: dict[str, Any],
) -> dict[str, Any]:
    """
    Build a record that is closer to the shape expected by the React app.

    Notes are intentionally empty here because BopLand provides us with the
    notation image rather than note-level pitch/duration information.
    """

    contexts = raw["contexts"]

    primary = choose_primary_context(contexts)

    chord_context: list[str] = []

    if primary is not None:
        progression = primary["progression"]

        # Parse:
        #
        #   | dm7 | g7 | cmaj |
        #
        # into:
        #
        #   ["dm7", "g7", "cmaj"]
        #
        # This is deliberately conservative; the original BopLand string is
        # also preserved in contexts.
        parts = progression.split("|")

        for part in parts:
            chord = part.strip()

            if chord:
                chord_context.append(chord)

    return {
        "id": raw["id"],
        "label": f"BopLand Lick #{raw['id']}",
        "contextLabel": (
            clean_progression(primary["progression"])
            if primary
            else "BopLand Treble Clef Lick"
        ),
        "selectionMethod": "harmony",
        "performer": "BopLand",
        "style": "BOPLAND",
        "sourceTune": None,
        "sourceKey": None,
        "sourceTempo": None,
        "barStart": 0,
        "barCount": len(chord_context),
        "chordContext": chord_context,
        "preferFlats": False,
        "notes": [],
        "bopland": {
            "database": raw["database"],
            "databaseTitle": raw["databaseTitle"],
            "imageUrl": raw["imageUrl"],
            "contexts": contexts,
        },
    }


# ============================================================================
# File output
# ============================================================================

def write_json(
    path: Path,
    data: Any,
) -> None:
    """
    Write UTF-8 JSON with indentation so the generated files remain useful
    for inspection/debugging.
    """

    path.parent.mkdir(parents=True, exist_ok=True)

    with path.open(
        "w",
        encoding="utf-8",
    ) as f:
        json.dump(
            data,
            f,
            indent=2,
            ensure_ascii=False,
        )

        f.write("\n")


# ============================================================================
# Image downloading
# ============================================================================

def image_is_complete(path: Path) -> bool:
    """
    Basic existence check.

    We don't attempt to decode PNGs here; OMR validation belongs to the next
    pipeline stage.
    """

    return path.exists() and path.stat().st_size > 0


def download_one_image(
    lick_id: str,
    image_dir: Path,
    retries: int,
) -> tuple[str, str, int | None, str | None]:
    """
    Download one lick image.

    Returns:

        (lick_id, status, size, error)

    status is one of:

        downloaded
        exists
        failed
    """

    output_path = image_dir / f"{lick_id}.png"

    if image_is_complete(output_path):
        return (
            lick_id,
            "exists",
            output_path.stat().st_size,
            None,
        )

    url = f"{BASE_URL}/data/{lick_id}.png"

    try:
        data = download_bytes(
            url,
            retries=retries,
            timeout=60,
        )

        # Verify that it at least looks like a PNG.
        if not data.startswith(b"\x89PNG\r\n\x1a\n"):
            return (
                lick_id,
                "failed",
                None,
                "response was not a PNG",
            )

        # Write atomically so an interrupted download cannot leave a partial
        # PNG that looks complete to the next run.
        temp_path = image_dir / f".{lick_id}.png.tmp"

        with temp_path.open("wb") as f:
            f.write(data)

        temp_path.replace(output_path)

        return (
            lick_id,
            "downloaded",
            len(data),
            None,
        )

    except Exception as exc:
        return (
            lick_id,
            "failed",
            None,
            str(exc),
        )


def download_images(
    licks: dict[str, dict[str, Any]],
    image_dir: Path,
    workers: int,
    retries: int,
) -> dict[str, Any]:
    """
    Download all lick images concurrently.

    The default worker count is intentionally modest to avoid hammering the
    site.
    """

    image_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    lick_ids = list(licks.keys())

    total = len(lick_ids)

    downloaded = 0
    existing = 0
    failed = 0
    failures: list[dict[str, str]] = []

    print()
    print("=" * 72)
    print("Downloading Treble Clef lick images")
    print("=" * 72)
    print(f"Total images: {total}")
    print(f"Workers:      {workers}")
    print()

    with ThreadPoolExecutor(
        max_workers=workers,
    ) as executor:

        futures = {
            executor.submit(
                download_one_image,
                lick_id,
                image_dir,
                retries,
            ): lick_id
            for lick_id in lick_ids
        }

        completed = 0

        for future in as_completed(futures):

            completed += 1

            lick_id = futures[future]

            try:
                (
                    returned_id,
                    status,
                    size,
                    error,
                ) = future.result()

            except Exception as exc:
                returned_id = lick_id
                status = "failed"
                size = None
                error = str(exc)

            if status == "downloaded":
                downloaded += 1

            elif status == "exists":
                existing += 1

            else:
                failed += 1

                failures.append(
                    {
                        "id": returned_id,
                        "error": error or "unknown error",
                    }
                )

            if status == "failed":
                status_text = f"FAILED: {error}"
            elif status == "exists":
                status_text = "already exists"
            else:
                size_kb = (size or 0) / 1024
                status_text = f"downloaded ({size_kb:.1f} KB)"

            print(
                f"[{completed:4d}/{total}] "
                f"{returned_id}: {status_text}"
            )

    return {
        "total": total,
        "downloaded": downloaded,
        "alreadyExisted": existing,
        "failed": failed,
        "failures": failures,
    }


# ============================================================================
# Main
# ============================================================================

def main() -> int:

    parser = argparse.ArgumentParser(
        description=(
            "Download BopLand Treble Clef Licks "
            "and reconstruct their metadata."
        )
    )

    parser.add_argument(
        "--output",
        default=DEFAULT_OUTPUT,
        help=(
            f"Output directory "
            f"(default: {DEFAULT_OUTPUT})"
        ),
    )

    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help=(
            "Only process the first N licks. "
            "Useful for testing."
        ),
    )

    parser.add_argument(
        "--workers",
        type=int,
        default=4,
        help=(
            "Number of simultaneous image downloads "
            "(default: 4)."
        ),
    )

    parser.add_argument(
        "--retries",
        type=int,
        default=3,
        help=(
            "Number of retries for failed requests "
            "(default: 3)."
        ),
    )

    parser.add_argument(
        "--no-images",
        action="store_true",
        help=(
            "Only download/parse the BopLand JS database; "
            "do not download PNGs."
        ),
    )

    args = parser.parse_args()

    if args.workers < 1:
        parser.error("--workers must be >= 1")

    if args.retries < 1:
        parser.error("--retries must be >= 1")

    if args.limit is not None and args.limit < 1:
        parser.error("--limit must be >= 1")

    output_dir = Path(args.output)

    image_dir = output_dir / "images"

    output_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    # ------------------------------------------------------------------------
    # 1. Download BopLand's actual database JS
    # ------------------------------------------------------------------------

    print("=" * 72)
    print("BOPLAND — TREBLE CLEF LICKS")
    print("=" * 72)
    print()
    print("Database:")
    print(f"  {TREBLE_DB_URL}")
    print()

    js_path = output_dir / "treble-clef-licks.js"

    print("Downloading BopLand database...")

    try:
        js_bytes = download_bytes(
            TREBLE_DB_URL,
            retries=args.retries,
            timeout=60,
        )
    except Exception as exc:
        print()
        print(f"ERROR: Could not download BopLand database:")
        print(f"  {exc}")
        return 1

    js_text = js_bytes.decode(
        "utf-8",
        errors="strict",
    )

    js_path.write_text(
        js_text,
        encoding="utf-8",
    )

    print(
        f"  saved {js_path} "
        f"({len(js_bytes):,} bytes)"
    )

    # ------------------------------------------------------------------------
    # 2. Parse database
    # ------------------------------------------------------------------------

    print()
    print("Parsing BopLand database...")

    try:
        db = parse_bopland_database(js_text)
    except Exception as exc:
        print()
        print(f"ERROR: Could not parse database:")
        print(f"  {exc}")
        return 1

    print(f"  name:  {db.get('name')}")
    print(f"  title: {db.get('title')}")
    print(f"  count: {db.get('count')}")

    declared_count = db.get("count")

    # ------------------------------------------------------------------------
    # 3. Extract lick IDs and contexts
    # ------------------------------------------------------------------------

    print()
    print("Extracting lick IDs and progression metadata...")

    licks = extract_licks(db)

    print(f"  unique lick IDs found: {len(licks):,}")

    if declared_count is not None:
        if len(licks) == declared_count:
            print(
                f"  ✓ matches BopLand declared count "
                f"({declared_count:,})"
            )
        else:
            print(
                f"  WARNING: BopLand declares "
                f"{declared_count:,}, "
                f"but {len(licks):,} unique IDs were found."
            )

    if len(licks) == EXPECTED_COUNT:
        print(
            f"  ✓ matches expected Treble Clef dataset "
            f"({EXPECTED_COUNT:,})"
        )

    # ------------------------------------------------------------------------
    # 4. Apply optional test limit
    # ------------------------------------------------------------------------

    if args.limit is not None:
        limited_ids = list(licks.keys())[: args.limit]

        licks = {
            lick_id: licks[lick_id]
            for lick_id in limited_ids
        }

        print()
        print(
            f"TEST MODE: limiting to "
            f"{len(licks):,} licks."
        )

    # ------------------------------------------------------------------------
    # 5. Write raw metadata
    # ------------------------------------------------------------------------

    raw_licks_path = output_dir / "licks.json"

    raw_licks = list(licks.values())

    write_json(
        raw_licks_path,
        {
            "meta": {
                "source": "BopLand.org",
                "sourceUrl": BASE_URL,
                "database": db.get(
                    "name",
                    "treble-clef-licks",
                ),
                "databaseTitle": db.get(
                    "title",
                    "Treble Clef Licks",
                ),
                "declaredLickCount": declared_count,
                "extractedLickCount": len(raw_licks),
                "imagePattern": (
                    f"{BASE_URL}/data/<LICK_ID>.png"
                ),
            },
            "licks": raw_licks,
        },
    )

    print()
    print(
        f"  wrote raw metadata: {raw_licks_path}"
    )

    # ------------------------------------------------------------------------
    # 6. Write application-oriented metadata
    # ------------------------------------------------------------------------

    application_licks = [
        build_application_lick(lick)
        for lick in licks.values()
    ]

    app_metadata_path = output_dir / "application_licks.json"

    write_json(
        app_metadata_path,
        {
            "meta": {
                "source": "BopLand.org",
                "sourceUrl": BASE_URL,
                "database": "treble-clef-licks",
                "databaseTitle": "Treble Clef Licks",
                "generatedLickCount": len(
                    application_licks
                ),
                "noteDataStatus": (
                    "not extracted; "
                    "notation is supplied as PNG images"
                ),
            },
            "licks": application_licks,
        },
    )

    print(
        f"  wrote application metadata: "
        f"{app_metadata_path}"
    )

    # ------------------------------------------------------------------------
    # 7. Download images
    # ------------------------------------------------------------------------

    download_result = {
        "total": 0,
        "downloaded": 0,
        "alreadyExisted": 0,
        "failed": 0,
        "failures": [],
    }

    if not args.no_images:

        download_result = download_images(
            licks,
            image_dir,
            workers=args.workers,
            retries=args.retries,
        )

    else:

        print()
        print(
            "Skipping images because --no-images was supplied."
        )

    # ------------------------------------------------------------------------
    # 8. Write manifest
    # ------------------------------------------------------------------------

    manifest = {
        "source": {
            "name": "BopLand.org",
            "database": "treble-clef-licks",
            "title": "Treble Clef Licks",
            "databaseUrl": TREBLE_DB_URL,
            "imageUrlPattern": (
                f"{BASE_URL}/data/<LICK_ID>.png"
            ),
        },
        "database": {
            "declaredCount": declared_count,
            "extractedCount": len(licks),
        },
        "download": download_result,
        "output": {
            "javascript": str(
                js_path
            ),
            "rawMetadata": str(
                raw_licks_path
            ),
            "applicationMetadata": str(
                app_metadata_path
            ),
            "imageDirectory": str(
                image_dir
            ),
        },
    }

    manifest_path = output_dir / "manifest.json"

    write_json(
        manifest_path,
        manifest,
    )

    # ------------------------------------------------------------------------
    # 9. Final summary
    # ------------------------------------------------------------------------

    print()
    print("=" * 72)
    print("COMPLETE")
    print("=" * 72)
    print()
    print(f"Output directory:")
    print(f"  {output_dir.resolve()}")
    print()
    print(f"Licks:")
    print(f"  {len(licks):,}")
    print()
    print("Files:")
    print(f"  {js_path}")
    print(f"  {raw_licks_path}")
    print(f"  {app_metadata_path}")
    print(f"  {manifest_path}")

    if not args.no_images:
        print()
        print("Images:")
        print(
            f"  downloaded:      "
            f"{download_result['downloaded']:,}"
        )
        print(
            f"  already existed: "
            f"{download_result['alreadyExisted']:,}"
        )
        print(
            f"  failed:          "
            f"{download_result['failed']:,}"
        )

        if download_result["failed"]:
            print()
            print(
                "Some images failed. "
                "Run the script again to retry them."
            )

    print()

    return 0


if __name__ == "__main__":
    sys.exit(main())
