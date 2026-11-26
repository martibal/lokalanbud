"use client";

import { useState } from "react";

/** Bilder av lokalet: ett stort og små forhåndsvisninger å bytte mellom. */
export function Gallery({ images, name }: { images: string[]; name: string }) {
  const [index, setIndex] = useState(0);
  if (images.length === 0) return null;
  return (
    <div className="gallery">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="gallery-main" src={images[index]} alt={`${name}, bilde ${index + 1} av ${images.length}`} />
      {images.length > 1 && (
        <div className="gallery-thumbs">
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              aria-label={`Vis bilde ${i + 1}`}
              aria-pressed={i === index}
              className={i === index ? "selected" : undefined}
              onClick={() => setIndex(i)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
