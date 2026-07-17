import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes — same API as agents-kit `cn`. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
