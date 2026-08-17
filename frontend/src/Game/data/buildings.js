// Static configuration for every building on campus.
// Positions are world-space [x, y, z] targets along the endless road (z grows as the player runs).
// `interactionTypes` lists which special-interaction kinds this building can host.

export const BUILDINGS = [
  {
    id: "library",
    name: "University Library",
    shortName: "Library",
    laneSide: "right",
    type: "academic",
    color: "#c9a26a",
    interactionTypes: ["date", "academic", "subjectPick"],
    description: "Deadlines, schedules and reference records are handled here.",
  },
  {
    id: "faculty-science",
    name: "Faculty of Science",
    shortName: "Fac. of Science",
    laneSide: "right",
    type: "faculty",
    color: "#8fa6c9",
    interactionTypes: ["marks", "academic"],
    description: "Subject marks and science-related academic records.",
  },
  {
    id: "faculty-arts",
    name: "Faculty of Arts",
    shortName: "Fac. of Arts",
    laneSide: "left",
    type: "faculty",
    color: "#c98f8f",
    interactionTypes: ["marks", "academic"],
    description: "Arts faculty coursework and mark records.",
  },
  {
    id: "exam-hall",
    name: "Examination Hall",
    shortName: "Exam Hall",
    laneSide: "left",
    type: "examination",
    color: "#b48fc9",
    interactionTypes: ["date", "marks", "examDate", "examSetup"],
    description: "Examination dates and results.",
  },
  {
    id: "lecture-hall",
    name: "Main Lecture Hall",
    shortName: "Lecture Hall",
    laneSide: "right",
    type: "academic",
    color: "#8fc9a6",
    interactionTypes: ["academic", "subjectPick"],
    description: "Lecture attendance and schedule records.",
  },
  {
    id: "cafeteria",
    name: "Campus Cafeteria",
    shortName: "Cafeteria",
    laneSide: "left",
    type: "social",
    color: "#e0b45c",
    interactionTypes: [],
    description: "Just a landmark — no interactions happen here yet.",
  },
];

export function getBuildingById(id) {
  return BUILDINGS.find((b) => b.id === id) ?? null;
}

// Given an interaction type, find the best-matching building.
export function getBuildingForInteraction(interactionType) {
  return (
    BUILDINGS.find((b) => b.interactionTypes.includes(interactionType)) ??
    BUILDINGS.find((b) => b.id === "library")
  );
}

// Subject-aware routing for mark-entry interactions, so different subjects
// naturally surface different faculty buildings (and therefore different
// mini-game skins — see MiniGames/pickVariant).
const SCIENCE_SUBJECTS = ["Databases", "Operating Systems", "Web Development", "Mathematics"];

export function getFacultyForSubject(subject) {
  return SCIENCE_SUBJECTS.includes(subject) ? "faculty-science" : "faculty-arts";
}
