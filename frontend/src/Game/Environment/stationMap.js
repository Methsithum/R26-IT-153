import { pickVariantIndex } from "../MiniGames/variant";

export const STATIONS = {
  calendar: { interact: [-11.0, -5.4], label: "Notice board" },
  slider: { interact: [0, -10.3], label: "Grade board" },
  dartboard: { interact: [11.0, -5.4], label: "Results board" },
  examSort: { interact: [-7.2, 5.0], label: "Exam schedule" },
  abacus: { interact: [-6.8, 0.6], label: "Deadline desk" },
  scale: { interact: [6.8, 0.6], label: "Performance desk" },
};

export function stationKeyFor(question) {
  const type = question?.interactionType;
  if (type === "date") return "abacus";
  if (type === "examDate" || type === "examSetup") return "examSort";
  if (type === "subjectPick") return "calendar";
  if (type === "markTarget") return "dartboard";
  if (type === "marks") {
    const id =
      question?.context?.assignmentId ||
      question?.context?.missingExams?.[0]?.id ||
      question?.id ||
      "marks";
    return ["slider", "dartboard", "scale"][pickVariantIndex(String(id), 3)];
  }
  return "calendar";
}

export function missionLocalOffset(question) {
  const st = STATIONS[stationKeyFor(question)] || STATIONS.calendar;
  return [st.interact[0], 0, st.interact[1]];
}

export function missionLabel(question) {
  const st = STATIONS[stationKeyFor(question)] || STATIONS.calendar;
  return st.label;
}
