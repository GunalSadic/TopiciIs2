"use client";

interface Props {
  label?: string;
}

export default function Spinner({ label }: Props) {
  return (
    <div className="flex flex-col items-center gap-4 py-16">
      <div className="w-11 h-11 rounded-full border-[3px] border-brand-lighter border-t-brand-dark animate-spin" />
      {label && (
        <p className="text-sm text-brand-mid animate-pulse max-w-xs text-center leading-relaxed">
          {label}
        </p>
      )}
    </div>
  );
}
