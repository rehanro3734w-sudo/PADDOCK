// ---- Data sources ----
// Jolpica-F1 (Ergast successor): schedule + standings. Fully free, no key.
// OpenF1: session/meeting metadata + results. Free once a session has ended;
// second-by-second live gaps are a paid OpenF1 feature, so we don't fake it.

const JOLPICA_BASE = 'https://api.jolpi.ca/ergast/f1';
const OPENF1_BASE = 'https://api.openf1.org/v1';

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed (${res.status}): ${url}`);
  return res.json();
}

// ----- Jolpica-F1 -----

async function getSchedule() {
  const data = await fetchJSON(`${JOLPICA_BASE}/current.json`);
  return data.MRData.RaceTable.Races;
}

async function getDriverStandings() {
  const data = await fetchJSON(`${JOLPICA_BASE}/current/driverStandings.json`);
  const lists = data.MRData.StandingsTable.StandingsLists;
  return lists.length ? lists[0].DriverStandings : [];
}

async function getConstructorStandings() {
  const data = await fetchJSON(`${JOLPICA_BASE}/current/constructorStandings.json`);
  const lists = data.MRData.StandingsTable.StandingsLists;
  return lists.length ? lists[0].ConstructorStandings : [];
}

// ----- OpenF1 -----

async function getSeasonSessions(year) {
  return fetchJSON(`${OPENF1_BASE}/sessions?year=${year}`);
}

async function getMeetingInfo(meetingKey) {
  const data = await fetchJSON(`${OPENF1_BASE}/meetings?meeting_key=${meetingKey}`);
  return data[0] || null;
}

async function getSessionResult(sessionKey) {
  return fetchJSON(`${OPENF1_BASE}/session_result?session_key=${sessionKey}`);
}

async function getSessionDrivers(sessionKey) {
  return fetchJSON(`${OPENF1_BASE}/drivers?session_key=${sessionKey}`);
}
