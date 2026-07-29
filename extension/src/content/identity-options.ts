import type { IdentityFillMode, IdentitySummary } from "../lib/types";

export function identitiesForFillMode(
  identities: IdentitySummary[],
  mode: IdentityFillMode,
): IdentitySummary[] {
  if (mode === "identity") {
    return identities.filter((identity) => identity.email.trim());
  }

  const seen = new Set<string>();
  return identities.filter((identity) => {
    const email = identity.email.trim().toLocaleLowerCase();
    if (!email || seen.has(email)) return false;
    seen.add(email);
    return true;
  });
}
