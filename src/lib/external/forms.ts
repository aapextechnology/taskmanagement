// Code-defined structured forms (T-073, PLAN §5). Four fixed types for v1 —
// a template builder can replace this later without touching submissions
// (data is jsonb keyed by field key).

export type FormFieldType = "text" | "textarea" | "number" | "date";

export interface FormField {
  key: string;
  label: string;
  type: FormFieldType;
  required?: boolean;
  placeholder?: string;
}

export const FORM_TYPES = [
  "quotation",
  "technical_rider",
  "logistics_manifest",
  "crew_list",
] as const;

export type FormType = (typeof FORM_TYPES)[number];

export const FORM_DEFINITIONS: Record<
  FormType,
  { title: string; description: string; fields: FormField[] }
> = {
  quotation: {
    title: "Vendor quotation",
    description: "Your offer for the requested goods/services.",
    fields: [
      { key: "vendor_name", label: "Vendor / company name", type: "text", required: true },
      { key: "scope", label: "Scope of work / items", type: "textarea", required: true, placeholder: "One item per line with quantity" },
      { key: "amount_idr", label: "Total amount (IDR)", type: "number", required: true },
      { key: "valid_until", label: "Quote valid until", type: "date", required: true },
      { key: "payment_terms", label: "Payment terms", type: "text" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
  },
  technical_rider: {
    title: "Technical rider",
    description: "Technical requirements for the performance.",
    fields: [
      { key: "artist_name", label: "Artist / act", type: "text", required: true },
      { key: "equipment", label: "Equipment list", type: "textarea", required: true, placeholder: "PA, monitors, backline…" },
      { key: "stage_requirements", label: "Stage requirements", type: "textarea", required: true },
      { key: "power", label: "Power requirements", type: "text" },
      { key: "soundcheck", label: "Soundcheck needs", type: "text" },
      { key: "notes", label: "Additional notes", type: "textarea" },
    ],
  },
  logistics_manifest: {
    title: "Logistics manifest",
    description: "Freight and equipment movement details.",
    fields: [
      { key: "carrier", label: "Carrier / freight company", type: "text", required: true },
      { key: "items", label: "Manifest items", type: "textarea", required: true, placeholder: "Item · qty · weight · dimensions, one per line" },
      { key: "arrival_date", label: "Arrival date", type: "date", required: true },
      { key: "origin", label: "Origin", type: "text" },
      { key: "customs_notes", label: "Customs / documentation notes", type: "textarea" },
    ],
  },
  crew_list: {
    title: "Crew / guest list",
    description: "People who need accreditation.",
    fields: [
      { key: "company", label: "Company / group", type: "text", required: true },
      { key: "people", label: "Names & roles", type: "textarea", required: true, placeholder: "Full name — role, one per line" },
      { key: "headcount", label: "Total headcount", type: "number", required: true },
      { key: "arrival_date", label: "On-site date", type: "date" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
  },
};

export function validateSubmission(
  type: FormType,
  data: Record<string, unknown>,
): string[] {
  const problems: string[] = [];
  for (const field of FORM_DEFINITIONS[type].fields) {
    const value = data[field.key];
    if (field.required && (value === undefined || value === null || value === "")) {
      problems.push(`${field.label} is required.`);
    }
    if (field.type === "number" && value !== undefined && value !== "" && Number.isNaN(Number(value))) {
      problems.push(`${field.label} must be a number.`);
    }
  }
  return problems;
}
