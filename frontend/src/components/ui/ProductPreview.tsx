"use client";

import { useState } from "react";
import type { SourcingResponse } from "@/types";

interface CustomProductData {
  name: string;
  url: string;
  slot: string;
  price: number;
}

interface Props {
  sourcing: SourcingResponse;
  onConfirm: () => void;
  onBack: () => void;
  onAddCustomProduct?: (data: CustomProductData) => void;
  onRemoveProduct?: (productId: string) => void;
  onFindMore?: () => void;
}

const COMMON_SLOTS = [
  "sofa", "canapea", "fotoliu", "scaun", "pat", "masa", "birou",
  "dulap", "raft", "lampa", "tablou", "covor", "oglinda", "planta",
  "noptiera", "tv unit", "perna", "chair", "table", "desk", "shelf",
  "lamp", "painting", "rug", "mirror", "plant", "wardrobe", "cabinet",
];

export default function ProductPreview({
  sourcing,
  onConfirm,
  onBack,
  onAddCustomProduct,
  onRemoveProduct,
  onFindMore,
}: Props) {
  const { sourced_products, design_plan } = sourcing;
  const totalPrice = sourced_products.reduce((sum, p) => sum + p.price, 0);

  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customUrl, setCustomUrl] = useState("");
  const [customName, setCustomName] = useState("");
  const [customSlot, setCustomSlot] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [customLoading, setCustomLoading] = useState(false);
  const [customAdded, setCustomAdded] = useState(false);

  const planSlots = [...new Set(
    design_plan.suggestions.map((s) => s.item_type).filter(Boolean)
  )];
  const availableSlots = [
    ...planSlots,
    ...COMMON_SLOTS.filter((s) => !planSlots.includes(s)),
  ];

  async function handleAddCustom() {
    if (!customUrl || !customSlot) return;
    setCustomLoading(true);
    await onAddCustomProduct?.({
      name: customName || "Produs Custom",
      url: customUrl,
      slot: customSlot,
      price: customPrice ? parseFloat(customPrice) : 0,
    });
    setCustomUrl("");
    setCustomName("");
    setCustomSlot("");
    setCustomPrice("");
    setCustomLoading(false);
    setCustomAdded(true);
    setShowCustomForm(false);
    setTimeout(() => setCustomAdded(false), 3000);
  }

  return (
    <div className="space-y-5">
      {/* Design Vision */}
      <div className="rounded-xl bg-brand-bg border border-brand-lighter p-4 space-y-1">
        <h3 className="text-xs font-bold text-brand-mid uppercase tracking-widest">
          Viziunea de design
        </h3>
        <p className="text-sm text-brand-dark leading-relaxed">{design_plan.overall_vision}</p>
      </div>

      {/* Product list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-brand-dark">
            Produse gasite ({sourced_products.length})
          </h3>
          <div className="flex items-center gap-2 flex-shrink-0">
            {customAdded && (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-0.5">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Produs adaugat
              </span>
            )}
            {onFindMore && (
              <button
                onClick={onFindMore}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-mid border border-brand-lighter bg-white rounded-lg px-3 py-1.5 hover:border-brand-light hover:text-brand-dark transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Gaseste alte produse
              </button>
            )}
          </div>
        </div>
        <p className="text-xs text-brand-mid">
          Nu iti plac alegerile? Apasa &quot;Gaseste alte produse&quot; pentru alternative noi, sau elimina individual ce nu vrei.
        </p>

        {sourced_products.map((product) => (
          <div
            key={product.product_id}
            className={`flex gap-4 rounded-xl border bg-white p-4 shadow-sm transition-colors ${
              product.store === "Custom"
                ? "border-brand-light bg-brand-lighter/30"
                : "border-brand-lighter"
            }`}
          >
            {/* Thumbnail */}
            <div className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-brand-bg border border-brand-lighter">
              {product.image_base64 ? (
                <img
                  src={`data:image/jpeg;base64,${product.image_base64}`}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-brand-light text-xs text-center px-1">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                  </svg>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-start gap-2">
                <h4 className="text-sm font-semibold text-brand-dark truncate flex-1">
                  {product.name}
                </h4>
                {product.store === "Custom" && (
                  <span className="flex-shrink-0 text-xs text-brand-mid bg-brand-lighter border border-brand-light rounded-full px-2 py-0.5">
                    Custom
                  </span>
                )}
              </div>
              {product.description && product.description !== "Produs adaugat manual" && (
                <p className="text-xs text-brand-mid line-clamp-1">{product.description}</p>
              )}
              <div className="flex items-center gap-2 text-xs">
                <span className="font-bold text-brand-dark">
                  {product.price > 0
                    ? `${product.price.toLocaleString("ro-RO")} ${product.currency}`
                    : "Pret nedefinit"}
                </span>
                {product.store && product.store !== "Custom" && (
                  <>
                    <span className="text-brand-lighter">·</span>
                    <span className="text-brand-mid">{product.store}</span>
                  </>
                )}
              </div>
              <p className="text-xs text-brand-mid">
                Slot: <span className="text-brand-dark">{product.slot}</span>
              </p>
              {product.product_url && (
                <a
                  href={product.product_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-brand-mid hover:text-brand-dark font-medium underline"
                >
                  {product.store === "Custom" ? "Deschide link →" : `Vezi pe ${product.store} →`}
                </a>
              )}
            </div>

            {/* Right side: status + remove */}
            <div className="flex-shrink-0 flex flex-col items-end gap-2">
              {product.image_base64 ? (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                  <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  OK
                </span>
              ) : (
                <span className="inline-flex text-xs text-brand-mid bg-brand-bg border border-brand-lighter rounded-full px-2 py-0.5">
                  Text
                </span>
              )}

              {onRemoveProduct && (
                <button
                  onClick={() => onRemoveProduct(product.product_id)}
                  className="w-6 h-6 rounded-full bg-brand-bg border border-brand-lighter flex items-center justify-center text-brand-mid hover:bg-red-50 hover:border-red-200 hover:text-red-500 transition-colors"
                  title="Elimina produsul"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        ))}

        {sourced_products.length === 0 && (
          <div className="rounded-xl bg-brand-bg border border-brand-lighter p-4">
            <p className="text-sm text-brand-mid">
              Lista e goala. Adauga un produs propriu sau mergi inapoi sa incerci din nou.
            </p>
          </div>
        )}
      </div>

      {/* Add custom product */}
      {onAddCustomProduct && (
        <div className="rounded-xl border border-brand-lighter bg-white overflow-hidden">
          <button
            onClick={() => setShowCustomForm((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-brand-bg transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-brand-lighter border border-brand-light flex items-center justify-center flex-shrink-0">
                <svg className="w-3.5 h-3.5 text-brand-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-brand-dark">
                  Adauga un produs propriu
                </p>
                <p className="text-xs text-brand-mid">
                  Lipeste link-ul — imaginea e preluata automat de pe site
                </p>
              </div>
            </div>
            <svg
              className={`w-4 h-4 text-brand-mid transition-transform duration-200 ${showCustomForm ? "rotate-180" : ""}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showCustomForm && (
            <div className="border-t border-brand-lighter p-4 space-y-3">
              <input
                type="url"
                placeholder="URL produs (obligatoriu) — ex. https://www.emag.ro/..."
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                className="w-full rounded-lg border border-brand-lighter bg-brand-bg px-3 py-2.5 text-sm text-brand-dark placeholder:text-brand-mid focus:outline-none focus:ring-2 focus:ring-brand-light focus:border-transparent"
              />
              <input
                type="text"
                placeholder="Nume produs (optional — altfel il luam din URL)"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="w-full rounded-lg border border-brand-lighter bg-brand-bg px-3 py-2.5 text-sm text-brand-dark placeholder:text-brand-mid focus:outline-none focus:ring-2 focus:ring-brand-light focus:border-transparent"
              />
              <div className="flex gap-3">
                <select
                  value={customSlot}
                  onChange={(e) => setCustomSlot(e.target.value)}
                  className="flex-1 rounded-lg border border-brand-lighter bg-brand-bg px-3 py-2.5 text-sm text-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-light"
                >
                  <option value="">Alege unde sa fie pus in camera</option>
                  {availableSlots.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                  <option value="other">Altul</option>
                </select>
                <input
                  type="number"
                  placeholder="Pret RON"
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                  className="w-28 rounded-lg border border-brand-lighter bg-brand-bg px-3 py-2.5 text-sm text-brand-dark placeholder:text-brand-mid focus:outline-none focus:ring-2 focus:ring-brand-light"
                />
              </div>
              <button
                onClick={handleAddCustom}
                disabled={!customUrl || !customSlot || customLoading}
                className="w-full rounded-lg bg-brand-dark text-white font-semibold text-sm py-2.5 hover:bg-[#55536A] disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all"
              >
                {customLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Se incarca imaginea de pe site...
                  </span>
                ) : (
                  "Adauga Produs in Lista"
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Total + Actions */}
      <div className="rounded-xl bg-brand-bg border border-brand-lighter p-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-brand-mid">Total estimat</p>
          <p className="text-xl font-bold text-brand-dark">
            {totalPrice.toLocaleString("ro-RO")} RON
          </p>
        </div>
        <div className="text-right text-xs text-brand-mid">
          {sourced_products.filter((p) => p.image_base64).length} /{" "}
          {sourced_products.length} imagini
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 rounded-xl border border-brand-lighter text-brand-dark text-sm font-semibold py-3.5 hover:bg-brand-bg transition-colors"
        >
          ← Inapoi
        </button>
        <button
          onClick={onConfirm}
          disabled={sourced_products.length === 0}
          className="flex-1 rounded-xl bg-brand-dark text-white text-sm font-semibold py-3.5 hover:bg-[#55536A] active:scale-95 disabled:opacity-40 transition-all shadow-md shadow-brand-dark/10"
        >
          Confirma si Genereaza Design →
        </button>
      </div>
    </div>
  );
}
