"use client";

import { useState } from "react";
import { uploadRoom, generateDesign } from "@/lib/api";
import type {
  AnalysisResponse,
  DesignResponse,
  DesignStyle,
} from "@/types";

type Step = "idle" | "uploading" | "selecting" | "generating" | "done" | "error";

export function useDesignFlow() {
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [result, setResult] = useState<DesignResponse | null>(null);
  const [keepList, setKeepList] = useState<Set<string>>(new Set());

  async function handleUpload(file: File) {
    setStep("uploading");
    setError(null);
    try {
      const resp = await uploadRoom(file);
      setAnalysis(resp);
      // Pre-select all "good" furniture for keeping
      const defaults = resp.room_analysis.detected_furniture
        .filter((f) => f.keep && f.condition !== "poor")
        .map((f) => f.name);
      setKeepList(new Set(defaults));
      setStep("selecting");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed");
      setStep("error");
    }
  }

  function toggleKeep(name: string) {
    setKeepList((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }

  async function handleGenerate(style: DesignStyle, notes: string) {
    if (!analysis) return;
    setStep("generating");
    setError(null);
    try {
      const resp = await generateDesign(
        analysis.job_id,
        style,
        Array.from(keepList),
        notes
      );
      setResult(resp);
      setStep("done");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Generation failed");
      setStep("error");
    }
  }

  function reset() {
    setStep("idle");
    setError(null);
    setAnalysis(null);
    setResult(null);
    setKeepList(new Set());
  }

  return {
    step,
    error,
    analysis,
    result,
    keepList,
    handleUpload,
    toggleKeep,
    handleGenerate,
    reset,
  };
}
