"use client";

import { useState } from "react";
import Image from "next/image";
import { ImageOff } from "lucide-react";
import type { ProductImage } from "@/lib/api";

export default function ProductGallery({
  images,
  productName,
}: {
  images: ProductImage[];
  productName: string;
}) {
  const [selectedImage, setSelectedImage] = useState(0);

  return (
    <div>
      <div
        className="aspect-square flex items-center justify-center overflow-hidden relative"
        style={{ backgroundColor: "#0F0F0F", border: "1px solid var(--color-border)" }}
      >
        {images[selectedImage] ? (
          <Image
            src={images[selectedImage].url}
            alt={images[selectedImage].alt || productName}
            fill
            sizes="(max-width: 1024px) 100vw, 55vw"
            style={{ objectFit: "contain", padding: "24px" }}
          />
        ) : (
          <ImageOff className="w-20 h-20" style={{ color: "var(--color-border)" }} />
        )}
      </div>

      {images.length > 1 && (
        <div className="flex gap-2 mt-3">
          {images.map((img, i) => (
            <button
              key={img.id || `${img.url}-${i}`}
              onClick={() => setSelectedImage(i)}
              className="w-16 h-16 md:w-20 md:h-20 flex-shrink-0 overflow-hidden transition-colors relative"
              style={{
                backgroundColor: "var(--color-surface)",
                border: i === selectedImage ? "1px solid var(--color-neon)" : "1px solid var(--color-border)",
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
