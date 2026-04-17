"use client";

import { useState } from "react";
import Image from "next/image";
import { ImageOff, ZoomIn } from "lucide-react";
import type { ProductImage } from "@/lib/api";

export default function ProductGallery({
  images,
  productName,
}: {
  images: ProductImage[];
  productName: string;
}) {
  const [selectedImage, setSelectedImage] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);

  return (
    <div>
      {/* Main image */}
      <div
        className="aspect-square flex items-center justify-center overflow-hidden relative group cursor-pointer"
        style={{ backgroundColor: "#0F0F0F", border: "1px solid var(--color-border)" }}
        onClick={() => setIsZoomed(!isZoomed)}
        role="button"
        tabIndex={0}
        aria-label={isZoomed ? "Fermer le zoom" : "Zoomer sur l'image"}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsZoomed(!isZoomed);
          }
        }}
      >
        {images[selectedImage] ? (
          <Image
            src={images[selectedImage].url}
            alt={images[selectedImage].alt || productName}
            fill
            sizes="(max-width: 1024px) 100vw, 55vw"
            style={{
              objectFit: "contain",
              padding: isZoomed ? "8px" : "24px",
              transition: "transform 400ms cubic-bezier(0.16, 1, 0.3, 1), padding 400ms cubic-bezier(0.16, 1, 0.3, 1)",
              transform: isZoomed ? "scale(1.5)" : "scale(1)",
            }}
          />
        ) : (
          <ImageOff className="w-20 h-20" style={{ color: "var(--color-border)" }} />
        )}

        {/* Zoom hint overlay */}
        {images[selectedImage] && !isZoomed && (
          <div
            className="absolute bottom-4 right-4 flex items-center gap-1.5 px-3 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            style={{
              backgroundColor: "rgba(0, 0, 0, 0.7)",
              border: "1px solid var(--color-border)",
            }}
          >
            <ZoomIn className="w-3.5 h-3.5" style={{ color: "var(--color-neon)" }} />
            <span className="font-mono text-[0.6rem] uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
              Cliquer pour zoomer
            </span>
          </div>
        )}

        {/* Close zoom hint */}
        {isZoomed && (
          <div
            className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5"
            style={{
              backgroundColor: "rgba(0, 0, 0, 0.7)",
              border: "1px solid var(--color-border)",
            }}
          >
            <span className="font-mono text-[0.6rem] uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
              Cliquer pour fermer
            </span>
          </div>
        )}
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-2 mt-3">
          {images.map((img, i) => (
            <button
              key={img.id || `${img.url}-${i}`}
              onClick={() => {
                setSelectedImage(i);
                setIsZoomed(false);
              }}
              className="cursor-pointer w-16 h-16 md:w-20 md:h-20 flex-shrink-0 overflow-hidden transition-all duration-200 relative"
              style={{
                backgroundColor: "var(--color-surface)",
                border: i === selectedImage ? "1px solid var(--color-neon)" : "1px solid var(--color-border)",
                boxShadow: i === selectedImage ? "0 0 8px rgba(0, 255, 209, 0.2)" : "none",
              }}
            >
              <Image src={img.url} alt="" fill sizes="80px" style={{ objectFit: "contain", padding: "4px" }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
