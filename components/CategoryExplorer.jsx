"use client";

import { useState } from "react";
import { ArrowRight, ChevronDown } from "lucide-react";

const categoryGroups = [
  { name: "Singles" },
  { name: "Sealed" },
  { name: "Graded" },
  { name: "Supplies" }
];

export function CategoryExplorer() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="category-explorer">
      <button
        className={`category-toggle eyebrow${isOpen ? " is-open" : ""}`}
        type="button"
        aria-expanded={isOpen}
        aria-controls="category-panel"
        onClick={() => setIsOpen((current) => !current)}
      >
        Categories
        <ChevronDown size={14} />
      </button>

      {isOpen ? (
        <div className="category-panel" id="category-panel" aria-label="Product categories">
          <div className="category-button-list">
            {categoryGroups.map((category) => (
              <a className="category-button" href="#products" key={category.name}>
                <span>{category.name}</span>
                <ArrowRight size={16} />
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
