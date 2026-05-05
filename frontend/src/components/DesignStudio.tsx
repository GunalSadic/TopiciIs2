"use client";

import { useState } from "react";
import type { DesignStyle } from "@/types";
import { useDesignFlow } from "@/hooks/useDesignFlow";
import ImageDropzone from "@/components/ui/ImageDropzone";
import FurnitureChecklist from "@/components/ui/FurnitureChecklist";
import StyleSelector from "@/components/ui/StyleSelector";
import ResultCard from "@/components/ui/ResultCard";
import Spinner from "@/components/ui/Spinner";

export default function DesignStudio() {
  const {
    step,
    error,
    analysis,
    result,
    keepList,
    handleUpload,
    toggleKeep,
    handleGenerate,
    reset,
  } = useDesignFlow();

  const [style, setStyle] = useState<DesignStyle>("Modern");
  const [notes, setNotes] = useState("");

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">
          RoomRevive <span className="text-violet-600">AI</span>
        </h1>
        <p className="text-zinc-500 text-sm">
          Upload your room · choose what to keep · pick a style · get a render
        </p>
      </div>

      {/* Step 1 — Upload */}
      {(step === "idle" || step === "uploading") && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-zinc-700">
            1 · Upload your room photo
          </h2>
          <ImageDropzone
            onFile={handleUpload}
            disabled={step === "uploading"}
          />
          {step === "uploading" && (
            <Spinner label="Analyzing your room with GPT-4o Vision…" />
          )}
        </section>
      )}

      {/* Step 2 — Select furniture + style */}
      {step === "selecting" && analysis && (
        <section className="space-y-6">
          <div className="rounded-xl bg-zinc-50 border border-zinc-200 p-4">
            <p className="text-sm text-zinc-600">
              <span className="font-semibold capitalize">
                {analysis.room_analysis.room_type}
              </span>{" "}
              · {analysis.room_analysis.raw_description}
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-zinc-700">
              2 · Choose furniture to keep
            </h2>
            <FurnitureChecklist
              furniture={analysis.room_analysis.detected_furniture}
              keepList={keepList}
              onToggle={toggleKeep}
            />
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-zinc-700">
              3 · Pick a design style
            </h2>
            <StyleSelector selected={style} onChange={setStyle} />
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-zinc-700">
              4 · Any extra notes? <span className="text-zinc-400 font-normal">(optional)</span>
            </h2>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. I need a reading nook, prefer dark walls, have a large dog…"
              className="w-full rounded-xl border border-zinc-300 p-3 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
            />
          </div>

          <button
            onClick={() => handleGenerate(style, notes)}
            className="w-full rounded-xl bg-violet-600 text-white font-semibold py-4 text-base hover:bg-violet-700 active:scale-95 transition-all"
          >
            Generate Redesign
          </button>
        </section>
      )}

      {/* Step 3 — Generating */}
      {step === "generating" && (
        <Spinner label="Designing your room and rendering with DALL-E 3… (30-60 sec)" />
      )}

      {/* Step 4 — Done */}
      {step === "done" && result && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-zinc-700">
            Your redesigned room
          </h2>
          <ResultCard result={result} onReset={reset} />
        </section>
      )}

      {/* Error */}
      {step === "error" && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-5 space-y-3">
          <p className="text-sm font-semibold text-red-700">Something went wrong</p>
          <p className="text-sm text-red-600">{error}</p>
          <button
            onClick={reset}
            className="text-sm underline text-red-500 hover:text-red-700"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
