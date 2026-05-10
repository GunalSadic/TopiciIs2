"use client";

import { useCallback, useState } from "react";

interface Props {
  onFile: (file: File) => void;
  disabled?: boolean;
}

export default function ImageDropzone({ onFile, disabled }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const processFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(file);
      onFile(file);
    },
    [onFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      className={`
        relative flex flex-col items-center justify-center
        w-full min-h-64 rounded-2xl border-2 border-dashed
        transition-all duration-200 cursor-pointer
        ${dragOver
          ? "border-brand-light bg-brand-lighter/40"
          : "border-brand-lighter bg-white hover:border-brand-light hover:bg-brand-bg"
        }
        ${disabled ? "opacity-50 pointer-events-none" : ""}
      `}
    >
      {preview ? (
        <img
          src={preview}
          alt="Room preview"
          className="max-h-72 rounded-xl object-contain p-2"
        />
      ) : (
        <div className="flex flex-col items-center gap-3 p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-brand-lighter flex items-center justify-center">
            <svg className="w-7 h-7 text-brand-mid" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-brand-dark">
              Trage fotografia aici sau{" "}
              <span className="text-brand-mid underline">selecteaza</span>
            </p>
            <p className="text-xs text-brand-mid mt-1">JPEG, PNG, WebP · max 10 MB</p>
          </div>
        </div>
      )}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleChange}
        disabled={disabled}
        className="absolute inset-0 opacity-0 cursor-pointer"
      />
    </div>
  );
}
