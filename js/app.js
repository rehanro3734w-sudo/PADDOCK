// ---------- Tab switching ----------

const tabButtons = document.querySelectorAll('.tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');
const loaded = { live: false, schedule: false, results: false, grid: false, standings: false };

tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    tabButtons.forEach(b => b.classList.remove('active'));
    tabPanels.forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    loadTab(btn.dataset.tab);
  });
});

function loadTab(tab) {
  if (loaded[tab]) return;
  loaded[tab] = true;
  if (tab === 'live') loadLive();
  if (tab === 'schedule') loadSchedule();
  if (tab === 'results') loadResults();
  if (tab === 'grid') loadGrid();
  if (tab === 'standings') loadStandings('drivers');
}

// ---------- Helpers ----------

function fmtLocal(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function fmtGap(gap) {
  if (gap === null || gap === undefined) return '—';
  if (typeof gap === 'string') return gap;
  if (gap === 0) return 'LEADER';
  return `+${gap.toFixed(3)}s`;
}

function startCountdown(el, targetDate) {
  function tick() {
    const diff = new Date(targetDate) - new Date();
    if (diff <= 0) { el.textContent = 'Starting…'; clearInterval(timer); return; }
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    el.textContent = `${d}d ${h}h ${m}m ${s}s`;
  }
  tick();
  const timer = setInterval(tick, 1000);
}

// ---------- LIVE tab ----------

async function loadLive() {
  const el = document.getElementById('live-content');
  try {
    const year = new Date().getUTCFullYear();
    const sessions = await getSeasonSessions(year);
    const now = new Date();

    const current = sessions.find(s => new Date(s.date_start) <= now && now <= new Date(s.date_end));
    if (current) return renderLiveSession(el, current);

    const upcoming = sessions
      .filter(s => new Date(s.date_start) > now)
      .sort((a, b) => new Date(a.date_start) - new Date(b.date_start))[0];
    if (upcoming) return renderUpcomingSession(el, upcoming);

    const past = sessions
      .filter(s => new Date(s.date_end) < now)
      .sort((a, b) => new Date(b.date_end) - new Date(a.date_end))[0];
    if (past) return renderPastSession(el, past);

    el.innerHTML = `<div class="empty">No session data for ${year} yet.</div>`;
  } catch (e) {
    el.innerHTML = `<div class="error">Couldn't reach live data. ${e.message}</div>`;
  }
}

function renderLiveSession(el, session) {
  el.innerHTML = `
    <div class="status-card">
      <span class="live-badge">LIVE NOW</span>
      <h2>${session.session_name}</h2>
      <div class="meta">${session.circuit_short_name}, ${session.country_name}</div>
      <div class="note">Second-by-second gaps are an OpenF1 paid feature — full results land here
      the moment the session ends.</div>
    </div>
  `;
}

function renderUpcomingSession(el, session) {
  el.innerHTML = `
    <div class="status-card upcoming">
      <h2>Next: ${session.session_name}</h2>
      <div class="meta">${session.circuit_short_name}, ${session.country_name} — ${fmtLocal(session.date_start)} (your local time)</div>
      <div class="countdown" id="live-countdown"></div>
    </div>
  `;
  startCountdown(document.getElementById('live-countdown'), session.date_start);
}

async function renderPastSession(el, session) {
  el.innerHTML = `<div class="loading">Loading ${session.session_name} results…</div>`;
  try {
    const [results, drivers] = await Promise.all([
      getSessionResult(session.session_key),
      getSessionDrivers(session.session_key)
    ]);
    if (!results.length) {
      el.innerHTML = `
        <div class="status-card done">
          <h2>${session.session_name} — finished</h2>
          <div class="meta">${session.circuit_short_name}, ${session.country_name}</div>
          <div class="note">Results aren't published yet — check back shortly.</div>
        </div>`;
      return;
    }
    const driverMap = Object.fromEntries(drivers.map(d => [d.driver_number, d]));
    results.sort((a, b) => a.position - b.position);

    const rows = results.map(r => {
      const d = driverMap[r.driver_number] || {};
      const color = d.team_colour ? `#${d.team_colour}` : '#555';
      const status = r.dsq ? 'DSQ' : r.dnf ? 'DNF' : r.dns ? 'DNS' : '';
      return `
        <div class="tower-row">
          <div class="pos">${status || r.position}</div>
          <div class="teamcolor" style="background:${color}"></div>
          <div class="driver">${d.full_name || 'Driver #' + r.driver_number}
            <span class="team">${d.team_name || ''}</span>
          </div>
          <div class="gap">${fmtGap(r.gap_to_leader)}</div>
        </div>`;
    }).join('');

    el.innerHTML = `
      <div class="status-card done">
        <h2>${session.session_name} — finished</h2>
        <div class="meta">${session.circuit_short_name}, ${session.country_name} · ${fmtLocal(session.date_end)}</div>
      </div>
      <div class="tower">${rows}</div>
    `;
  } catch (e) {
    el.innerHTML = `<div class="error">Couldn't load results. ${e.message}</div>`;
  }
}

// ---------- SCHEDULE tab ----------

async function loadSchedule() {
  const el = document.getElementById('schedule-content');
  try {
    const races = await getSchedule();
    const now = new Date();
    const nextRound = races.find(r => new Date(`${r.date}T${r.time || '00:00:00Z'}`) > now);

    el.innerHTML = races.map(r => {
      const dt = new Date(`${r.date}T${r.time || '00:00:00Z'}`);
      const isNext = nextRound && r.round === nextRound.round;
      return `
        <div class="race-card ${isNext ? 'next' : ''}">
          <div class="round">R${r.round}</div>
          <div class="info">
            <div class="name">${r.raceName}</div>
            <div class="place">${r.Circuit.circuitName} — ${r.Circuit.Location.locality}, ${r.Circuit.Location.country}</div>
          </div>
          <div class="when">
            <div class="day">${dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
            <div>${dt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        </div>`;
    }).join('');
  } catch (e) {
    el.innerHTML = `<div class="error">Couldn't load the schedule. ${e.message}</div>`;
  }
}

// ---------- STANDINGS tab ----------

const subtabButtons = document.querySelectorAll('.subtab-btn');
subtabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    subtabButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    loadStandings(btn.dataset.sub, true);
  });
});

