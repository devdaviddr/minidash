/**
 * Orders numbers highest first, with null and undefined (unknown values) always last,
 * whatever their position. Used by the GPU column, where an older agent or a failed read
 * gives no value (FR-32).
 */
export function descNullsLast(a: number | null | undefined, b: number | null | undefined): number {
  const aKnown = a !== null && a !== undefined
  const bKnown = b !== null && b !== undefined
  if (!aKnown || !bKnown) return Number(!aKnown) - Number(!bKnown)
  return b - a
}
