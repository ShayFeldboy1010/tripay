export const CANONICAL_CATEGORIES = {
  Accommodation: [
    "hotel",
    "hotels",
    "accommodation",
    "stay",
    "room",
    "sleep",
    "מלון",
    "מלונות",
    "לינה",
  ],
  Transportation: [
    "transport",
    "transportation",
    "bus",
    "train",
    "subway",
    "taxi",
    "uber",
    "grab",
    "flight",
    "flights",
    "תחבורה",
    "אוטובוס",
    "רכבת",
    "מטרו",
    "מונית",
    "טיסה",
    "טיסות",
  ],
  Food: [
    "food",
    "eat",
    "meal",
    "restaurant",
    "breakfast",
    "lunch",
    "dinner",
    "coffee",
    "cafe",
    "אוכל",
    "מסעדה",
    "ארוחה",
    "בוקר",
    "צהריים",
    "ערב",
    "קפה",
    "קפה/בית קפה",
  ],
  Other: ["other", "misc", "etc", "אחר"],
} as const;

const synonymMap: Record<string, string> = {};
for (const [cat, tokens] of Object.entries(CANONICAL_CATEGORIES)) {
  for (const token of tokens) {
    synonymMap[token.toLowerCase()] = cat;
  }
  synonymMap[cat.toLowerCase()] = cat;
}

export function normalizeCategory(input: string): string | null {
  const key = input.toLowerCase();
  return synonymMap[key] || null;
}

export function resolveCategoryTokens(text: string): string[] {
  const found = new Set<string>();
  const lower = text.toLowerCase();
  for (const [cat, tokens] of Object.entries(CANONICAL_CATEGORIES)) {
    for (const token of tokens) {
      if (lower.includes(token.toLowerCase())) {
        found.add(cat);
        break;
      }
    }
  }
  return Array.from(found);
}
