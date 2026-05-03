import { useState, useEffect, useRef, useMemo } from "react";

// ── CONFIG ──────────────────────────────────────────────────────────────────
const DRIVE_FILE_ID = "11jolfST_2iQu_CYM66ChWrGg4F_LoS7N";
const DRIVE_FOLDER_ID = "181Y0KKcLVPxkfi1Bk4RqzlzXbImrPfgb";
const CLAUDE_MODEL = "claude-sonnet-4-6";
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

function getToday() { return new Date().toLocaleDateString("en-CA"); }

// ── CONSTANTS ────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: "kids",   icon: "⭐", label: "Kids"   },
  { id: "sharon", icon: "❤️", label: "Sharon" },
  { id: "work",   icon: "💼", label: "Work"   },
  { id: "personal",icon:"🙋", label: "Personal"},
  { id: "home",   icon: "🏠", label: "Home"   },
  { id: "family", icon: "👨‍👧‍👦", label: "Family" },
];

const MOODS = [
  { id: "great", icon: "✨", label: "Great", score: 5 },
  { id: "good",  icon: "😊", label: "Good",  score: 4 },
  { id: "okay",  icon: "😐", label: "Okay",  score: 3 },
  { id: "hard",  icon: "😔", label: "Hard",  score: 2 },
  { id: "tough", icon: "🌧️", label: "Tough", score: 1 },
];
const MOOD_SCORE = { great: 5, good: 4, okay: 3, hard: 2, tough: 1 };

const INTENTS = [
  { id: "milestone", icon: "🏆", label: "Milestone" },
  { id: "story",     icon: "📖", label: "Story"     },
  { id: "funny",     icon: "😂", label: "Funny"     },
  { id: "grateful",  icon: "🙏", label: "Grateful"  },
];

// ── HELPERS ──────────────────────────────────────────────────────────────────
function fmt(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}
function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
function b64(str) { return btoa(unescape(encodeURIComponent(str))); }
function unb64(s) { try { return decodeURIComponent(escape(atob(s))); } catch { return s; } }

// ── AUTH ─────────────────────────────────────────────────────────────────────
let _gToken = localStorage.getItem("gtoken");
let _gTokenExpiry = Number(localStorage.getItem("gtokenExpiry") || 0);
function getToken() {
  if (_gToken && Date.now() < _gTokenExpiry) return _gToken;
  return null;
}
function storeToken(token, expiresIn) {
  _gToken = token;
  _gTokenExpiry = Date.now() + (Number(expiresIn) - 60) * 1000;
  localStorage.setItem("gtoken", _gToken);
  localStorage.setItem("gtokenExpiry", String(_gTokenExpiry));
}
function clearToken() {
  _gToken = null; _gTokenExpiry = 0;
  localStorage.removeItem("gtoken");
  localStorage.removeItem("gtokenExpiry");
}

async function callClaude(messages, systemPrompt = "") {
  try {
    const res = await fetch("/api/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 1000, system: systemPrompt, messages }),
    });
    const data = await res.json();
    if (!res.ok) return `Error: ${data.error || res.status}`;
    return data.content?.find(b => b.type === "text")?.text || "";
  } catch (e) { return `Error: ${e.message}`; }
}


async function loadCalendarLive() {
  const token = getToken();
  if (!token) return null;
  try {
    const now = new Date();
    const timeMin = new Date(now.getFullYear() - 2, 0, 1).toISOString();
    const timeMax = new Date(now.getFullYear() + 2, 11, 31).toISOString();
    const events = {};
    let pageToken = null;
    do {
      const params = new URLSearchParams({
        timeMin, timeMax,
        singleEvents: "true",
        orderBy: "startTime",
        maxResults: "2500",
        ...(pageToken && { pageToken }),
      });
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) return null;
      const data = await res.json();
      for (const ev of data.items || []) {
        const dateStr = ev.start?.date || ev.start?.dateTime?.split("T")[0];
        if (!dateStr) continue;
        if (!events[dateStr]) events[dateStr] = [];
        events[dateStr].push({
          id: ev.id,
          summary: ev.summary || "(No title)",
          start: ev.start?.dateTime || "",
          end: ev.end?.dateTime || "",
          allDay: !!ev.start?.date,
        });
      }
      pageToken = data.nextPageToken || null;
    } while (pageToken);
    return events;
  } catch { return null; }
}

async function loadJournal() {
  const token = getToken();
  if (!token) return { entries: [], version: 1 };
  try {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${DRIVE_FILE_ID}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { entries: [], version: 1 };
    return await res.json();
  } catch { return { entries: [], version: 1 }; }
}

