import { useCallback, useEffect, useState } from "react";
import { Lick, ALL_LICKS, licksByPerformer } from "./licks";

// ============================================================================
// FAVORITES — persisted in the browser's localStorage
// ============================================================================

const FAVORITES_KEY = "jazzshed.lickFavorites.v1";

function readFavoriteIds(): Set<string> {
  try {
    const raw = window.localStorage.getItem(FAVORITES_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function writeFavoriteIds(ids: Set<string>): void {
  try {
    window.localStorage.setItem(FAVORITES_KEY, JSON.stringify([...ids]));
  } catch {
    // localStorage unavailable (private mode, quota, etc.) — fail silently,
    // favorites just won't persist for this session.
  }
}

export function useLickFavorites() {
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() =>
    typeof window !== "undefined" ? readFavoriteIds() : new Set(),
  );

  useEffect(() => {
    writeFavoriteIds(favoriteIds);
  }, [favoriteIds]);

  const isFavorite = useCallback(
    (id: string) => favoriteIds.has(id),
    [favoriteIds],
  );

  const toggleFavorite = useCallback((id: string) => {
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const favoriteLicks: Lick[] = ALL_LICKS.filter((l) => favoriteIds.has(l.id));

  return { isFavorite, toggleFavorite, favoriteLicks, favoriteIds };
}

// ============================================================================
// TRUE RANDOM, NO-IMMEDIATE-REPEAT SELECTION
// ============================================================================
// A simple "shuffle bag": each pool (all licks, or one performer's licks) is
// shuffled once; picks are drawn from the bag in order, so every lick in the
// pool is seen once before any repeat, and the order is freshly randomized
// each time the bag empties. This avoids the classic "true randomness feels
// repetitive" complaint (naive Math.random() picks can and do repeat the
// same item several times in a row).
// ============================================================================

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export class LickShuffleBag {
  private bags: Map<string, string[]> = new Map(); // poolKey -> remaining lick ids

  private poolFor(poolKey: string): Lick[] {
    return poolKey === "__ALL__" ? ALL_LICKS : licksByPerformer(poolKey);
  }

  next(poolKey: string): Lick | null {
    const pool = this.poolFor(poolKey);
    if (pool.length === 0) return null;

    let bag = this.bags.get(poolKey);
    if (!bag || bag.length === 0) {
      bag = shuffle(pool.map((l) => l.id));
      this.bags.set(poolKey, bag);
    }
    const id = bag.pop()!;
    this.bags.set(poolKey, bag);
    return pool.find((l) => l.id === id) ?? null;
  }
}
