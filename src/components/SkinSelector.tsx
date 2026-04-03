"use client";

import { useRef, useEffect, useState } from "react";
import { BirdIcon } from "./BirdIcon";

interface SkinDef {
  id: string;
  name: string;
}

const GAME_SKINS: SkinDef[] = [
  { id: "sparrow", name: "Sparrow" },
  { id: "parrot", name: "Parrot" },
  { id: "duck", name: "Duck" },
  { id: "eagle", name: "Eagle" },
  { id: "pigeon", name: "Pigeon" },
  { id: "robin-bird", name: "Robin" },
  { id: "swallow", name: "Swallow" },
  { id: "kingfisher", name: "Kingfisher" },
  { id: "bee-eater", name: "Bee-Eater" },
  { id: "hummingbird", name: "Hummingbird" },
  { id: "macaw", name: "Macaw" },
  { id: "seagull", name: "Seagull" },
  { id: "pelican", name: "Pelican" },
  { id: "albatross", name: "Albatross" },
  { id: "kestrel", name: "Kestrel" },
  { id: "red-kite", name: "Red Kite" },
  { id: "osprey", name: "Osprey" },
  { id: "swift", name: "Swift" },
  { id: "nightjar", name: "Nightjar" },
];

interface SkinSelectorProps {
  selected: string;
  onSelect: (id: string) => void;
}

export function SkinSelector({ selected, onSelect }: SkinSelectorProps) {
  return (
    <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
      {GAME_SKINS.map((skin) => {
        const isSelected = selected === skin.id;
        return (
          <button
            key={skin.id}
            onClick={() => onSelect(skin.id)}
            className={`flex flex-col items-center p-2 transition-all ${
              isSelected ? "pixel-panel-gold" : "pixel-panel hover:border-pixel-text-white"
            }`}
          >
            <BirdIcon src={`/sprites/${skin.id}.png`} size={40} />
            <span
              className={`font-heading text-[5px] mt-1 ${
                isSelected ? "text-pixel-bird-yellow" : "text-pixel-text-dim"
              }`}
            >
              {skin.name.toUpperCase()}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export { GAME_SKINS };
