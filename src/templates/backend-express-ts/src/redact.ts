/**
 * Enmascara credenciales y datos sensibles en URLs, cabeceras o cadenas de texto.
 */
export function redact(text: string): string {
  if (typeof text !== "string") {
    return "";
  }

  let result = text;

  // 1. URLs con credenciales
  // El límite {0,63} es un límite interno defensivo para acotar el retroceso, no una exigencia de RFC 3986 ni RFC 1035.
  if (result.includes("://")) {
    result = result.replace(/([a-zA-Z][a-zA-Z0-9+.-]{0,63}:\/\/)[^/\s?#]+@/g, "$1***:***@");
  }

  // 2. Cabeceras de autorización (Authorization, Proxy-Authorization)
  result = result.replace(
    /((?:\b|['"])(?:authorization|proxy-authorization)(?:['"]?)\s*[:=]\s*(['"]?))(?:(bearer|basic)\s+)?([^\r\n'",`;]+)/gi,
    (_match, prefix, _quote, scheme) => {
      return `${prefix}${scheme ? `${scheme} ` : ""}***`;
    },
  );

  // 3. Tokens Bearer independientes
  result = result.replace(/(\bBearer\s+)[^\s'",`;]+/gi, "$1***");

  // 4. Cookies y Set-Cookie
  result = result.replace(
    /((?:\b|['"])(?:cookie|set-cookie)(?:['"]?)\s*[:=]\s*)(\[[^\]]*\]|(['"])[^\r\n'"\]]+\3|[^\r\n]+)/gi,
    (_m, prefix, val, quote) => {
      if (val.startsWith("[")) {
        return `${prefix}[ '***' ]`;
      }
      if (quote) {
        return `${prefix}${quote}***${quote}`;
      }
      return `${prefix}***`;
    },
  );

  // 5. Credenciales y secretos (password, tokens, secret)
  // 5a. Valores entrecomillados (comillas simples, dobles o backticks de inspect())
  result = result.replace(
    /((?:(?:\b|['"`])(?:password|access_?token|refresh_?token|auth_?token|token|(?:[a-z0-9_-]*_)?secret)(?:['"`]?))\s*[:=]\s*)(?:'((?:[^'\\\r\n]|\\.)*)'|"((?:[^"\\\r\n]|\\.)*)"|`((?:[^`\\\r\n]|\\.)*)`)/gi,
    (_match, prefix, sVal, dVal) => {
      if (sVal !== undefined) return `${prefix}'***'`;
      if (dVal !== undefined) return `${prefix}"***"`;
      return `${prefix}\`***\``;
    },
  );
  // 5b. Valores sin entrecomillar
  result = result.replace(
    /((?:(?:\b|['"`])(?:password|access_?token|refresh_?token|auth_?token|token|(?:[a-z0-9_-]*_)?secret)(?:['"`]?))\s*[:=]\s*)(?!['"`])([^&\s'",`};\]\r\n]+)/gi,
    "$1***",
  );

  return result;
}
