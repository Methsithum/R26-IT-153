/** Pad LLM/static options to exactly 4 lanes. */
export function padOptions(options = []) {
  const padded = [...options].slice(0, 4);
  while (padded.length < 4) {
    padded.push('Other');
  }
  return padded;
}

/** Build a gate object for the 3D scene. */
export function buildGate({ id, z, question, options, question_type = 'lane', question_id }) {
  return {
    id: id || `gate-${z}`,
    z,
    question,
    options: question_type === 'lane' ? padOptions(options) : options,
    question_type,
    question_id,
  };
}

/** Schedule next adaptive gate ahead of the player. */
export function scheduleGateAhead(playerZ, question, options, question_type = 'lane', question_id) {
  return buildGate({
    id: question_id || `q-${Date.now()}`,
    z: playerZ - 55,
    question,
    options,
    question_type,
    question_id,
  });
}

/** Initial static gates for a map (demo fallback). */
export function buildStaticGates(mapId, generateMissionGates) {
  return generateMissionGates(mapId).map((g) => ({
    ...g,
    options: padOptions(g.options),
    question_type: 'lane',
  }));
}
