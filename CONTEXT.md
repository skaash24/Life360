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
| journal.json Drive ID | `18Q9Z5OPQcoMO01gc-p8Wyg2OvcD5Ss4w` |
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
- Text entry with date picker (defaults to today)
- AI auto-tagging: category + mood detected from text via Claude after 20+ chars
- Manual intent buttons: Milestone / Story / Funny / Grateful
- Link calendar events from the selected day
- Attach photos — uploaded to Drive folder (stored as file IDs, not base64)

### Timeline Tab
- All entries sorted newest first; filter by category
- Expand entry to see full text + linked events + photos (fetched from Drive)
- Edit tags inline (category / mood / intent) with save to Drive

### Reflect Tab
- Conversational textarea — type any natural language prompt
- Two placeholder suggestions shown in grey, disappear on typing
- Send button (or Enter) — passes ALL journal entries + ALL calendar events to Claude
- Claude responds as a warm journaling companion with full context
- Responses saved to Drive with timestamp; shown in Past Reflections

### Stats Tab
- Total entries, milestone count, most-used category, today's entry count

### Calendar Integration
- Live Google Calendar API fetch (2 years back → 2 years forward, paginated)
- Falls back to static CALENDAR constant if API unavailable
- Events grouped by date and available to Log (link) + Reflect (context)

## Known Issues / TODOs
- Photos uploaded before this session were stored as base64 in journal.json (still display correctly via backward-compat in `DrivePhoto` component)
- App shows "Life360 has not completed Google verification" warning — user must click through as test user (added via myaccount.google.com/permissions)
- No delete entry feature yet
- No search/filter by text yet
- Vercel env vars (ANTHROPIC_API_KEY, VITE_GOOGLE_CLIENT_ID) must be set manually in Vercel dashboard

## Last Session — 2026-05-02
- Fixed Reflect tab: replaced period picker (week/month/year buttons + date inputs) with conversational chat-style textarea
- Suggestion chips removed; two grey placeholder prompts shown inline in textarea
- `generateReflection` now accepts any natural language prompt and sends full journal + calendar context to Claude
- Fixed build error: curly quotes in JSX placeholder
- Photos now upload to Google Drive folder (file ID stored in journal) instead of being base64-embedded in journal.json — keeps journal.json small
- Added `DrivePhoto` component: fetches images from Drive with auth token, backward-compatible with old base64 entries
