"use client";

import { useState } from "react";

/** Filteret er alltid synlig på store skjermer, og kan foldes ut på mobil. */
export function FilterPanel({ active, children }: { active: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="filter-panel" data-open={open}>
      <button
        type="button"
        className="button button-block filter-toggle"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? "Skjul filter" : active > 0 ? `Filter (${active} valgt)` : "Filter"}
      </button>
      {children}
    </div>
  );
}
