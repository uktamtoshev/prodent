/**
 * Extract error message from edge function response or error object.
 * Edge functions now return 200 with { success: false, error: "message" } for business errors.
 */
export function getErrorMessage(data: any, fallback = "Ошибка сервера"): string {
  if (!data) return fallback;
  
  // Check for error property in data
  if (data.error && typeof data.error === "string") {
    return data.error;
  }
  
  // Check for message property
  if (data.message && typeof data.message === "string") {
    return data.message;
  }
  
  return fallback;
}

/**
 * Legacy function for backwards compatibility - extracts error from FunctionsHttpError.
 * @deprecated Use getErrorMessage with data response instead
 */
export async function getEdgeFunctionErrorMessage(err: any): Promise<string> {
  // Direct string error
  if (typeof err === "string") return err;
  
  // Check for error property directly
  if (err?.error && typeof err.error === "string") return err.error;
  
  // Fallback to message
  return err?.message || "Ошибка сервера";
}
