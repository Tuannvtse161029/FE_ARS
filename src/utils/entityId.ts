/**
 * Shared entity ID validation utilities.
 * Ensures positive integer IDs are used for API calls, preventing NaN/undefined
 * from reaching Axios service layer.
 */

/**
 * Type guard to validate that a value is a safe positive integer.
 * Returns false for: NaN, Infinity, 0, negative numbers, strings, null, undefined.
 */
export function isValidEntityId(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value > 0
  );
}

/**
 * Safely converts a value to a valid entity ID or null.
 * Returns null for invalid inputs instead of NaN.
 */
export function toEntityId(value: unknown): number | null {
  if (isValidEntityId(value)) return value;
  return null;
}

/**
 * Converts a string (e.g. from select element value) to a valid entity ID or null.
 * Empty string maps to null (placeholder selection).
 */
export function parseEntityId(value: string): number | null {
  if (value === '') return null;
  const parsed = Number(value);
  return isValidEntityId(parsed) ? parsed : null;
}
