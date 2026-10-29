/** Merges a page into a list, dropping items whose `id` is already present (offset pagination can repeat rows). */
export const appendUnique = <T extends { id?: string | number }>(
  prev: T[],
  next: T[],
): T[] => {
  const seen = new Set(prev.map((i) => i.id));
  return [...prev, ...next.filter((i) => !seen.has(i.id))];
};

/** Removes duplicate ids from a single list, keeping the first occurrence. */
export const dedupeById = <T extends { id?: string | number }>(list: T[]): T[] => {
  const seen = new Set<string | number | undefined>();
  return list.filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)));
};
