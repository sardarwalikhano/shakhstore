export const PRODUCT_CATEGORIES = [
  "food",
  "grocery",
  "produce",
  "meat_seafood",
  "drinks",
  "household",
  "other",
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const MERCHANT_PRODUCT_CATEGORY: Readonly<Record<string, ProductCategory>> = {
  restaurant: "food",
  supermarket: "grocery",
  produce_vendor: "produce",
  meat_seafood_vendor: "meat_seafood",
};

export function allowedProductCategoriesForRole(role: string): ProductCategory[] {
  const merchantCategory = MERCHANT_PRODUCT_CATEGORY[role];
  if (merchantCategory) return [merchantCategory];
  if (role === "admin" || role === "super_admin") return [...PRODUCT_CATEGORIES];
  return [];
}

export function productCategoryForRole(role: string): ProductCategory | null {
  return MERCHANT_PRODUCT_CATEGORY[role] ?? null;
}
