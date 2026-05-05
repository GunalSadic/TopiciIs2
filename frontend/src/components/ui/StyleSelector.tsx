"use client";

import type { DesignStyle } from "@/types";

const STYLES: { value: DesignStyle; label: string; emoji: string; desc: string }[] = [
  { value: "Modern",       label: "Modern",       emoji: "◻️", desc: "Clean lines, neutral tones" },
  { value: "Minimalist",   label: "Minimalist",   emoji: "○", desc: "Less is more" },
  { value: "Luxury",       label: "Luxury",       emoji: "✦", desc: "Rich materials & drama" },
  { value: "Scandinavian", label: "Scandinavian", emoji: "❄", desc: "Warm & functional hygge" },
  { value: "Gaming Room",  label: "Gaming Room",  emoji: "⚡", desc: "RGB & ergonomic setup" },
];

interface Props {
  selected: DesignStyle;
  onChange: (style: DesignStyle) => void;
}

export default function StyleSelector({ selected, onChange }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {STYLES.map((s) => (
        <button
          key={s.value}
          onClick={() => onChange(s.value)}
          className={`
            flex flex-col items-center gap-1 rounded-xl border-2 p-4 text-center
            transition-all duration-150 hover:border-violet-400
            ${selected === s.value
              ? "border-violet-600 bg-violet-50 shadow-sm"
              : "border-zinc-200 bg-white"
            }
          `}
        >
          <span className="text-2xl">{s.emoji}</span>
          <span className="text-sm font-semibold text-zinc-800">{s.label}</span>
          <span className="text-xs text-zinc-400">{s.desc}</span>
        </button>
      ))}
    </div>
  );
}
