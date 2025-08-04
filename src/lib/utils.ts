import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatCurrency = (
  value: number | undefined | null,
  isPercentage = false,
  defaultValue = "-",
  currency = "EUR"
): string => {
  if (value === undefined || value === null) return defaultValue;

  if (isPercentage) {
    return `${value.toFixed(2)}%`;
  }

  const absValue = Math.abs(value);
  const formatted = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(absValue);

  return formatted;
};
