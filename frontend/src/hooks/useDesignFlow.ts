"use client";

import { useState } from "react";
import { uploadRoom, sourceProducts, renderDesign, smartReplace } from "@/lib/api";
import type {
  AnalysisResponse,
  DesignResponse,
  DesignStyle,
  SourcingResponse,
} from "@/types";

type Step =
  | "idle"
  | "uploading"
  | "selecting"
  | "sourcing"      // Plan + Market (web search)
  | "previewing"    // User reviews sourced products before rendering
  | "rendering"     // Iterative renderer running
  | "done"
  | "replacing"
  | "error";

export function useDesignFlow() {
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [sourcing, setSourcing] = useState<SourcingResponse | null>(null);
  const [result, setResult] = useState<DesignResponse | null>(null);
  const [keepList, setKeepList] = useState<Set<string>>(new Set());

  async function handleUpload(file: File) {
    setStep("uploading");
    setError(null);
    try {
      const resp = await uploadRoom(file);
      setAnalysis(resp);
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

  /** Step 2A — Plan + Source products (web search). Shows preview. */
  async function handleSourceProducts(style: DesignStyle, notes: string, maxBudget?: number) {
    if (!analysis) return;
    setStep("sourcing");
    setError(null);
    try {
      const resp = await sourceProducts(
        analysis.job_id,
        style,
        Array.from(keepList),
        notes,
        maxBudget
      );
      setSourcing(resp);
      setStep("previewing");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Sourcing failed");
      setStep("error");
    }
  }

  /** Step 2B — User confirmed products, now render. */
  async function handleConfirmAndRender() {
    if (!sourcing) return;
    setStep("rendering");
    setError(null);
    try {
      const resp = await renderDesign(sourcing.job_id);
      setResult(resp);
      setStep("done");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Rendering failed");
      setStep("error");
    }
  }

  /** Go back from preview to selecting (re-do sourcing with different params) */
  function handleBackToSelecting() {
    setSourcing(null);
    setStep("selecting");
  }

  async function handleSmartReplace(slot: string, newProductId: string) {
    if (!result) return;
    setStep("replacing");
    setError(null);
    try {
      const resp = await smartReplace(result.job_id, slot, newProductId);
      setResult(resp);
      setStep("done");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Smart Replace failed");
      setStep("error");
    }
  }

  function reset() {
    setStep("idle");
    setError(null);
    setAnalysis(null);
    setSourcing(null);
    setResult(null);
    setKeepList(new Set());
  }

  return {
    step,
    error,
    analysis,
    sourcing,
    result,
    keepList,
    handleUpload,
    toggleKeep,
    handleSourceProducts,
    handleConfirmAndRender,
    handleBackToSelecting,
    handleSmartReplace,
    reset,
  };
}
