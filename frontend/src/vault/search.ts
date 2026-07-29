import type { DecryptedEntry } from "../lib/types";

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

    return [
      entry.data.name,
      entry.data.username,
      entry.data.url,
      entry.data.notes,
    ].some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
  });
}
