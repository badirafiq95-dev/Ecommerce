"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";

const categoryGroups = [
  {
    name: "Singles",
    subcategories: ["Near Mint", "Popular", "Holo", "Trainer"]
  },
  {
    name: "Sealed",
    subcategories: ["Booster Packs", "Deck Boxes", "Fresh Stock"]
  },
  {
    name: "Graded",
    subcategories: ["Slabs", "Gem Mint", "Rare Finds"]
  },
  {
    name: "Supplies",
    subcategories: ["Sleeves", "Cases", "Storage"]
  }
];

export function CategoryPanel() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button className={`category-trigger ${isOpen ? "is-open" : ""}`} type="button" onClick={() => setIsOpen((value) => !value)}>
        Categories
      </button>
      {isOpen ? (
        <div className="category-panel reveal" aria-label="Product categories">
          <div className="category-button-list">
            {categoryGroups.map((category) => (
              <a className="category-button" href="#products" key={category.name}>
                <span>{category.name}</span>
                <ArrowRight size={16} />
              </a>
            ))}
          </div>
          <div className="subcategory-display">
            {categoryGroups.map((category) => (
              <div className="subcategory-group" key={category.name}>
                <strong>{category.name}</strong>
                <div>
                  {category.subcategories.map((subcategory) => (
                    <span key={subcategory}>{subcategory}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}
