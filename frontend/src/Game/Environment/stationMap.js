import { pickVariantIndex } from "../MiniGames/variant";

const PI = Math.PI;

function wallLeft(z, y = 2.18) {
  return { position: [-13.58, y, z], rotationY: PI / 2, interact: [-11.0, z] };
}

function wallRight(z, y = 2.22) {
  return { position: [13.52, y, z], rotationY: -PI / 2, interact: [11.0, z] };
}

function wallBack(x, y = 2.2) {
  return { position: [x, y, -12.72], rotationY: 0, interact: [x, -10.35] };
}

function desk(x, z, interactZ = z + 1.4, rotationY = 0) {
  return { position: [x, 0, z], rotationY, interact: [x, interactZ] };
}

// Per-building interactable props. Same toy (dartboard, abacus, …) can appear
// in more than one room, but never in the same corner — and subject toys
// (shelf / tickets) only exist in the building that owns them.
export const STATIONS_BY_BUILDING = {
  library: {
    shelf: { ...desk(6.4, 3.6, 5.3), label: "Subject shelf" },
    abacus: { ...desk(-6.6, -1.4, 0.15), label: "Deadline desk" },
    calendar: { ...wallLeft(-8.2), label: "Notice board" },
  },
  "lecture-hall": {
    tickets: { ...desk(0, -8.55, -7.05), label: "Attendance board" },
  },
  "exam-hall": {
    examSort: { ...desk(0, 4.2, 5.65), label: "Exam schedule" },
    shelf: { ...desk(6.4, -6.2, -4.8), label: "Exam subject shelf" },
    abacus: { ...desk(-8.0, 4.2, 5.65), label: "Deadline desk" },
    calendar: { ...wallBack(0), label: "Notice board" },
    dartboard: { ...wallRight(-2.2, 2.28), label: "Results board" },
    slider: { ...wallLeft(-2.2), label: "Grade board" },
  },
  "faculty-science": {
    dartboard: { ...wallBack(0, 2.28), label: "Results board" },
    scale: { ...desk(7.8, 2.4, 3.95), label: "Performance desk" },
    slider: { ...wallLeft(-3.4), label: "Grade board" },
  },
  "faculty-arts": {
    dartboard: { ...wallRight(3.1, 2.28), label: "Results board" },
    scale: { ...desk(-4.4, 1.2, 2.75), label: "Performance desk" },
    slider: { ...wallLeft(-8.6), label: "Grade board" },
  },
};

export const STATIONS = STATIONS_BY_BUILDING.library;

const MARK_KEYS = ["slider", "dartboard", "scale"];

export function layoutFor(buildingId) {
  return STATIONS_BY_BUILDING[buildingId] || STATIONS_BY_BUILDING.library;
}

export function stationKeyFor(question, buildingId) {
  const layout = layoutFor(buildingId);
  const type = question?.interactionType;
  const field = question?.context?.field;
  let key = "calendar";

  if (type === "date") key = "abacus";
  else if (type === "examDate") key = "examSort";
  else if (type === "examSetup") key = layout.shelf ? "shelf" : "examSort";
  else if (type === "subjectPick") {
    key =
      buildingId === "lecture-hall" || field === "lectureSubjects" ? "tickets" : "shelf";
  } else if (type === "markTarget") {
    key = layout.dartboard ? "dartboard" : MARK_KEYS.find((k) => layout[k]) || "dartboard";
  } else if (type === "marks") {
    const examMark = field === "examMark" || field === "exam-mark-check";
    if (examMark && layout.dartboard) {
      key = "dartboard";
    } else {
      const available = MARK_KEYS.filter((k) => layout[k]);
      const id =
        question?.context?.assignmentId ||
        question?.context?.missingExams?.[0]?.id ||
        question?.id ||
        "marks";
      key = available.length
        ? available[pickVariantIndex(String(id), available.length)]
        : "slider";
    }
  }

  if (layout[key]) return key;
  return Object.keys(layout)[0] || "calendar";
}

export function getStation(question, buildingId) {
  const layout = layoutFor(buildingId);
  const key = stationKeyFor(question, buildingId);
  return layout[key] || Object.values(layout)[0] || STATIONS.shelf;
}

export function missionLocalOffset(question, buildingId) {
  const st = getStation(question, buildingId);
  return [st.interact[0], 0, st.interact[1]];
}

export function missionLabel(question, buildingId) {
  return getStation(question, buildingId).label || "desk";
}
