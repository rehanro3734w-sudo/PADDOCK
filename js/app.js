// ---------- Tab switching ----------

const tabButtons = document.querySelectorAll('.tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');
const loaded = { live: false, schedule: false, standings: false };

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

// ---------- Init ----------
loadTab('live');
