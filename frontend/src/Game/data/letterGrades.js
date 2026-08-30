export const LETTER_GRADES = [
  { id: "A+", fail: false, bead: "#d4a017", glass: "#f6e7c3" },
  { id: "A", fail: false, bead: "#c9a36a", glass: "#f3e6c8" },
  { id: "A-", fail: false, bead: "#b08950", glass: "#efe0c4" },
  { id: "B+", fail: false, bead: "#a67c4e", glass: "#eadcc0" },
  { id: "B", fail: false, bead: "#8b5a2b", glass: "#e6d4b8" },
  { id: "B-", fail: false, bead: "#7a4d28", glass: "#e2cdb0" },
  { id: "C+", fail: false, bead: "#6b5344", glass: "#ddd0c4" },
  { id: "C", fail: false, bead: "#5c3a1e", glass: "#d9cbb8" },
  { id: "C-", fail: true, bead: "#9a2f2f", glass: "#edd5d0" },
  { id: "D+", fail: true, bead: "#7a1f1f", glass: "#e8cdc8" },
  { id: "D", fail: true, bead: "#5c1414", glass: "#e0c4c0" },
];

export const FAIL_LETTER_GRADES = new Set(
  LETTER_GRADES.filter((grade) => grade.fail).map((grade) => grade.id)
);

export function isLetterGrade(value) {
  return /^[A-D][+-]?$/i.test(String(value || "").trim());
}

export function formatExamMark(mark) {
  if (mark == null || mark === "") return "";
  const text = String(mark).trim();
  if (isLetterGrade(text)) return text.toUpperCase();
  const numeric = Number(text);
  if (Number.isFinite(numeric)) return `${numeric}%`;
  return text;
}
