export function getBearerToken(authHeader: string | null) {
  if (!authHeader) return "";
  return authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : authHeader.trim();
}

function getJwtRole(token: string) {
  const payload = token.split(".")[1];
  if (!payload) return null;

  try {
    const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = normalizedPayload.padEnd(Math.ceil(normalizedPayload.length / 4) * 4, "=");
    const decodedPayload = JSON.parse(atob(paddedPayload)) as { role?: unknown };
    return typeof decodedPayload.role === "string" ? decodedPayload.role : null;
  } catch {
    return null;
  }
}

export function shouldResolveUserFromAuthToken(authToken: string, configuredAnonKey: string) {
  if (!authToken) return false;
  if (configuredAnonKey && authToken === configuredAnonKey) return false;

  const role = getJwtRole(authToken);
  return role !== "anon" && role !== "service_role";
}
