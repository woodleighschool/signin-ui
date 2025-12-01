import { format, isValid, parseISO } from "date-fns";

// Format date/time for display
export function formatDateTime(input: string | undefined): string {
  if (!input) {
    return "Never";
  }

  try {
    const date = parseISO(input);
    if (!isValid(date)) {
      return "Invalid date";
    }

    return format(date, "PPpp"); // Example: Nov 6, 2025 at 2:30 PM
  } catch {
    return "Invalid date";
  }
}
