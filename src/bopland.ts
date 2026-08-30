// ============================================================================
// BOPLAND — image-based lick collection
// ============================================================================
//
// Unlike the WJD licks, Bopland licks are intentionally NOT converted into
// note data or rendered through VexFlow.
//
// Each Bopland lick is simply:
//   - an ID
//   - the original Bopland image
//   - metadata extracted from the Bopland SQLite database
//
// The Python downloader generates bopland.json and the PNG files under
// public/bopland/.
//
// ============================================================================

export interface BoplandLick {
  /**
   * Stable application ID.
   *
   * Deliberately prefixed with "bopland:" so it can never collide with an
   * existing WJD lick ID.
   */
  id: string;

  /** Raw Bopland hash, e.g. "08RFPvfY". */
  hash: string;

  /** Human-readable display name. */
  label: string;

  /** Browser-relative image path, e.g. "/bopland/08RFPvfY.png". */
  image: string;

  /** Always "Bopland". */
  source: string;

  /** SQLite database name. */
  databaseName: string;

  /** SQLite database title. */
  databaseTitle: string;

  /** Chord/progression strings associated with the lick. */
  progressions: string[];

  /** Any time signatures associated with the lick. */
  timeSignatures: string[];
}

export interface BoplandCompendium {
  meta: {
    source: string;
    sourceUrl: string;
    databaseName: string;
    databaseTitle: string;
    generatedLickCount: number;
    imageBaseUrl: string;
    description: string;
  };

  licks: BoplandLick[];
}

import boplandData from "./bopland.json";

export const BOPLAND_COMPENDIUM = boplandData as unknown as BoplandCompendium;

export const ALL_BOPLAND_LICKS: BoplandLick[] = BOPLAND_COMPENDIUM.licks;

/**
 * Return a random Bopland lick.
 */
export function randomBoplandLick(): BoplandLick | null {
  if (ALL_BOPLAND_LICKS.length === 0) {
    return null;
  }

  const index = Math.floor(Math.random() * ALL_BOPLAND_LICKS.length);

  return ALL_BOPLAND_LICKS[index];
}

/**
 * Look up a Bopland lick by its application ID.
 */
export function boplandLickById(id: string): BoplandLick | undefined {
  return ALL_BOPLAND_LICKS.find((lick) => lick.id === id);
}
