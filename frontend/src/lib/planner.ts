export const BLEND_IDS = ["orange_apple", "apple_pineapple", "tropical"] as const;
export const INGREDIENT_IDS = ["orange", "apple", "pineapple"] as const;

export type BlendId = (typeof BLEND_IDS)[number];
export type IngredientId = (typeof INGREDIENT_IDS)[number];
export type BlendInput = {
  id: BlendId;
  recipe_percent: Record<IngredientId, string>;
  profit_aud_per_litre: string;
  processing_minutes_per_litre: string;
  min_litres: string;
  max_litres: string;
};
export type PlanningInputs = {
  blends: BlendInput[];
  available_ingredient_litres: Record<IngredientId, string>;
  processing_capacity_hours: string;
};

export const BLEND_LABELS: Record<BlendId, string> = {
  orange_apple: "Orange + apple",
  apple_pineapple: "Apple + pineapple",
  tropical: "Tropical",
};

export const INGREDIENT_LABELS: Record<IngredientId, string> = {
  orange: "Orange",
  apple: "Apple",
  pineapple: "Pineapple",
};

export const SAMPLE_INPUTS: PlanningInputs = {
  blends: [
    { id: "orange_apple", recipe_percent: { orange: "60", apple: "40", pineapple: "0" }, profit_aud_per_litre: "2.00", processing_minutes_per_litre: "2", min_litres: "0", max_litres: "60" },
    { id: "apple_pineapple", recipe_percent: { orange: "0", apple: "50", pineapple: "50" }, profit_aud_per_litre: "1.80", processing_minutes_per_litre: "2", min_litres: "0", max_litres: "60" },
    { id: "tropical", recipe_percent: { orange: "30", apple: "30", pineapple: "40" }, profit_aud_per_litre: "2.50", processing_minutes_per_litre: "3", min_litres: "0", max_litres: "60" },
  ],
  available_ingredient_litres: { orange: "40", apple: "40", pineapple: "30" },
  processing_capacity_hours: "4",
};

export const BLEND_RECIPE_RULES: Partial<Record<BlendId, IngredientId>> = {
  orange_apple: "pineapple",
  apple_pineapple: "orange",
};

