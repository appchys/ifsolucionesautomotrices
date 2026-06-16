import { ChecklistItem } from "@/types";

export const CHECKLIST_DEFAULT: ChecklistItem[] = [
  { label: "Antenas", checked: false },
  { label: "Botiquín", checked: false },
  { label: "Documentos", checked: false },
  { label: "Encendedor", checked: false },
  { label: "Extintor", checked: false },
  { label: "Gata", checked: false },
  { label: "Herramientas", checked: false },
  { label: "Llave 1", checked: false },
  { label: "Llave 2", checked: false },
  { label: "Llave de rueda", checked: false },
  { label: "Pisos", checked: false },
  { label: "Rueda de repuesto", checked: false },
  { label: "Tag", checked: false },
  { label: "Tapas de ruedas", checked: false },
  { label: "Triángulos", checked: false },
];

export const normalizeLabel = (label: string): string => {
  const clean = label.trim().toLowerCase();
  if (clean === "llanta de repuesto" || clean === "rueda de repuesto") return "rueda de repuesto";
  if (clean === "herramientas (llaves)" || clean === "herramientas") return "herramientas";
  if (clean === "triángulos de emergencia" || clean === "triángulos" || clean === "triangulos de emergencia" || clean === "triangulos") return "triángulos";
  if (clean === "documentos del vehículo" || clean === "documentos del vehiculo" || clean === "documentos") return "documentos";
  return clean;
};

export const getMergedChecklist = (savedChecklist?: ChecklistItem[]): ChecklistItem[] => {
  if (!savedChecklist || savedChecklist.length === 0) {
    return CHECKLIST_DEFAULT;
  }
  
  // Create a map of normalized label -> checked
  const savedMap = new Map<string, boolean>();
  savedChecklist.forEach((item) => {
    savedMap.set(normalizeLabel(item.label), item.checked);
  });

  // Map CHECKLIST_DEFAULT, fetching checked status from savedMap if available
  return CHECKLIST_DEFAULT.map((defaultItem) => {
    const norm = normalizeLabel(defaultItem.label);
    const checked = savedMap.has(norm) ? !!savedMap.get(norm) : defaultItem.checked;
    return {
      ...defaultItem,
      checked,
    };
  });
};
