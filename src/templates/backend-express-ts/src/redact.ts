/**
 * Enmascara credenciales y tokens sensibles en URLs o cadenas de texto.
 */
export function redact(text: string): string {
  if (typeof text !== "string") {
    return "";
  }
  return text
    .replace(/([a-zA-Z][a-zA-Z0-9+.-]*:\/\/)[^/\s?#]+@/g, "$1***:***@")
    .replace(/(\b(?:authToken|token)=)[^&\s'"`]+/gi, "$1***");
}