const standingsCache = {};

async function loadStandings(kind, force = false) {
  const el = document.getElementById('standings-content');
  if (standingsCache[kind] && !force) { el.innerHTML = standingsCache[kind]; return; }
  el.innerHTML = `<div class="loading">Totting up the points…</div>`;
  try {
    if (kind === 'drivers') {
      const standings = await getDriverStandings();
      const html = standings.map(s => `
        <div class="tower-row">
          <div class="pos">${s.position}</div>
          <div class="teamcolor" style="background:var(--border)"></div>
          <div class="driver">${s.Driver.givenName} ${s.Driver.familyName}
            <span class="team">${s.Constructors[0]?.name || ''}</span>
          </div>
          <div class="gap">${s.points} pts</div>
        </div>`).join('');
      standingsCache.drivers = `<div class="tower">${html}</div>`;
    } else {
      const standings = await getConstructorStandings();
      const html = standings.map(s => `
        <div class="tower-row">
          <div class="pos">${s.position}</div>
          <div class="teamcolor" style="background:var(--border)"></div>
          <div class="driver">${s.Constructor.name}</div>
          <div class="gap">${s.points} pts</div>
        </div>`).join('');
      standingsCache.constructors = `<div class="tower">${html}</div>`;
    }
    el.innerHTML = standingsCache[kind];
  } catch (e) {
    el.innerHTML = `<div class="error">Couldn't load standings. ${e.message}</div>`;
  }
}

// ---------- RESULTS tab (this season, race by race) ----------

async function loadResults() {
  const el = document.getElementById('results-content');
  try {
    const races = await getSchedule();
    const now = new Date();
    el.innerHTML = races.map(r => {
      const dt = new Date(`${r.date}T${r.time || '00:00:00Z'}`);
      const raced = dt < now;
      return `
        <div class="result-race ${raced ? 'raced' : 'not-raced'}">
          <div class="head" ${raced ? `onclick="toggleRaceResult(${r.round}, this.parentElement)"` : ''}>
            <div class="round">R${r.round}</div>
            <div class="name">${r.raceName}</div>
            <div class="chev">${raced ? '▾' : 'not yet raced'}</div>
          </div>
          <div class="body"></div>
        </div>`;
    }).join('');
  } catch (e) {
    el.innerHTML = `<div class="error">Couldn't load results. ${e.message}</div>`;
  }
}

