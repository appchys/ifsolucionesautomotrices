"use client";
import { ChecklistItem } from "@/types";
import { Check } from "lucide-react";

interface Props {
  items: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
}

export default function ChecklistInventario({ items, onChange }: Props) {
  const toggle = (index: number) => {
    const updated = items.map((item, i) =>
      i === index ? { ...item, checked: !item.checked } : item
    );
    onChange(updated);
  };

  const checkedCount = items.filter((i) => i.checked).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          {checkedCount} / {items.length} ítems presentes
        </p>
        <div className="progress-bar w-24">
          <div
            className="progress-fill"
            style={{ width: `${(checkedCount / items.length) * 100}%` }}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {items.map((item, i) => (
          <div
            key={item.label}
            className={`checklist-item ${item.checked ? "checked" : ""}`}
            onClick={() => toggle(i)}
          >
            <div
              className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-all"
              style={{
                background: item.checked ? "var(--success)" : "var(--bg-secondary)",
                border: `2px solid ${item.checked ? "var(--success)" : "var(--border)"}`,
              }}
            >
              {item.checked && <Check size={11} className="text-white" />}
            </div>
            <span
              className="text-sm"
              style={{ color: item.checked ? "var(--text-primary)" : "var(--text-secondary)" }}
            >
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
