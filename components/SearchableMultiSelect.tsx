"use client";

import React, { useState, useRef, useEffect } from "react";
import { Search, X, Check, Plus, ChevronDown } from "lucide-react";

interface SearchableMultiSelectProps {
  label: string;
  placeholder?: string;
  selectedItems: string[];
  onChange: (items: string[]) => void;
  options: string[];
  icon?: React.ReactNode;
  badgeColorClass?: string;
  helperText?: string;
}

export const SearchableMultiSelect: React.FC<SearchableMultiSelectProps> = ({
  label,
  placeholder = "Search or type new...",
  selectedItems = [],
  onChange,
  options,
  icon,
  badgeColorClass = "bg-teal-950/70 border-teal-500/40 text-teal-300",
  helperText,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const trimmedQuery = searchQuery.trim();

  // Filter options based on search query
  const filteredOptions = options.filter((option) =>
    option.toLowerCase().includes(trimmedQuery.toLowerCase())
  );

  // Check if current search query matches an existing option exactly
  const exactMatchExists = options.some(
    (opt) => opt.toLowerCase() === trimmedQuery.toLowerCase()
  );

  const handleToggleItem = (item: string) => {
    if (selectedItems.includes(item)) {
      onChange(selectedItems.filter((i) => i !== item));
    } else {
      onChange([...selectedItems, item]);
    }
  };

  const handleRemoveItem = (itemToRemove: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    onChange(selectedItems.filter((item) => item !== itemToRemove));
  };

  const handleAddCustomItem = () => {
    if (!trimmedQuery) return;
    if (!selectedItems.includes(trimmedQuery)) {
      onChange([...selectedItems, trimmedQuery]);
    }
    setSearchQuery("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (filteredOptions.length > 0 && !exactMatchExists && trimmedQuery) {
        // If there's an exact search or user typed custom, add custom
        handleAddCustomItem();
      } else if (filteredOptions.length === 1) {
        handleToggleItem(filteredOptions[0]);
        setSearchQuery("");
      } else if (trimmedQuery) {
        handleAddCustomItem();
      }
    } else if (e.key === "Backspace" && searchQuery === "" && selectedItems.length > 0) {
      // Remove last tag when backspacing on empty query
      handleRemoveItem(selectedItems[selectedItems.length - 1]);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      {/* Label & Header */}
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
          {icon}
          <span>{label}</span>
          {selectedItems.length > 0 && (
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-slate-800 text-teal-400 border border-slate-700">
              {selectedItems.length}
            </span>
          )}
        </label>
        {selectedItems.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-[10px] text-slate-500 hover:text-rose-400 transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Selected Items & Input Container */}
      <div
        onClick={() => {
          setIsOpen(true);
          inputRef.current?.focus();
        }}
        className={`w-full min-h-[42px] bg-slate-900 border rounded-xl p-1.5 transition-all cursor-text flex flex-wrap items-center gap-1.5 ${
          isOpen
            ? "border-teal-500/80 ring-1 ring-teal-500/30 bg-slate-900/90 shadow-sm"
            : "border-slate-800 hover:border-slate-700"
        }`}
      >
        {/* Selected Tags */}
        {selectedItems.map((item) => (
          <span
            key={item}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border shadow-xs transition-all animate-in fade-in-50 duration-150 ${badgeColorClass}`}
          >
            <span className="truncate max-w-[190px]">{item}</span>
            <button
              type="button"
              onClick={(e) => handleRemoveItem(item, e)}
              className="text-slate-400 hover:text-white p-0.5 rounded hover:bg-black/30 transition-colors"
              title={`Remove ${item}`}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}

        {/* Input */}
        <div className="flex-1 min-w-[120px] flex items-center gap-1.5 px-1.5">
          <Search className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (!isOpen) setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={selectedItems.length === 0 ? placeholder : "Add more..."}
            className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(!isOpen);
            }}
            className="text-slate-500 hover:text-slate-300 p-0.5"
          >
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-200 ${
                isOpen ? "rotate-180" : ""
              }`}
            />
          </button>
        </div>
      </div>

      {helperText && !isOpen && selectedItems.length === 0 && (
        <p className="text-[10px] text-slate-500 mt-1 pl-1">{helperText}</p>
      )}

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 max-h-60 overflow-y-auto bg-slate-950 border border-slate-800 rounded-xl shadow-2xl backdrop-blur-md p-1.5 space-y-1">
          {/* Custom entry button if typed query doesn't exactly match */}
          {trimmedQuery && !exactMatchExists && (
            <button
              type="button"
              onClick={handleAddCustomItem}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left rounded-lg bg-teal-950/40 border border-teal-500/30 text-teal-300 hover:bg-teal-900/50 transition-colors font-medium"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span>
                Add custom: <strong className="text-white">"{trimmedQuery}"</strong>
              </span>
            </button>
          )}

          {/* List of matched options */}
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => {
              const isSelected = selectedItems.includes(option);
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    handleToggleItem(option);
                    setSearchQuery("");
                  }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left rounded-lg transition-colors ${
                    isSelected
                      ? "bg-slate-900 text-teal-300 font-semibold"
                      : "text-slate-300 hover:bg-slate-900/80 hover:text-white"
                  }`}
                >
                  <span className="truncate">{option}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-teal-400 shrink-0" />}
                </button>
              );
            })
          ) : (
            !trimmedQuery && (
              <div className="px-3 py-2 text-xs text-slate-500 text-center">
                No items to display
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
};
