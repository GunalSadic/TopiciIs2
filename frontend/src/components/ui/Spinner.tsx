"use client";

interface Props {
  label?: string;
}

export default function Spinner({ label }: Props) {
  return (
    <div className="flex flex-col items-center gap-4 py-16">
      <div className="w-12 h-12 rounded-full border-4 border-violet-200 border-t-violet-600 animate-spin" />
      {label && <p className="text-sm text-zinc-500 animate-pulse">{label}</p>}
    </div>
  );
}
