"use client";

import type { DetectedFurniture } from "@/types";

interface Props {
  furniture: DetectedFurniture[];
  keepList: Set<string>;
  onToggle: (name: string) => void;
}

const conditionColor: Record<string, string> = {
  good: "bg-emerald-100 text-emerald-700",
  fair: "bg-amber-100 text-amber-700",
  poor: "bg-red-100 text-red-700",
};

export default function FurnitureChecklist({ furniture, keepList, onToggle }: Props) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-zinc-500 uppercase tracking-wide">
        Detected furniture — select what to keep
      </p>
      <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 overflow-hidden">
        {furniture.map((item) => (
          <li
            key={item.name}
            onClick={() => onToggle(item.name)}
            className={`
              flex items-center justify-between px-4 py-3 cursor-pointer
              hover:bg-zinc-50 transition-colors
              ${keepList.has(item.name) ? "bg-violet-50" : "bg-white"}
            `}
          >
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={keepList.has(item.name)}
                onChange={() => onToggle(item.name)}
                className="accent-violet-600 w-4 h-4"
                onClick={(e) => e.stopPropagation()}
              />
              <div>
                <span className="text-sm font-medium text-zinc-800 capitalize">
                  {item.name}
                </span>
                {item.estimated_position && (
                  <span className="ml-2 text-xs text-zinc-400">
                    ({item.estimated_position})
                  </span>
                )}
              </div>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${conditionColor[item.condition] ?? ""}`}>
              {item.condition}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
