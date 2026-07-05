# PADDOCK

A free F1 dashboard — schedule, standings, and session status. No backend, no API keys, no build step.

## Run it

Just open `index.html`, or push this folder to a GitHub repo and turn on **GitHub Pages** (Settings → Pages → deploy from the `main` branch root).

## How it works

- **Schedule / Standings** — [Jolpica-F1](https://api.jolpi.ca) (Ergast successor). Fully free, unauthenticated, ~200 req/hour.
- **Live** — [OpenF1](https://openf1.org). Session metadata and post-session results are free.
  Second-by-second live gaps/positions are gated behind OpenF1's paid tier now — this app shows
  session status + countdown while a session runs, then full results the moment it ends.

Everything is called directly from the browser — both APIs allow CORS.

## Files

```
index.html        shell + tabs
css/style.css     dark timing-tower theme
js/api.js         fetch wrappers for both APIs
js/app.js         tab logic + rendering
```

## Roadmap (not built yet)

- Multi-season historical archive — same RESULTS/GRID tabs, but for any year back to 1950
  (swap `current` for the year in the Jolpica URLs, add a season picker)
- True live timing — if you ever sponsor OpenF1, add the bearer token server-side
  (e.g. a small Cloudflare Worker, same pattern as HygeiNous) and swap the `/position`
  and `/intervals` endpoints in — never put the token in client-side JS.
- Circuit maps — OpenF1 `circuit_info_url` gives corner-by-corner track data via MultiViewer.

## Built

- **RESULTS** — every race this season, click to expand full finishing order
- **GRID** — every driver this season as a card (photo, team, number), click for a profile
  panel with points/wins/position + race-by-race results

## Notes

Unofficial fan project. Not affiliated with Formula 1, FIA, or Formula One Management.
