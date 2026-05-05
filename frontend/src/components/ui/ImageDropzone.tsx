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
        transition-colors cursor-pointer
        ${dragOver ? "border-violet-500 bg-violet-50" : "border-zinc-300 bg-zinc-50 hover:border-violet-400"}
        ${disabled ? "opacity-50 pointer-events-none" : ""}
      `}
    >
      {preview ? (
        <img
          src={preview}
          alt="Room preview"
          className="max-h-72 rounded-xl object-contain"
        />
      ) : (
        <div className="flex flex-col items-center gap-3 p-8 text-center">
          <svg className="w-12 h-12 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          <p className="text-sm font-medium text-zinc-600">
            Drop your room photo here, or{" "}
            <span className="text-violet-600 underline">browse</span>
          </p>
          <p className="text-xs text-zinc-400">JPEG, PNG, WebP — max 10 MB</p>
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
