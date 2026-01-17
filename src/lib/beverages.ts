// Shared beverage types and hydration weighting factors
// Factors are approximate "retention" multipliers vs plain water (1.0).
// Sources: beverage hydration index literature (e.g., Maughan et al., 2016) and
// general physiology for caffeine/alcohol diuresis. These are conservative, user-tunable.

export type BeverageType =
  | "water"
  | "electrolyte"
  | "milk"
  | "coffee"
  | "beer"
  | "wine"
  | "cocktail"
  | "soda"
  | "juice"
  | "other";

// Default factors; keep within [0, 2].
const DEFAULT_FACTORS: Record<BeverageType, number> = {
  water: 1.0,
  electrolyte: 1.15, // sodium/glucose improves retention
  milk: 1.5, // high BHI due to electrolytes + slower emptying
  coffee: 0.95, // moderate caffeine slightly reduces net retention
  beer: 0.7, // alcohol promotes diuresis; typical 4–5%
  wine: 0.6, // higher ABV → stronger diuresis
  cocktail: 0.5, // mixed spirits ~10–20% ABV
  soda: 0.9, // often caffeinated; modest reduction
  juice: 1.1, // carbs + electrolytes modestly improve retention
  other: 1.0,
};

export function hydrationFactor(type: BeverageType | string | undefined): number {
  const key = (String(type || "other").toLowerCase() as BeverageType) || "other";
  return DEFAULT_FACTORS[key] ?? 1.0;
}

