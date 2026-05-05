"use client";

import type { DesignResponse } from "@/types";

interface Props {
  result: DesignResponse;
  onReset: () => void;
}

export default function ResultCard({ result, onReset }: Props) {
  const { design_proposal, room_analysis } = result;

  return (
    <div className="space-y-6">
      {/* Generated render */}
      <div className="overflow-hidden rounded-2xl shadow-xl">
        <img
          src={design_proposal.generated_image_url}
          alt="AI-generated room redesign"
          className="w-full object-cover"
        />
      </div>

      {/* Design rationale */}
      <div className="rounded-xl bg-zinc-50 border border-zinc-200 p-5 space-y-1">
        <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide">
          Design rationale
        </h3>
        <p className="text-zinc-800 leading-relaxed">
          {design_proposal.design_rationale}
        </p>
      </div>

      {/* Room summary */}
      <div className="rounded-xl bg-violet-50 border border-violet-100 p-5 space-y-2">
        <h3 className="text-sm font-semibold text-violet-600 uppercase tracking-wide">
          Room analysis
        </h3>
        <p className="text-sm text-zinc-600">{room_analysis.raw_description}</p>
        <p className="text-xs text-zinc-400">
          Lighting: {room_analysis.lighting} · Type: {room_analysis.room_type}
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <a
          href={design_proposal.generated_image_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 rounded-xl bg-violet-600 text-white text-sm font-semibold py-3 text-center hover:bg-violet-700 transition-colors"
        >
          Open full image
        </a>
        <button
          onClick={onReset}
          className="flex-1 rounded-xl border border-zinc-300 text-zinc-700 text-sm font-semibold py-3 hover:bg-zinc-50 transition-colors"
        >
          Start over
        </button>
      </div>
    </div>
  );
}
