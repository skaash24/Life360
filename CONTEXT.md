# Life360 — Session Handoff

## Live URL
https://life360-gilt.vercel.app

## Stack
- React 18 + Vite SPA (no router, single `src/App.jsx`)
- Google Identity Services (GIS) OAuth 2.0 — implicit token flow
- Vercel hosting + serverless function (`api/claude.js`) as Anthropic API proxy
- All data stored in Google Drive (no backend database)

## Key IDs & Credentials
| Item | Value |
|---|---|
| Google OAuth Client ID | `763965669121-h8okpib7hul30gv554g5f7m6vdke0289.apps.googleusercontent.com` |
| journal.json Drive ID | `11jolfST_2iQu_CYM66ChWrGg4F_LoS7N` |
| Photos Drive folder ID | `181Y0KKcLVPxkfi1Bk4RqzlzXbImrPfgb` |
| Claude model | `claude-sonnet-4-6` |
| Google account | `kshin780@gmail.com` |

OAuth scopes: `https://www.googleapis.com/auth/drive` + `https://www.googleapis.com/auth/calendar.readonly`

## File Map
```
src/App.jsx          — entire frontend (all components, state, API calls)
api/claude.js        — Vercel serverless proxy to Anthropic API
index.html           — loads Google Identity Services script
.env                 — VITE_GOOGLE_CLIENT_ID + ANTHROPIC_API_KEY (not in git)
.env.example         — template for above
vercel.json          — routes /api/* to serverless functions
data/journal.json    — empty template (real data lives on Drive)
```

## Auth Flow
1. GIS `google.accounts.oauth2.initTokenClient` with Drive + Calendar scopes
2. Token stored in `localStorage` (`gtoken`, `gtokenExpiry`)
3. `getToken()` checks expiry; expired token returns null → re-auth prompt
4. Token attached as `Authorization: Bearer` header on all Drive/Calendar API calls

## Journal Data Structure (journal.json on Drive)
```json
{
  "version": 1,
  "entries": [{
    "id": "...", "date": "YYYY-MM-DD", "text": "...",
    "intent": "milestone|story|funny|grateful",
    "category": "kids|sharon|work|personal|home|family",
    "mood": "great|good|okay|hard|tough|funny|proud|grateful",
    "linkedEvents": [...],
    "photos": ["driveFileId", ...],
    "createdAt": "ISO string"
  }],
  "reflections": [{
    "id": "...", "prompt": "user's natural language prompt",
    "generatedAt": "ISO string", "text": "Claude's response"
  }]
}
```

## Features Built
### Log Tab
- Text entry with date picker (defaults to today, resets when app regains focus)
- AI auto-tagging: category + mood detected from text via Claude after 20+ chars
- Link calendar events from the selected day
- Attach photos — uploaded to Drive folder (stored as file IDs, not base64)

### Timeline Tab
- All entries sorted newest first; filter by category
- Expand entry to see full text + linked events + photos (fetched from Drive)
- Edit tags inline (category / mood / intent) with save to Drive

### Reflect Tab
- Conversational textarea — type any natural language prompt
- Two grey placeholder suggestions disappear on typing; Enter or Send button submits
- Passes ALL journal entries + ALL calendar events to Claude as context
- Responses saved to Drive with timestamp; shown in Past Reflections

### Stats Tab
- Total entries, milestone count, most-used category, today's entry count

### Calendar Integration
- Live Google Calendar API fetch (2 years back → 2 years forward, paginated)
- Falls back to static CALENDAR constant if API unavailable
- Events grouped by date and available to Log (link) + Reflect (context)

## Auth Behavior
- Token lasts 1 hour; on expiry app silently refreshes via `requestAccessToken({ prompt: "" })`
- Silent refresh triggered on app init (if previously signed in) and on visibility change
- After refresh, journal + calendar data automatically reloaded — no user action needed
- First-time sign-in still requires the Sign in with Google button

## Known Issues / TODOs
- App shows "Life360 has not completed Google verification" warning — user must click through as test user (added via myaccount.google.com/permissions)
- No delete entry feature yet
- No search/filter by text yet
- Vercel env vars (ANTHROPIC_API_KEY, VITE_GOOGLE_CLIENT_ID) must be set manually in Vercel dashboard

## Last Session — 2026-05-02
- Reflect tab: replaced period picker with conversational chat textarea + inline placeholder suggestions
- Photos: upload to Drive folder as file IDs (not base64); `DrivePhoto` component fetches with auth token
- Merged duplicate journal.json files on Drive into one clean file (new ID in table above)
- Removed manual intent buttons from Log tab (AI auto-tagging handles it)
- Fixed stale date in PWA: log date resets to today on visibility change
- Silent token refresh: expired token refreshes in background; journal + calendar reload automatically
- Added manual mood picker to Log tab (Great/Good/Okay/Hard/Tough, scores 5–1)
- Mood scoring: MOOD_SCORE = { great:5, good:4, okay:3, hard:2, tough:1 }; removed funny/proud/grateful
- `moodSource: "manual" | "ai" | null` saved per entry to distinguish origin
- Mood-only entries (no text) allowed; excluded from total entries count and Timeline
- Two-line mood chart in Reflect: solid terracotta circles = manual, dashed grey squares = AI-inferred
- Legacy entries (saved before moodSource field) treated as AI-sourced in chart
- Stats tab: per-category count pills instead of single "top category" box