const resultsCache = {};

async function toggleRaceResult(round, cardEl) {
  const wasOpen = cardEl.classList.contains('open');
  cardEl.classList.toggle('open');
  if (wasOpen) return;
  const body = cardEl.querySelector('.body');
  if (resultsCache[round]) { body.innerHTML = resultsCache[round]; return; }
  body.innerHTML = `<div class="loading">Loading…</div>`;
  try {
    const results = await getRaceResults(round);
    const rows = results.map(r => {
      const statusText = r.Time ? r.Time.time : r.status;
      return `
        <div class="result-row">
          <div class="p">${r.positionText}</div>
          <div class="n">${r.Driver.givenName} ${r.Driver.familyName}<span class="team">${r.Constructor.name}</span></div>
          <div class="st">${statusText}</div>
          <div class="pts">${r.points} pts</div>
        </div>`;
    }).join('');
    resultsCache[round] = rows;
    body.innerHTML = rows;
  } catch (e) {
    body.innerHTML = `<div class="error">Couldn't load this race. ${e.message}</div>`;
  }
}

// ---------- GRID tab (driver profiles, this season) ----------

function avatarTag(url, alt) {
  if (!url) return `<img alt="${alt}" style="visibility:hidden">`;
  return `<img src="${url}" alt="${alt}" onerror="this.style.visibility='hidden'">`;
}

async function loadGrid() {
  const el = document.getElementById('grid-content');
  try {
    const [standings, photos] = await Promise.all([getDriverStandings(), getLatestDriverPhotos()]);
    window._driverStandings = standings;
    window._driverPhotos = photos;

    const cards = standings.map(s => {
      const num = s.Driver.permanentNumber;
      const photo = photos[num];
      const team = s.Constructors[0]?.name || '';
      return `
        <div class="driver-card" onclick="showDriverProfile('${s.Driver.driverId}')">
          ${avatarTag(photo?.headshot_url, s.Driver.familyName)}
          <div class="name">${s.Driver.givenName}<br>${s.Driver.familyName}</div>
          <div class="team">${team}</div>
          <div class="num">#${num || '—'}</div>
        </div>`;
    }).join('');

    el.innerHTML = `<div class="driver-grid">${cards}</div><div id="driver-profile-slot"></div>`;
  } catch (e) {
    el.innerHTML = `<div class="error">Couldn't load the grid. ${e.message}</div>`;
  }
}

async function showDriverProfile(driverId) {
  const slot = document.getElementById('driver-profile-slot');
  const s = (window._driverStandings || []).find(x => x.Driver.driverId === driverId);
  if (!s) return;
  const photo = window._driverPhotos?.[s.Driver.permanentNumber];

  slot.innerHTML = `
    <div class="driver-profile">
      ${avatarTag(photo?.headshot_url, s.Driver.familyName)}
      <div class="info">
        <h2>${s.Driver.givenName} ${s.Driver.familyName}</h2>
        <div class="meta">${s.Driver.nationality} · #${s.Driver.permanentNumber || '—'} · ${s.Constructors[0]?.name || ''}</div>
        <div class="stats">
          <div><span>POSITION</span>P${s.position}</div>
          <div><span>POINTS</span>${s.points}</div>
          <div><span>WINS</span>${s.wins}</div>
        </div>
        <div id="driver-results" class="loading" style="padding:12px 0;">Loading this season's races…</div>
      </div>
      <button class="close" onclick="document.getElementById('driver-profile-slot').innerHTML=''">CLOSE ✕</button>
    </div>`;
  slot.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  try {
    const races = await getDriverSeasonResults(s.Driver.driverId);
    const rows = races.map(r => {
      const res = r.Results[0];
      return `
        <div class="result-row">
          <div class="p">${res.positionText}</div>
          <div class="n">R${r.round} · ${r.raceName}</div>
          <div class="st"></div>
          <div class="pts">${res.points} pts</div>
        </div>`;
    }).join('');
    document.getElementById('driver-results').outerHTML = `<div class="tower" style="margin-top:8px;">${rows}</div>`;
  } catch (e) {
    document.getElementById('driver-results').outerHTML = `<div class="error">Couldn't load race-by-race results.</div>`;
  }
}

// ---------- Init ----------
loadTab('live');
