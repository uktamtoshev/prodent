/**
 * Extract error message from edge function response or error object.
 * Edge functions now return 200 with { success: false, error: "message" } for business errors.
 */
export function getErrorMessage(data: unknown, fallback = "Ошибка сервера"): string {
  if (!data || typeof data !== "object") return fallback;
  const record = data as Record<string, unknown>;
  
  // Check for error property in data
  if (typeof record.error === "string") {
    return record.error;
  }
  
  // Check for message property
  if (typeof record.message === "string") {
    return record.message;
  }
  
  return fallback;
}

/**
 * Legacy function for backwards compatibility - extracts error from FunctionsHttpError.
 * @deprecated Use getErrorMessage with data response instead
 */
export async function getEdgeFunctionErrorMessage(err: unknown): Promise<string> {
  // Direct string error
  if (typeof err === "string") return err;
  
  // Check for error property directly
  if (!err || typeof err !== "object") return "Ошибка сервера";
  const record = err as Record<string, unknown>;
  if (typeof record.error === "string") return record.error;
  
  // Fallback to message
  return typeof record.message === "string" ? record.message : "Ошибка сервера";
}
