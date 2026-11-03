"use client";
import { useId } from "react";
import { displayLabel } from "@/lib/workspace-display";
const names: Record<string, string> = {
  laptop: "Business laptop",
  desktop: "Desktop workstation",
  consulting: "Technology planning",
  support: "Installation & support",
  ai: "AI & automation",
  software: "Software development",
  data: "Data analytics",
  servers: "Servers & cloud",
  network: "Networking",
  accessory: "Accessories",
  printer: "Office printing",
  procurement: "Equipment procurement",
  workplace: "Workplace technology",
};
export default function ImageChoice({
  value,
  options,
  onChange,
}: {
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
}) {
  const group = useId();
  return (
    <fieldset className="image-choice">
      <legend>Service photograph</legend>
      <div>
        {options.map((name) => (
          <label key={name}>
            <input
              type="radio"
              name={group}
              value={name}
              checked={value === name}
              onChange={() => onChange(name)}
            />
            <img
              src={"/photos/" + name + "-480.webp"}
              alt=""
              width="160"
              height="106"
              loading="lazy"
            />
            <span>{names[name] || displayLabel(name)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
