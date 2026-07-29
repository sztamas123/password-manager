import { type DecryptedEntry, isIdentityData } from "../lib/types";

export function filterEntries(
  entries: DecryptedEntry[],
  query: string,
  folderId: string | null,
): DecryptedEntry[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  return entries.filter((entry) => {
    if (folderId && entry.folderId !== folderId) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    const values = isIdentityData(entry.data)
      ? [
          entry.data.name,
          entry.data.firstName,
          entry.data.lastName,
          entry.data.email,
          entry.data.phone,
          entry.data.country,
          entry.data.addressLine1,
          entry.data.addressLine2,
          entry.data.region,
          entry.data.city,
          entry.data.postalCode,
          entry.data.notes,
        ]
      : [
          entry.data.name,
          entry.data.username,
          entry.data.url,
          entry.data.notes,
        ];

    return values.some((value) =>
      value.toLocaleLowerCase().includes(normalizedQuery),
    );
  });
}
