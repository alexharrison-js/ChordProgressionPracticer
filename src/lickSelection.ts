import { useCallback, useMemo, useState } from "react";
import { ALL_LICKS, Lick } from "./licks";
import { ALL_BOPLAND_LICKS, BoplandLick } from "./bopland";

// ============================================================================
// FAVORITES
// ============================================================================

const FAVORITES_STORAGE_KEY = "chord-progression-practicer.favorite-lick-ids";

function readFavoriteIds(): string[] {
  try {
    const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}

function writeFavoriteIds(ids: string[]) {
  try {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // localStorage can be unavailable in some browser environments.
  }
}

export type FavoriteLick = Lick | BoplandLick;

export function findLickById(id: string): FavoriteLick | undefined {
  return (
    ALL_LICKS.find((lick) => lick.id === id) ??
    ALL_BOPLAND_LICKS.find((lick) => lick.id === id)
  );
}

export function useLickFavorites() {
  const [favoriteIds, setFavoriteIds] = useState<string[]>(readFavoriteIds);

  const toggleFavorite = useCallback((id: string) => {
    setFavoriteIds((current) => {
      const next = current.includes(id)
        ? current.filter((existing) => existing !== id)
        : [...current, id];

      writeFavoriteIds(next);
      return next;
    });
  }, []);

  const isFavorite = useCallback(
    (id: string) => favoriteIds.includes(id),
    [favoriteIds],
  );

  const favoriteLicks = useMemo(
    () =>
      favoriteIds
        .map((id) => findLickById(id))
        .filter((lick): lick is FavoriteLick => lick !== undefined),
    [favoriteIds],
  );

  return {
    favoriteIds,
    isFavorite,
    toggleFavorite,
    favoriteLicks,
  };
}

// ============================================================================
// WJD SHUFFLE BAG
// ============================================================================
//
// Keeps the existing WJD behavior: shuffle through the collection without
// immediately repeating the same lick.
//
// ============================================================================

export class LickShuffleBag {
  private bags: Record<string, Lick[]> = {};

  private refill(performer: string, source: Lick[]): void {
    const shuffled = [...source];

    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));

      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    this.bags[performer] = shuffled;
  }

  next(performer: string): Lick {
    const source =
      performer === "__ALL__"
        ? ALL_LICKS
        : ALL_LICKS.filter((lick) => lick.performer === performer);

    if (source.length === 0) {
      throw new Error(`No WJD licks found for performer "${performer}".`);
    }

    if (!this.bags[performer] || this.bags[performer].length === 0) {
      this.refill(performer, source);
    }

    return this.bags[performer].pop()!;
  }
}
