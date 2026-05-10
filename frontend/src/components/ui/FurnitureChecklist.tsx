"use client";

import type { DetectedFurniture } from "@/types";

interface Props {
  furniture: DetectedFurniture[];
  keepList: Set<string>;
  onToggle: (name: string) => void;
}

const conditionBadge: Record<string, string> = {
  good: "bg-emerald-50 text-emerald-700 border-emerald-200",
  fair: "bg-brand-lighter text-brand-mid border-brand-light",
  poor: "bg-red-50 text-red-600 border-red-200",
};

export default function FurnitureChecklist({ furniture, keepList, onToggle }: Props) {
  return (
    <ul className="divide-y divide-brand-lighter rounded-xl border border-brand-lighter overflow-hidden bg-white">
      {furniture.map((item) => (
        <li
          key={item.name}
          onClick={() => onToggle(item.name)}
          className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-colors ${
            keepList.has(item.name) ? "bg-brand-lighter/50" : "hover:bg-brand-bg"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                keepList.has(item.name)
                  ? "bg-brand-dark border-brand-dark"
                  : "border-brand-light bg-white"
              }`}
            >
              {keepList.has(item.name) && (
                <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <div>
              <span className="text-sm font-medium text-brand-dark capitalize">
                {item.name}
              </span>
              {item.estimated_position && (
                <span className="ml-2 text-xs text-brand-mid">
                  ({item.estimated_position})
                </span>
              )}
            </div>
          </div>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
              conditionBadge[item.condition] ?? "bg-brand-bg text-brand-mid border-brand-lighter"
            }`}
          >
            {item.condition}
          </span>
        </li>
      ))}
    </ul>
  );
}
