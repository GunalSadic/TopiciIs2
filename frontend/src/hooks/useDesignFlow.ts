"use client";

import { useState } from "react";
import {
  uploadRoom,
  sourceProducts,
  renderDesign,
  smartReplace,
  addCustomProduct,
  removeSourcedProduct,
  findMoreProducts,
} from "@/lib/api";
import type {
  AnalysisResponse,
  DesignResponse,
  DesignStyle,
  MatchedProduct,
  SourcingResponse,
} from "@/types";

type Step =
  | "idle"
  | "uploading"
  | "selecting"
  | "sourcing"
  | "previewing"
  | "rendering"
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
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  async function handleUpload(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);

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

  async function handleSourceProducts(
    style: DesignStyle,
    notes: string,
    maxBudget?: number
  ) {
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

  async function handleAddCustomProduct(data: {
    name: string;
    url: string;
    slot: string;
    price: number;
  }) {
    if (!sourcing) return;

    // Optimistic update with placeholder
    const tempId = `custom-${Date.now()}`;
    const optimisticProduct: MatchedProduct = {
      product_id: tempId,
      name: data.name || "Produs Custom",
      category: data.slot,
      price: data.price,
      currency: "RON",
      image_url: "",
      product_url: data.url,
      store: "Custom",
      slot: data.slot,
      description: "Se incarca imaginea...",
    };

    setSourcing((prev) =>
      prev
        ? { ...prev, sourced_products: [...prev.sourced_products, optimisticProduct] }
        : prev
    );

    // Sync to backend — fetches og:image from URL
    try {
      const resp = await addCustomProduct(sourcing.job_id, data);
      // Update with real product_id and image from backend
      setSourcing((prev) =>
        prev
          ? {
              ...prev,
              sourced_products: prev.sourced_products.map((p) =>
                p.product_id === tempId
                  ? {
                      ...p,
                      product_id: resp.product_id,
                      image_base64: resp.image_base64 ?? p.image_base64,
                      description: "",
                    }
                  : p
              ),
            }
          : prev
      );
    } catch (e) {
      console.error("Failed to sync custom product to backend:", e);
    }
  }

  async function handleFindMoreProducts() {
    if (!sourcing) return;
    setStep("sourcing");
    setError(null);
    try {
      const resp = await findMoreProducts(sourcing.job_id);
      setSourcing(resp);
      setStep("previewing");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Nu am putut gasi mai multe produse");
      setStep("error");
    }
  }

  async function handleRemoveProduct(productId: string) {
    if (!sourcing) return;

    // Remove from UI immediately
    setSourcing((prev) =>
      prev
        ? {
            ...prev,
            sourced_products: prev.sourced_products.filter(
              (p) => p.product_id !== productId
            ),
          }
        : prev
    );

    // Sync to backend
    try {
      await removeSourcedProduct(sourcing.job_id, productId);
    } catch (e) {
      console.error("Failed to sync product removal to backend:", e);
    }
  }

  function reset() {
    setStep("idle");
    setError(null);
    setAnalysis(null);
    setSourcing(null);
    setResult(null);
    setKeepList(new Set());
    setImagePreview(null);
  }

  return {
    step,
    error,
    analysis,
    sourcing,
    result,
    keepList,
    imagePreview,
    handleUpload,
    toggleKeep,
    handleSourceProducts,
    handleConfirmAndRender,
    handleBackToSelecting,
    handleSmartReplace,
    handleAddCustomProduct,
    handleRemoveProduct,
    handleFindMoreProducts,
    reset,
  };
}
