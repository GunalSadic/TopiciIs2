"use client";

import type { DesignStyle } from "@/types";

const STYLES: { value: DesignStyle; label: string; symbol: string; desc: string }[] = [
  { value: "Modern",       label: "Modern",       symbol: "◻", desc: "Linii clare, tonuri neutre" },
  { value: "Minimalist",   label: "Minimalist",   symbol: "○", desc: "Mai putin, mai mult" },
  { value: "Luxury",       label: "Luxury",       symbol: "✦", desc: "Materiale bogate, dramatism" },
  { value: "Scandinavian", label: "Scandinavian", symbol: "❄", desc: "Hygge cald, functional" },
  { value: "Japandi",      label: "Japandi",      symbol: "⌬", desc: "Japonez + scandinav" },
  { value: "Industrial",   label: "Industrial",   symbol: "⬡", desc: "Metal, beton, rustic" },
  { value: "Bohemian",     label: "Bohemian",     symbol: "❋", desc: "Eclectic, texturi, culori" },
  { value: "Art Deco",     label: "Art Deco",     symbol: "◈", desc: "Geometric, auriu, opulent" },
  { value: "Coastal",      label: "Coastal",      symbol: "◌", desc: "Albastru, alb, natural" },
  { value: "Traditional",  label: "Traditional",  symbol: "◉", desc: "Clasic, elegant, timpuriu" },
  { value: "Gaming Room",  label: "Gaming Room",  symbol: "⚡", desc: "RGB, ergonomic, tech" },
];

interface Props {
  selected: DesignStyle;
  onChange: (style: DesignStyle) => void;
}

export default function StyleSelector({ selected, onChange }: Props) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
      {STYLES.map((s) => (
        <button
          key={s.value}
          onClick={() => onChange(s.value)}
          className={`
            flex flex-col items-center gap-1 rounded-xl border-2 px-2 py-3 text-center
            transition-all duration-150
            ${
              selected === s.value
                ? "border-brand-light bg-brand-lighter shadow-sm"
                : "border-brand-lighter bg-white hover:border-brand-light/60 hover:shadow-sm"
            }
          `}
        >
          <span
            className={`text-lg font-mono ${
              selected === s.value ? "text-brand-dark" : "text-brand-mid"
            }`}
          >
            {s.symbol}
          </span>
          <span className="text-xs font-semibold text-brand-dark leading-tight">
            {s.label}
          </span>
          <span className="text-[10px] text-brand-mid leading-tight">{s.desc}</span>
        </button>
      ))}
    </div>
  );
}