async function saveJournal(journal) {
  const token = getToken();
  if (!token) { console.warn("Not authenticated"); return; }
  try {
    await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${DRIVE_FILE_ID}?uploadType=media`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(journal),
      }
    );
  } catch (e) { console.warn("Drive save error", e); }
}

// ── STYLES ───────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;1,400&family=DM+Sans:wght@300;400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:      #FAF6F1;
    --surface: #FFFFFF;
    --card:    #FDF9F5;
    --terra:   #C0614A;
    --terra-l: #E8917E;
    --terra-d: #9A4A37;
    --amber:   #D4893A;
    --sage:    #7A9E7E;
    --ink:     #2C2218;
    --ink-2:   #6B5744;
    --ink-3:   #A89080;
    --border:  #E8DDD4;
    --shadow:  0 2px 12px rgba(44,34,24,0.08);
    --shadow-lg: 0 8px 32px rgba(44,34,24,0.12);
    --radius:  14px;
    --font-h:  'Lora', serif;
    --font-b:  'DM Sans', sans-serif;
  }

  body { background: var(--bg); font-family: var(--font-b); color: var(--ink); }

  #app { max-width: 480px; margin: 0 auto; min-height: 100vh; position: relative; }

  /* ── NAV ── */
  .nav { 
    position: sticky; top: 0; z-index: 100;
    background: rgba(250,246,241,0.92); backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--border);
    padding: 14px 20px 10px;
    display: flex; align-items: center; justify-content: space-between;
  }
  .nav-title { font-family: var(--font-h); font-size: 22px; color: var(--terra); letter-spacing: -0.3px; }
  .nav-title span { font-style: italic; }
  .nav-tabs { display: flex; gap: 4px; }
  .nav-tab { 
    padding: 6px 12px; border-radius: 20px; border: none; cursor: pointer;
    font-family: var(--font-b); font-size: 13px; font-weight: 500;
    background: transparent; color: var(--ink-2); transition: all .2s;
  }
  .nav-tab.active { background: var(--terra); color: #fff; }

  /* ── SECTIONS ── */
  .section { padding: 20px; }

  /* ── DATE NAVIGATOR ── */
  .date-nav-wrap { margin-bottom: 16px; }
  .date-nav-top { display: flex; justify-content: flex-end; margin-bottom: 6px; }
  .date-cal-btn {
    background: none; border: none; cursor: pointer; font-size: 20px;
    color: var(--ink-3); padding: 2px 4px; border-radius: 8px; transition: all .15s;
    position: relative;
  }
  .date-cal-btn:hover { color: var(--terra); background: #FFF0EC; }
  .date-cal-input {
    position: absolute; top: 0; left: 0; width: 100%; height: 100%;
    opacity: 0; cursor: pointer; border: none; padding: 0;
  }
  .date-nav-row {
    display: flex; align-items: center; justify-content: space-between;
    background: var(--card); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 14px 16px;
  }
  .date-nav-side {
    display: flex; flex-direction: column; align-items: center;
    cursor: pointer; padding: 4px 8px; border-radius: 8px; transition: all .15s; min-width: 70px;
  }
  .date-nav-side:hover { background: #FFF0EC; }
  .date-nav-side-label { font-size: 10px; color: var(--ink-3); text-transform: uppercase; letter-spacing: .6px; margin-bottom: 2px; }
  .date-nav-side-day { font-size: 11px; color: var(--ink-3); }
  .date-nav-side-num { font-size: 20px; color: var(--ink-2); font-family: var(--font-h); }
  .date-nav-center { text-align: center; flex: 1; }
  .date-nav-center-label { font-size: 10px; color: var(--terra); text-transform: uppercase; letter-spacing: .8px; font-weight: 500; margin-bottom: 2px; }
  .date-nav-center-day { font-size: 13px; color: var(--ink-2); margin-bottom: 1px; }
  .date-nav-center-num { font-family: var(--font-h); font-size: 38px; color: var(--ink); line-height: 1; }
  .date-nav-center-month { font-size: 12px; color: var(--ink-3); margin-top: 2px; }

  /* ── EVENTS ── */
  .events-title { font-size: 11px; font-weight: 500; color: var(--ink-3); text-transform: uppercase; letter-spacing: .8px; margin-bottom: 8px; }
  .event-chip {
    display: inline-flex; align-items: center; gap: 6px;
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 20px; padding: 5px 10px; font-size: 13px; color: var(--ink-2);
    cursor: pointer; margin: 3px; transition: all .15s;
  }
  .event-chip:hover { border-color: var(--terra); color: var(--terra); }
  .event-chip.linked { background: #FFF0EC; border-color: var(--terra-l); color: var(--terra); }
  .event-chip-time { font-size: 11px; color: var(--ink-3); }

  /* ── INTENT BUTTONS ── */
  .intents { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
  .intent-btn {
    flex: 1; min-width: 70px; padding: 10px 6px;
    border: 1.5px solid var(--border); border-radius: 12px;
    background: var(--surface); cursor: pointer; font-size: 18px;
    text-align: center; transition: all .15s; position: relative;
  }
  .intent-btn .intent-label { display: block; font-size: 10px; font-weight: 500; color: var(--ink-3); margin-top: 2px; }
  .intent-btn:hover, .intent-btn.active { border-color: var(--terra); background: #FFF4F1; transform: translateY(-1px); }
  .intent-btn.active { background: #FFF0EC; }

  /* ── TEXTAREA ── */
  .entry-area {
    width: 100%; min-height: 140px; padding: 14px;
    border: 1.5px solid var(--border); border-radius: var(--radius);
    font-family: var(--font-b); font-size: 15px; line-height: 1.6; color: var(--ink);
    background: var(--surface); resize: none; outline: none; transition: border .2s;
  }
  .entry-area:focus { border-color: var(--terra); }
  .entry-area::placeholder { color: var(--ink-3); }

  /* ── TAGS ROW ── */
  .tags-row { display: flex; gap: 6px; margin: 10px 0; flex-wrap: wrap; align-items: center; }
  .tag {
    display: flex; align-items: center; gap: 4px;
    padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 500;
    border: 1.5px solid transparent; cursor: pointer; transition: all .15s;
  }
  .tag.cat { background: #F5EDE8; color: var(--terra-d); border-color: #EDCFC4; }
  .tag.mood { background: #F0EDE8; color: var(--ink-2); border-color: var(--border); }
  .tag.ai-set { opacity: .7; }

  /* ── SAVE BUTTON ── */
  .save-btn {
    width: 100%; padding: 14px; margin-top: 12px;
    background: var(--terra); color: #fff; border: none;
    border-radius: var(--radius); font-family: var(--font-b);
    font-size: 15px; font-weight: 500; cursor: pointer; transition: all .2s;
  }
  .save-btn:hover { background: var(--terra-d); transform: translateY(-1px); box-shadow: var(--shadow-lg); }
  .save-btn:disabled { opacity: .5; cursor: default; transform: none; }

  /* ── STATUS ── */
  .status { 
    text-align: center; font-size: 13px; padding: 10px;
    border-radius: 10px; margin-top: 10px;
  }
  .status.ok { background: #EEFBF1; color: #2E7D32; }
  .status.err { background: #FFF0EE; color: var(--terra-d); }
  .status.ai { background: #FFF8F0; color: var(--amber); }

  /* ── TIMELINE ── */
  .filter-row { display: flex; gap: 6px; margin-bottom: 16px; flex-wrap: wrap; }
  .filter-btn {
    padding: 5px 12px; border-radius: 20px;
    border: 1.5px solid var(--border); background: var(--surface);
    font-size: 12px; font-weight: 500; color: var(--ink-2); cursor: pointer; transition: all .15s;
  }
  .filter-btn.active { background: var(--terra); border-color: var(--terra); color: #fff; }

  .entry-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 16px; margin-bottom: 12px;
    box-shadow: var(--shadow); transition: box-shadow .2s;
  }
  .entry-card:hover { box-shadow: var(--shadow-lg); }
  .entry-meta { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
  .entry-date { font-size: 12px; color: var(--ink-3); font-style: italic; }
  .entry-body { font-size: 14px; line-height: 1.65; color: var(--ink); font-family: var(--font-b); }
  .entry-body.collapsed { 
    display: -webkit-box; -webkit-line-clamp: 3;
    -webkit-box-orient: vertical; overflow: hidden;
  }
  .expand-btn { 
    font-size: 12px; color: var(--terra); cursor: pointer; 
    border: none; background: none; padding: 4px 0; margin-top: 4px;
  }
  .milestone-badge {
    display: inline-flex; align-items: center; gap: 3px;
    background: #FFF7E6; border: 1px solid #FFD980; color: #A0740B;
    font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 20px;
  }

  /* ── REFLECT ── */
  .reflect-card {
    background: linear-gradient(135deg, #FDF6EE 0%, #FFF9F5 100%);
    border: 1px solid var(--border); border-radius: var(--radius);
    padding: 20px; margin-bottom: 16px; box-shadow: var(--shadow);
  }
  .reflect-title { font-family: var(--font-h); font-size: 18px; color: var(--terra); margin-bottom: 12px; }
  .reflect-body { font-size: 14px; line-height: 1.75; color: var(--ink); white-space: pre-wrap; }
  .reflect-btn {
    padding: 10px 20px; background: var(--terra); color: #fff;
    border: none; border-radius: 10px; font-size: 14px; font-weight: 500;
    cursor: pointer; transition: all .2s; margin: 4px 4px 0 0;
  }
  .reflect-btn:hover { background: var(--terra-d); }
  .reflect-btn.outline {
    background: transparent; border: 1.5px solid var(--terra); color: var(--terra);
  }
  .reflect-btn.outline:hover { background: #FFF0EC; }

  /* ── STATS ── */
  .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 12px 0; }
  .stat-box { 
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 12px; padding: 14px; text-align: center;
  }
  .stat-num { font-family: var(--font-h); font-size: 28px; color: var(--terra); }
  .stat-label { font-size: 11px; color: var(--ink-3); margin-top: 2px; }

  /* ── EMPTY ── */
  .empty { text-align: center; padding: 48px 24px; color: var(--ink-3); }
  .empty-icon { font-size: 40px; margin-bottom: 12px; }
  .empty-msg { font-family: var(--font-h); font-size: 16px; color: var(--ink-2); }
  .empty-sub { font-size: 13px; margin-top: 6px; }

  /* ── PHOTO ── */
  .photo-row { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
  .photo-thumb { width: 72px; height: 72px; object-fit: cover; border-radius: 8px; border: 1px solid var(--border); }
  .photo-add {
    width: 72px; height: 72px; border: 1.5px dashed var(--border);
    border-radius: 8px; display: flex; align-items: center; justify-content: center;
    font-size: 22px; cursor: pointer; color: var(--ink-3); transition: all .15s;
  }
  .photo-add:hover { border-color: var(--terra); color: var(--terra); }

  /* ── SPINNER ── */
  .spin { display: inline-block; width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.4); border-top-color: #fff; border-radius: 50%; animation: spin .7s linear infinite; vertical-align: middle; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .section-header { 
    font-family: var(--font-h); font-size: 11px; font-weight: 400;
    color: var(--ink-3); text-transform: uppercase; letter-spacing: 1px;
    margin: 20px 0 8px; 
  }
`;

// ── MOOD CHART ───────────────────────────────────────────────────────────────
function MoodChart({ entries }) {
  const toPoints = (source) => {
    const byDay = {};
    entries
      .filter(e => MOOD_SCORE[e.mood] && (e.moodSource === source || (source === "ai" && !e.moodSource)))
      .forEach(e => {
        if (!byDay[e.date]) byDay[e.date] = [];
        byDay[e.date].push(MOOD_SCORE[e.mood]);
      });
    return Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, scores]) => ({ date, score: scores.reduce((a, b) => a + b, 0) / scores.length }));
  };

  const manual = toPoints("manual");
  const ai = toPoints("ai");

  if (manual.length < 1 && ai.length < 2) return (
    <div style={{textAlign:"center",padding:"20px 0",color:"var(--ink-3)",fontSize:13}}>
      Select your mood when logging to start tracking your trend
    </div>
  );

  const W = 320, H = 110, PAD = 16;
  const scoreColor = s => s >= 4.5 ? "#4CAF50" : s >= 3.5 ? "#8BC34A" : s >= 2.5 ? "#FFC107" : s >= 1.5 ? "#FF7043" : "#F44336";

  // Build a unified x-axis from all dates
  const allDates = [...new Set([...manual, ...ai].map(p => p.date))].sort();
  const xFor = date => allDates.length < 2 ? W / 2 : PAD + (allDates.indexOf(date) / (allDates.length - 1)) * (W - PAD * 2);
  const yFor = score => PAD + ((5 - score) / 4) * (H - PAD * 2);
  const pathFor = pts => pts.length < 2 ? "" : pts.map((p, i) => `${i === 0 ? "M" : "L"}${xFor(p.date)},${yFor(p.score)}`).join(" ");

  return (
    <div style={{background:"var(--card)",borderRadius:12,padding:"12px 16px",marginBottom:16,border:"1px solid var(--border)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
        <span style={{fontSize:12,fontWeight:600,color:"var(--ink-2)"}}>Mood Trend</span>
        <div style={{display:"flex",gap:12,fontSize:11,color:"var(--ink-3)"}}>
          <span style={{display:"flex",alignItems:"center",gap:4}}>
            <svg width="16" height="8"><line x1="0" y1="4" x2="16" y2="4" stroke="#E07A5F" strokeWidth="2"/><circle cx="8" cy="4" r="3" fill="#E07A5F"/></svg> You
          </span>
          <span style={{display:"flex",alignItems:"center",gap:4}}>
            <svg width="16" height="8"><line x1="0" y1="4" x2="16" y2="4" stroke="#94A3B8" strokeWidth="1.5" strokeDasharray="3,2"/><rect x="5" y="1" width="6" height="6" fill="#94A3B8"/></svg> AI
          </span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:90}}>
        {[1,2,3,4,5].map(s => (
          <line key={s} x1={PAD} x2={W-PAD} y1={yFor(s)} y2={yFor(s)} stroke="var(--border)" strokeWidth={0.5}/>
        ))}
        {["1","2","3","4","5"].map((s,i) => (
          <text key={s} x={PAD-4} y={yFor(i+1)+3} fontSize="7" fill="var(--ink-3)" textAnchor="end">{s}</text>
        ))}
        {ai.length >= 2 && <path d={pathFor(ai)} fill="none" stroke="#94A3B8" strokeWidth={1.5} strokeDasharray="4,3" strokeLinejoin="round"/>}
        {ai.map((p, i) => <rect key={i} x={xFor(p.date)-3} y={yFor(p.score)-3} width={6} height={6} fill={scoreColor(p.score)} opacity={0.7}/>)}
        {manual.length >= 2 && <path d={pathFor(manual)} fill="none" stroke="#E07A5F" strokeWidth={2} strokeLinejoin="round"/>}
        {manual.map((p, i) => <circle key={i} cx={xFor(p.date)} cy={yFor(p.score)} r={4} fill={scoreColor(p.score)} stroke="#fff" strokeWidth={1}/>)}
      </svg>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"var(--ink-3)",marginTop:2}}>
        <span>{allDates[0]}</span><span>{allDates[allDates.length-1]}</span>
      </div>
    </div>
  );
}

