import React from "react";
import { BoplandLick } from "./bopland";

interface BoplandLickProps {
  lick: BoplandLick;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}

export default function BoplandLickView({
  lick,
  isFavorite,
  onToggleFavorite,
}: BoplandLickProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl text-[#F2EDE4]">{lick.label}</h2>

          <p className="text-xs text-[#D4A24C] font-mono mt-1 font-semibold">
            Bopland · Treble Clef Licks
          </p>

          {lick.progressions.length > 0 && (
            <p className="text-xs text-[#8A8580] font-mono mt-1">
              {lick.progressions[0]}
            </p>
          )}
        </div>

        <button
          onClick={onToggleFavorite}
          className={`text-2xl leading-none transition-colors ${
            isFavorite
              ? "text-[#D4A24C]"
              : "text-[#4a4744] hover:text-[#8A8580]"
          }`}
          aria-label={
            isFavorite
              ? "Remove Bopland lick from favorites"
              : "Favorite Bopland lick"
          }
          title={isFavorite ? "Remove from favorites" : "Favorite this lick"}
        >
          &#9733;
        </button>
      </div>

      {lick.progressions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 font-mono text-sm text-[#D4A24C]">
          {lick.progressions.map((progression, index) => (
            <span
              key={`${lick.id}-progression-${index}`}
              className="border border-[#4a4744] rounded-md px-2 py-1 bg-[#1f1d1b]"
            >
              {progression}
            </span>
          ))}
        </div>
      )}

      <div className="bg-[#F2EDE4] rounded-lg p-2 overflow-hidden">
        <img
          src={lick.image}
          alt={`${lick.label} musical notation`}
          className="block w-full h-auto rounded"
          loading="eager"
          draggable={false}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {lick.timeSignatures.map((timeSignature) => (
          <span
            key={`${lick.id}-${timeSignature}`}
            className="text-[10px] font-mono text-[#8A8580] border border-[#3A3836] rounded px-2 py-1"
          >
            {timeSignature}
          </span>
        ))}

        <span className="text-[10px] font-mono text-[#8A8580]">
          Bopland ID: {lick.hash}
        </span>
      </div>
    </div>
  );
}
