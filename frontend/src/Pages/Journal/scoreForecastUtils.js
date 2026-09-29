// Pure helpers for ScoreForecastPage, kept in their own module (not
// ScoreForecastPage.jsx itself) so that file can stay component-only -
// mixing a named function export into a component file breaks React Fast
// Refresh (react-refresh/only-export-components).

export function clamp100(value) {
  return Math.max(0, Math.min(100, value));
}