// ── PHOTO HELPERS ────────────────────────────────────────────────────────────
async function uploadPhotoToDrive(file, token) {
  const metadata = { name: `photo_${Date.now()}_${file.name}`, parents: [DRIVE_FOLDER_ID] };
  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  form.append("file", file);
  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
    { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form }
  );
  if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message || "Upload failed"); }
  const data = await res.json();
  return data.id;
}

function DrivePhoto({ src, className }) {
  const [url, setUrl] = useState(src?.startsWith("data:") ? src : null);
  useEffect(() => {
    if (!src || src.startsWith("data:")) return;
    const token = getToken();
    if (!token) return;
    let objectUrl;
    fetch(`https://www.googleapis.com/drive/v3/files/${src}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.blob())
      .then(blob => { objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); })
      .catch(() => {});
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [src]);
  if (!url) return <div className={className} style={{ background: "var(--border)", borderRadius: 8 }} />;
  return <img src={url} className={className} alt="" />;
}

// ── MAIN APP ─────────────────────────────────────────────────────────────────
export default function Life360() {
  const [tab, setTab] = useState("log");
  const [journal, setJournal] = useState({ entries: [], reflections: [], version: 1 });
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);
  const [authed, setAuthed] = useState(!!getToken());
  const tokenClientRef = useRef(null);

  useEffect(() => {
    const init = () => {
      if (!window.google || !GOOGLE_CLIENT_ID) return;
      tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: "https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/calendar.readonly",
        callback: async (resp) => {
          if (resp.error) return;
          storeToken(resp.access_token, resp.expires_in);
          setAuthed(true);
          const [j, liveCalendar] = await Promise.all([loadJournal(), loadCalendarLive()]);
          setJournal(j);
          if (liveCalendar) setCalendarData(liveCalendar);
        },
      });
      // Silent refresh on init if previously signed in but token expired
      if (localStorage.getItem("gtoken") && !getToken()) {
        tokenClientRef.current.requestAccessToken({ prompt: "" });
      }
    };
    if (window.google) init();
    else window.addEventListener("load", init);
    return () => window.removeEventListener("load", init);
  }, []);

  const signIn = () => tokenClientRef.current?.requestAccessToken({ prompt: "consent" });
  const signOut = () => { clearToken(); setAuthed(false); };

  // Log state
  const [logDate, setLogDate] = useState(getToday());
  const [text, setText] = useState("");
  const [intent, setIntent] = useState(null);
  const [linkedEvents, setLinkedEvents] = useState([]);
  const [detectedCat, setDetectedCat] = useState(null);
  const [detectedMood, setDetectedMood] = useState(null);
  const [selectedMood, setSelectedMood] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [aiRunning, setAiRunning] = useState(false);
  const [calEvents, setCalEvents] = useState([]);
  const [calLoading, setCalLoading] = useState(false);
  const [calendarData, setCalendarData] = useState({});
  const aiTimer = useRef(null);
  const fileRef = useRef(null);
  const dateRef = useRef(null);

  // Load calendar events when date changes
  useEffect(() => {
    setLinkedEvents([]);
    setCalEvents(calendarData[logDate] || []);
  }, [logDate, calendarData]);

  // Timeline state
  const [filter, setFilter] = useState("all");
  const [timelinePage, setTimelinePage] = useState(0);
  const [expanded, setExpanded] = useState({});
  const [editingTags, setEditingTags] = useState(null);
  const [editTextVal, setEditTextVal] = useState("");

  // Reflect state
  const [reflectPrompt, setReflectPrompt] = useState("");
  const [reflection, setReflection] = useState(null);
  const [reflecting, setReflecting] = useState(false);
  const [expandedRefl, setExpandedRefl] = useState({});

  // Load journal and calendar on mount
  useEffect(() => {
    (async () => {
      const [j, liveCalendar] = await Promise.all([loadJournal(), loadCalendarLive()]);
      setJournal(j);
      if (liveCalendar) setCalendarData(liveCalendar);
      setLoaded(true);
    })();
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      setLogDate(getToday());
      if (!getToken() && localStorage.getItem("gtoken") && tokenClientRef.current) {
        tokenClientRef.current.requestAccessToken({ prompt: "" });
      } else if (getToken()) {
        Promise.all([loadJournal(), loadCalendarLive()]).then(([j, liveCalendar]) => {
          setJournal(j);
          if (liveCalendar) setCalendarData(liveCalendar);
        });
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => { document.head.removeChild(style); document.removeEventListener("visibilitychange", onVisible); };
  }, []);

  // AI auto-tag on text change
  useEffect(() => {
    if (!text.trim() || text.length < 20) return;
    clearTimeout(aiTimer.current);
    aiTimer.current = setTimeout(async () => {
      setAiRunning(true);
      try {
        const raw = await callClaude(
          [{ role: "user", content: `Journal entry: "${text}"\n\nRespond ONLY with JSON: {"category":"kids|sharon|work|personal|home|family","mood":"great|good|okay|hard|tough"}` }],
          "You are a silent AI tagger. Return only valid JSON, no other text."
        );
        const clean = raw.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(clean);
        if (parsed.category) setDetectedCat(parsed.category);
        if (parsed.mood) setDetectedMood(parsed.mood);
      } catch {}
      setAiRunning(false);
    }, 1500);
  }, [text]);

  const toggleEvent = (ev) => {
    setLinkedEvents(prev =>
      prev.find(e => e.id === ev.id) ? prev.filter(e => e.id !== ev.id) : [...prev, ev]
    );
  };

  const addPhoto = async (e) => {
    const token = getToken();
    if (!token) { setStatus({ type: "err", msg: "Sign in first" }); return; }
    const files = Array.from(e.target.files);
    setPhotoUploading(true);
    try {
      for (const f of files) {
        const id = await uploadPhotoToDrive(f, token);
        setPhotos(p => [...p, id]);
      }
    } catch (err) {
      setStatus({ type: "err", msg: `Photo upload failed: ${err.message}` });
    } finally {
      setPhotoUploading(false);
      e.target.value = "";
    }
  };

  const saveEntry = async () => {
    if (!text.trim() && !selectedMood) { setStatus({ type: "err", msg: "Write something or select a mood first!" }); return; }
    setSaving(true);
    setStatus(null);
    const entry = {
      id: uid(),
      date: logDate,
      text,
      intent,
      category: detectedCat,
      mood: selectedMood || detectedMood,
      moodSource: selectedMood ? "manual" : detectedMood ? "ai" : null,
      linkedEvents,
      photos,
      createdAt: new Date().toISOString(),
    };
    const updated = { ...journal, entries: [entry, ...journal.entries] };
    setJournal(updated);
    await saveJournal(updated);
    setSaving(false);
    setStatus({ type: "ok", msg: "✓ Saved to your journal" });
    setText(""); setIntent(null); setLinkedEvents([]); setDetectedCat(null); setDetectedMood(null); setSelectedMood(null); setPhotos([]);
    setTimeout(() => setStatus(null), 3000);
  };

  const updateEntryTags = async (entryId, updates) => {
    const updated = { ...journal, entries: journal.entries.map(e => e.id === entryId ? { ...e, ...updates } : e) };
    setJournal(updated);
    await saveJournal(updated);
    setEditingTags(null);
  };

  const updateEntryText = async (entryId, text) => {
    const updated = { ...journal, entries: journal.entries.map(e => e.id === entryId ? { ...e, text } : e) };
    setJournal(updated);
    await saveJournal(updated);
    setEditingTags(null);
  };

  const generateReflection = async (prompt) => {
    if (!prompt.trim()) return;
    setReflecting(true);
    setReflection(null);

    const savedReflections = journal.reflections || [];
    const useSummaryOfSummaries = savedReflections.length >= 3;

    let contextSection;
    if (useSummaryOfSummaries) {
      const reflectionsList = savedReflections
        .slice(0, 20)
        .map(r => `[${r.generatedAt ? r.generatedAt.slice(0, 10) : "?"}]${r.dateRange ? ` (${r.dateRange})` : ""} Prompt: "${r.prompt}"\n${r.text}`)
        .join("\n\n---\n\n");
      const recentEntries = journal.entries.slice(0, 10)
        .map(e => `[${e.date}]${e.category ? ` [${e.category}]` : ""} ${e.text}`)
        .join("\n\n");
      contextSection = `PAST REFLECTIONS (use these as primary source for longer periods):\n${reflectionsList}\n\nRECENT JOURNAL ENTRIES (use for recent/specific moments):\n${recentEntries}`;
    } else {
      const journalSection = journal.entries.length > 0
        ? `JOURNAL ENTRIES:\n${journal.entries.map(e => `[${e.date}]${e.intent ? ` (${e.intent})` : ""}${e.category ? ` [${e.category}]` : ""} ${e.text}`).join("\n\n")}`
        : "JOURNAL ENTRIES: None yet.";
      const calendarLines = [];
      for (const [dateStr, evts] of Object.entries(calendarData)) {
        evts.forEach(ev => calendarLines.push(`[${dateStr}] ${ev.summary}${ev.allDay ? " (all day)" : ""}`));
      }
      const calendarSection = calendarLines.length > 0
        ? `CALENDAR EVENTS:\n${calendarLines.sort().join("\n")}`
        : "CALENDAR EVENTS: None.";
      contextSection = `${journalSection}\n\n${calendarSection}`;
    }

    const text2 = await callClaude(
      [{ role: "user", content: `Today's date is ${getToday()}.\n\n${contextSection}\n\nKevin's request: "${prompt}"\n\nRespond conversationally and warmly. For longer periods, synthesize themes and highlights. For recent or specific requests, use the detailed entries.` }],
      "You are a warm, thoughtful journaling companion for Kevin (48, works at AWS, married to Sharon, kids Aiden age 7 and a daughter). You know his life well through his journal and calendar. Be personal, insightful, and encouraging."
    );
    setReflection(text2);
    if (text2 && !text2.startsWith("Error:")) {
      const dates = journal.entries.map(e => e.date).sort();
      const fmt2 = d => new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      const dateRange = dates.length > 0 ? `${fmt2(dates[0])} – ${fmt2(getToday())}` : null;
      const saved = {
        id: uid(),
        prompt,
        generatedAt: new Date().toISOString(),
        dateRange,
        text: text2,
      };
      const updated = { ...journal, reflections: [saved, ...(journal.reflections || [])] };
      setJournal(updated);
      await saveJournal(updated);
    }
    setReflecting(false);
  };

  // ── FILTERED ENTRIES ──
  const catIcon = (id) => CATEGORIES.find(c => c.id === id)?.icon || "";
  const moodIcon = (id) => MOODS.find(m => m.id === id)?.icon || "";

  const filteredEntries = useMemo(() => journal.entries.filter(e => {
    if (!e.text?.trim()) return false;
    if (filter === "all") return true;
    if (filter === "milestones") return e.intent === "milestone";
    if (filter === "stories") return e.intent === "story";
    return e.category === filter;
  }), [journal.entries, filter]);

  // ── STATS ── (single pass)
  const { totalEntries, catCounts, moodCounts } = useMemo(() => {
    const catCounts = {}, moodCounts = {};
    let totalEntries = 0;
    journal.entries.forEach(e => {
      if (e.text?.trim()) totalEntries++;
      if (e.category) catCounts[e.category] = (catCounts[e.category] || 0) + 1;
      if (e.mood) moodCounts[e.mood] = (moodCounts[e.mood] || 0) + 1;
    });
    return { totalEntries, catCounts, moodCounts };
  }, [journal.entries]);

  if (!authed) return (
    <div id="app">
      <nav className="nav"><div className="nav-title">Life<span>360</span></div></nav>
      <div className="section" style={{textAlign:"center",paddingTop:80}}>
        <div style={{fontSize:56,marginBottom:16}}>📖</div>
        <h2 style={{fontFamily:"var(--serif)",fontSize:28,marginBottom:8}}>Life360</h2>
        <p style={{color:"var(--ink-2)",marginBottom:32}}>Sign in with Google to access your journal</p>
        <button className="save-btn" onClick={signIn} style={{margin:"0 auto",display:"block",width:"auto",padding:"12px 32px"}}>
          Sign in with Google
        </button>
      </div>
    </div>
  );

  return (
    <div id="app">
      {/* NAV */}
      <nav className="nav">
        <div className="nav-title">Life<span>360</span></div>
        <div className="nav-tabs">
          {[["log","✏️ Log"],["timeline","📚 Timeline"],["reflect","✨ Reflect"]].map(([id, label]) => (
            <button key={id} className={`nav-tab${tab===id?" active":""}`} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>
        <button onClick={signOut} style={{background:"none",border:"none",cursor:"pointer",fontSize:12,color:"var(--ink-3)",padding:"4px 8px"}}>Sign out</button>
      </nav>

      {/* ── LOG TAB ── */}
      {tab === "log" && (
        <div className="section">
          {/* Date Navigator */}
          {(() => {
            const [y, m, d] = logDate.split("-").map(Number);
            const cur = new Date(y, m - 1, d);
            const prev = new Date(y, m - 1, d - 1);
            const next = new Date(y, m - 1, d + 1);
            const toStr = dt => `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")}`;
            const dayName = dt => dt.toLocaleDateString("en-US", { weekday: "short" });
            const monthName = dt => dt.toLocaleDateString("en-US", { month: "long", year: "numeric" });
            return (
              <div className="date-nav-wrap">
                <div className="date-nav-top">
                  <button className="date-cal-btn" title="Pick any date">
                    🗓
                    <input type="date" className="date-cal-input" value={logDate} onChange={e => setLogDate(e.target.value)} />
                  </button>
                </div>
                <div className="date-nav-row">
                  <div className="date-nav-side" onClick={() => setLogDate(toStr(prev))}>
                    <div className="date-nav-side-label">← Yesterday</div>
                    <div className="date-nav-side-day">{dayName(prev)}</div>
                    <div className="date-nav-side-num">{prev.getDate()}</div>
                  </div>
                  <div className="date-nav-center">
                    <div className="date-nav-center-label">{logDate === getToday() ? "Today" : "Selected"}</div>
                    <div className="date-nav-center-day">{dayName(cur)}</div>
                    <div className="date-nav-center-num">{cur.getDate()}</div>
                    <div className="date-nav-center-month">{monthName(cur)}</div>
                  </div>
                  <div className="date-nav-side" onClick={() => setLogDate(toStr(next))}>
                    <div className="date-nav-side-label">Tomorrow →</div>
                    <div className="date-nav-side-day">{dayName(next)}</div>
                    <div className="date-nav-side-num">{next.getDate()}</div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Calendar events */}
          {calEvents.length > 0 && (
            <div style={{marginBottom:14}}>
              <div className="events-title">{logDate === getToday() ? "Today's" : "Day's"} events — tap to link</div>
              <div>
                {calEvents.map(ev => (
                  <button
                    key={ev.id}
                    className={`event-chip${linkedEvents.find(e=>e.id===ev.id)?" linked":""}`}
                    onClick={() => toggleEvent(ev)}
                  >
                    {linkedEvents.find(e=>e.id===ev.id) ? "✓" : "🗓"}
                    {ev.summary}
                    {ev.start && <span className="event-chip-time">{fmtTime(ev.start)}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
          {calEvents.length === 0 && logDate !== getToday() && (
            <div style={{marginBottom:14,fontSize:12,color:"var(--ink-3)"}}>No calendar events this day</div>
          )}


          {/* Text area */}
          <textarea
            className="entry-area"
            placeholder="What happened today? A moment with the kids, something at work, a feeling…"
            value={text}
            onChange={e => setText(e.target.value)}
          />

          {/* Mood picker */}
          <div style={{marginBottom:12}}>
            <div style={{fontSize:11,color:"var(--ink-3)",marginBottom:6}}>How are you feeling?</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {MOODS.map(m => (
                <button key={m.id} onClick={() => setSelectedMood(selectedMood === m.id ? null : m.id)}
                  style={{padding:"5px 10px",borderRadius:20,border:`1px solid ${selectedMood===m.id?"var(--terra)":"var(--border)"}`,background:selectedMood===m.id?"#FFF0EC":"var(--card)",color:"var(--ink-1)",fontSize:12,cursor:"pointer"}}>
                  {m.icon} {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* AI tags */}
          {(detectedCat || detectedMood || aiRunning) && (
            <div className="tags-row">
              <span style={{fontSize:11,color:"var(--ink-3)"}}>AI detected:</span>
              {aiRunning && <span style={{fontSize:12,color:"var(--amber)"}}>analyzing…</span>}
              {detectedCat && (
                <span className="tag cat ai-set">
                  {catIcon(detectedCat)} {CATEGORIES.find(c=>c.id===detectedCat)?.label}
                </span>
              )}
              {detectedMood && (
                <span className="tag mood ai-set">
                  {moodIcon(detectedMood)} {MOODS.find(m=>m.id===detectedMood)?.label}
                </span>
              )}
            </div>
          )}

          {/* Photos */}
          <div className="photo-row">
            {photos.map((src, i) => <DrivePhoto key={i} src={src} className="photo-thumb" />)}
            <div className="photo-add" onClick={() => !photoUploading && fileRef.current?.click()}>
              {photoUploading ? <span className="spin" /> : "📷"}
            </div>
            <input ref={fileRef} type="file" accept="image/*" multiple style={{display:"none"}} onChange={addPhoto} />
          </div>

          {/* Save */}
          <button className="save-btn" onClick={saveEntry} disabled={saving || !loaded}>
            {saving ? <><span className="spin"/> Saving…</> : "Save Entry"}
          </button>

          {status && <div className={`status ${status.type}`}>{status.msg}</div>}
        </div>
      )}

      {/* ── TIMELINE TAB ── */}
      {tab === "timeline" && (
        <div className="section">
          <div className="filter-row">
            {[
              {id:"all",label:"All"},
              {id:"milestones",label:"🏆 Milestones"},
              {id:"stories",label:"📖 Stories"},
              ...CATEGORIES.map(c=>({id:c.id,label:`${c.icon} ${c.label}`}))
            ].map(f => (
              <button key={f.id} className={`filter-btn${filter===f.id?" active":""}`} onClick={()=>{setFilter(f.id);setTimelinePage(0);}}>
                {f.label}
              </button>
            ))}
          </div>

          {filteredEntries.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">📒</div>
              <div className="empty-msg">Nothing here yet</div>
              <div className="empty-sub">Start logging moments in the Log tab</div>
            </div>
          ) : filteredEntries.slice(timelinePage * 10, timelinePage * 10 + 10).map(entry => (
            <div key={entry.id} className="entry-card">
              <div className="entry-meta">
                <span className="entry-date">{fmt(entry.date)}</span>
                {entry.intent === "milestone" && <span className="milestone-badge">🏆 Milestone</span>}
                {entry.category && <span className="tag cat">{catIcon(entry.category)} {CATEGORIES.find(c=>c.id===entry.category)?.label}</span>}
                {entry.mood && <span className="tag mood">{moodIcon(entry.mood)}</span>}
              </div>
              <div className={`entry-body${expanded[entry.id]?"":" collapsed"}`}>{entry.text}</div>
              {entry.text.length > 180 && (
                <button className="expand-btn" onClick={()=>setExpanded(p=>({...p,[entry.id]:!p[entry.id]}))}>
                  {expanded[entry.id] ? "Show less" : "Read more"}
                </button>
              )}
              {entry.photos?.length > 0 && (
                <div className="photo-row" style={{marginTop:8}}>
                  {entry.photos.map((src,i)=><DrivePhoto key={i} src={src} className="photo-thumb" />)}
                </div>
              )}
              {entry.linkedEvents?.length > 0 && (
                <div style={{marginTop:8}}>
                  {entry.linkedEvents.map(ev=>(
                    <span key={ev.id} className="event-chip linked" style={{fontSize:12}}>🗓 {ev.summary}</span>
                  ))}
                </div>
              )}
              <button
                onClick={() => { setEditingTags(editingTags === entry.id ? null : entry.id); setEditTextVal(entry.text || ""); }}
                style={{marginTop:10,background:"none",border:"1px solid var(--border)",borderRadius:8,padding:"4px 10px",fontSize:12,color:"var(--ink-2)",cursor:"pointer"}}
              >
                ✏️ Edit
              </button>
              {editingTags === entry.id && (
                <div style={{marginTop:10,padding:12,background:"var(--card)",borderRadius:10,border:"1px solid var(--border)"}}>
                  <div style={{fontSize:12,color:"var(--ink-2)",marginBottom:6}}>Text</div>
                  <textarea
                    value={editTextVal}
                    onChange={e => setEditTextVal(e.target.value)}
                    rows={4}
                    style={{width:"100%",boxSizing:"border-box",padding:"8px 10px",borderRadius:8,border:"1px solid var(--border)",fontSize:14,fontFamily:"inherit",resize:"vertical",background:"var(--surface)",color:"var(--ink-1)"}}
                  />
                  <button
                    onClick={() => updateEntryText(entry.id, editTextVal)}
                    style={{marginTop:6,marginBottom:14,padding:"6px 16px",borderRadius:8,background:"var(--terra)",border:"none",color:"#fff",fontSize:13,cursor:"pointer"}}
                  >Save text</button>
                  <div style={{fontSize:12,color:"var(--ink-2)",marginBottom:6}}>Category</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10}}>
                    {CATEGORIES.map(c => (
                      <button key={c.id}
                        onClick={() => updateEntryTags(entry.id, { category: entry.category === c.id ? null : c.id })}
                        style={{padding:"4px 10px",borderRadius:20,border:"1px solid var(--border)",background:entry.category===c.id?"var(--terra)":"var(--surface)",color:entry.category===c.id?"#fff":"var(--ink-1)",fontSize:12,cursor:"pointer"}}
                      >{c.icon} {c.label}</button>
                    ))}
                  </div>
                  <div style={{fontSize:12,color:"var(--ink-2)",marginBottom:6}}>Mood</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10}}>
                    {MOODS.map(m => (
                      <button key={m.id}
                        onClick={() => updateEntryTags(entry.id, { mood: entry.mood === m.id ? null : m.id })}
                        style={{padding:"4px 10px",borderRadius:20,border:"1px solid var(--border)",background:entry.mood===m.id?"var(--terra)":"var(--surface)",color:entry.mood===m.id?"#fff":"var(--ink-1)",fontSize:12,cursor:"pointer"}}
                      >{m.icon} {m.label}</button>
                    ))}
                  </div>
                  <div style={{fontSize:12,color:"var(--ink-2)",marginBottom:6}}>Intent</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                    {INTENTS.map(i => (
                      <button key={i.id}
                        onClick={() => updateEntryTags(entry.id, { intent: entry.intent === i.id ? null : i.id })}
                        style={{padding:"4px 10px",borderRadius:20,border:"1px solid var(--border)",background:entry.intent===i.id?"var(--terra)":"var(--surface)",color:entry.intent===i.id?"#fff":"var(--ink-1)",fontSize:12,cursor:"pointer"}}
                      >{i.icon} {i.label}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
          {filteredEntries.length > 10 && (
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:16,padding:"12px 0"}}>
              <button
                onClick={() => setTimelinePage(p => Math.max(0, p - 1))}
                disabled={timelinePage === 0}
                style={{padding:"6px 16px",borderRadius:8,border:"1px solid var(--border)",background:"var(--surface)",color:timelinePage===0?"var(--ink-3)":"var(--ink-1)",fontSize:13,cursor:timelinePage===0?"default":"pointer"}}
              >← Newer</button>
              <span style={{fontSize:12,color:"var(--ink-2)"}}>
                {timelinePage * 10 + 1}–{Math.min(timelinePage * 10 + 10, filteredEntries.length)} of {filteredEntries.length}
              </span>
              <button
                onClick={() => setTimelinePage(p => p + 1)}
                disabled={(timelinePage + 1) * 10 >= filteredEntries.length}
                style={{padding:"6px 16px",borderRadius:8,border:"1px solid var(--border)",background:"var(--surface)",color:(timelinePage+1)*10>=filteredEntries.length?"var(--ink-3)":"var(--ink-1)",fontSize:13,cursor:(timelinePage+1)*10>=filteredEntries.length?"default":"pointer"}}
              >Older →</button>
            </div>
          )}
        </div>
      )}

      {/* ── REFLECT TAB ── */}
      {tab === "reflect" && (
        <div className="section">
          <MoodChart entries={journal.entries} />
          {totalEntries > 0 && (
            <>
              <div className="section-header" style={{marginTop:4}}>By Category</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:16}}>
                {CATEGORIES.map(c => {
                  const count = catCounts[c.id] || 0;
                  return count > 0 ? (
                    <div key={c.id} style={{display:"flex",alignItems:"center",gap:4,padding:"4px 12px",borderRadius:20,background:"var(--card)",border:"1px solid var(--border)",fontSize:13}}>
                      <span>{c.icon}</span>
                      <span style={{color:"var(--ink-1)"}}>{c.label}</span>
                      <span style={{color:"var(--terra)",fontWeight:600}}>{count}</span>
                    </div>
                  ) : null;
                })}
              </div>
              <div className="section-header">By Mood</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:16}}>
                {MOODS.map(m => {
                  const count = moodCounts[m.id] || 0;
                  return count > 0 ? (
                    <div key={m.id} style={{display:"flex",alignItems:"center",gap:4,padding:"4px 12px",borderRadius:20,background:"var(--card)",border:"1px solid var(--border)",fontSize:13}}>
                      <span>{m.icon}</span>
                      <span style={{color:"var(--ink-1)"}}>{m.label}</span>
                      <span style={{color:"var(--terra)",fontWeight:600}}>{count}</span>
                    </div>
                  ) : null;
                })}
              </div>
            </>
          )}

          <div style={{position:"relative",marginBottom:8}}>
            <textarea
              value={reflectPrompt}
              onChange={e=>setReflectPrompt(e.target.value)}
              onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();generateReflection(reflectPrompt);} }}
              placeholder={"How was this week?\nWhat were Aiden's biggest moments?"}
              rows={4}
              style={{width:"100%",boxSizing:"border-box",resize:"vertical",padding:"12px 14px",border:"1px solid var(--border)",borderRadius:10,fontSize:14,fontFamily:"inherit",background:"var(--card)",color:"var(--ink-1)"}}
            />
          </div>
          <div style={{display:"flex",justifyContent:"flex-end"}}>
            <button className="save-btn" onClick={()=>generateReflection(reflectPrompt)} disabled={reflecting||!reflectPrompt.trim()}
              style={{minWidth:100}}>
              {reflecting ? <><span className="spin"/> Writing…</> : "✨ Send"}
            </button>
          </div>

          {reflection && (
            <div className="reflect-card" style={{marginTop:16, background: reflection.startsWith("Error:") ? "#fff0f0" : undefined}}>
              <div className="reflect-title">{reflection.startsWith("Error:") ? "⚠️ Something went wrong" : "✨ Reflection"}</div>
              <div className="reflect-body">{reflection}</div>
            </div>
          )}

          {journal.entries.length === 0 && (
            <div className="empty" style={{marginTop:24}}>
              <div className="empty-icon">✨</div>
              <div className="empty-msg">Your story is just beginning</div>
              <div className="empty-sub">Log some entries and come back for reflections</div>
            </div>
          )}

          {(journal.reflections?.length > 0) && (
            <div style={{marginTop:32}}>
              <div className="section-header">Past Reflections</div>
              {journal.reflections.map(r => (
                <div key={r.id}>
                  <div onClick={()=>setExpandedRefl(p=>({...p,[r.id]:!p[r.id]}))}
                    style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 4px",borderBottom:"1px solid var(--border)",cursor:"pointer"}}>
                    <div>
                      <span style={{fontSize:14,color:"var(--terra)"}}>✨ {r.prompt || "Reflection"}</span>
                      {r.dateRange && <span style={{fontSize:11,color:"var(--ink-3)",marginLeft:8}}>{r.dateRange}</span>}
                    </div>
                    <span style={{fontSize:12,color:"var(--ink-3)",whiteSpace:"nowrap",marginLeft:12}}>
                      {r.generatedAt ? new Date(r.generatedAt).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) : ""}
                    </span>
                  </div>
                  {expandedRefl[r.id] && (
                    <div className="reflect-body" style={{padding:"12px 4px",borderBottom:"1px solid var(--border)"}}>{r.text}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
