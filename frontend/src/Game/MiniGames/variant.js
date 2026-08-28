// Deterministic pick of a mini-game "skin" index from an id (assignment id,
// exam id, etc). Same id always yields the same index, so a given
// assignment's mark-entry mini-game doesn't change skin between visits,
// while different assignments/exams naturally spread across all skins.
// Returns an index (not a component reference) so callers can switch on it
// with literal JSX tags — React components must stay static across renders.
export function pickVariantIndex(id, variantCount) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % variantCount;
}
