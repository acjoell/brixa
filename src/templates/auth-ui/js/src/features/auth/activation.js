export function readActivationToken(hash) {
  const [token, duplicate] = new globalThis.URLSearchParams(hash.slice(1)).getAll("token");
  // The last sextet of an unpadded 32-byte base64url value has two zero bits.
  return duplicate === undefined &&
    token?.length === 43 &&
    /^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/.test(token)
    ? token
    : null;
}

export function isActivationPasswordValid(value, policy) {
  // This UTF-16 check bounds processing. The policy counts Unicode code points.
  if (value.length > policy.maxLength * 2 || /\p{Surrogate}/u.test(value)) return false;
  const length = [...value].length;
  return (
    length >= policy.minLength &&
    length <= policy.maxLength &&
    new globalThis.TextEncoder().encode(value).length <= policy.maxBytes
  );
}

export function activationRetryAt(value, now = Date.now()) {
  if (!value) return undefined;
  const at = /^\d+$/.test(value) ? now + Number(value) * 1000 : Date.parse(value);
  return Number.isSafeInteger(at) && at > now ? at : undefined;
}
