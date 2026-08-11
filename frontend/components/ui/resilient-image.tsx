"use client";

import { useState } from "react";
import { ImageIcon, Loader2 } from "lucide-react";

import { resolveImageUrl } from "@/lib/media";

export function ResilientImage({
  src,
  alt,
  className = "h-full w-full object-cover",
  containerClassName = "aspect-square",
  emptyLabel = "No image",
}: {
  src?: string | null;
  alt: string;
  className?: string;
  containerClassName?: string;
  emptyLabel?: string;
}) {
  const resolved = resolveImageUrl(src);
  return <ResilientImageContent key={resolved || "empty"} resolved={resolved} alt={alt} className={className} containerClassName={containerClassName} emptyLabel={emptyLabel} />;
}

function ResilientImageContent({ resolved, alt, className, containerClassName, emptyLabel }: { resolved: string; alt: string; className: string; containerClassName: string; emptyLabel: string }) {
  const [state, setState] = useState<"loading" | "ready" | "error">(resolved ? "loading" : "error");

  return (
    <div className={`relative flex overflow-hidden bg-[var(--color-surf-hover)] ${containerClassName}`}>
      {resolved ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={resolved}
          alt={alt}
          className={`${className} ${state === "ready" ? "opacity-100" : "opacity-0"}`}
          onLoad={() => setState("ready")}
          onError={() => setState("error")}
        />
      ) : null}
      {state === "loading" ? (
        <span className="absolute inset-0 flex items-center justify-center" role="status" aria-label={`Loading ${alt}`}>
          <Loader2 className="h-5 w-5 animate-spin text-[var(--color-txt-mut)]" aria-hidden="true" />
        </span>
      ) : null}
      {state === "error" ? (
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-2 text-center text-[var(--color-txt-mut)]">
          <ImageIcon className="h-5 w-5" aria-hidden="true" />
          <span className="text-[10px] font-medium">{emptyLabel}</span>
        </span>
      ) : null}
    </div>
  );
}
