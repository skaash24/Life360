import { useState, useEffect, useRef, useCallback } from "react";

// ── CONFIG ──────────────────────────────────────────────────────────────────
const DRIVE_FILE_ID = "18Q9Z5OPQcoMO01gc-p8Wyg2OvcD5Ss4w";
const CALENDAR_FILE_ID = "1HbqJsEOuMUTGxfKYXGSadHX6bdCpHbwk";
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
  { id: "great",    icon: "✨", label: "Great"   },
  { id: "good",     icon: "😊", label: "Good"    },
  { id: "okay",     icon: "😐", label: "Okay"    },
  { id: "hard",     icon: "😔", label: "Hard"    },
  { id: "tough",    icon: "🌧️", label: "Tough"   },
  { id: "funny",    icon: "😂", label: "Funny"   },
  { id: "proud",    icon: "🦁", label: "Proud"   },
  { id: "grateful", icon: "🙏", label: "Grateful"},
];

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

const CALENDAR = {
  "2026-01-01": [
    {id:"ea427945",summary:"Gardener",start:"2026-01-01T12:00:00-08:00",end:"",allDay:false},
  ],
  "2026-01-06": [
    {id:"b5ede4a9",summary:"Review Beacon and Baywater projects",start:"2026-01-06T14:00:00-08:00",end:"",allDay:false},
  ],
  "2026-01-07": [
    {id:"565722eb",summary:"Basketball Practice",start:"2026-01-07T17:30:00-08:00",end:"",allDay:false},
  ],
  "2026-01-09": [
    {id:"82ed2629",summary:"Galactic Quest",start:"2026-01-09T15:00:00-08:00",end:"",allDay:false},
    {id:"70b61592",summary:"Mathnasium",start:"2026-01-09T16:00:00-08:00",end:"",allDay:false},
  ],
  "2026-01-10": [
    {id:"ef98ffde",summary:"Basketball Game",start:"2026-01-10T13:00:00-08:00",end:"",allDay:false},
  ],
  "2026-01-14": [
    {id:"207d8f85",summary:"Review Beacon and Baywater projects",start:"2026-01-14T14:00:00-08:00",end:"",allDay:false},
    {id:"0fc2590e",summary:"aiden MRI",start:"2026-01-14T16:15:00-08:00",end:"",allDay:false},
    {id:"e0f99bf2",summary:"Basketball Practice",start:"2026-01-14T17:30:00-08:00",end:"",allDay:false},
  ],
  "2026-01-15": [
    {id:"73632ea5",summary:"dentist appointment",start:"2026-01-15T11:00:00-08:00",end:"",allDay:false},
    {id:"89f1921e",summary:"Gardener",start:"2026-01-15T12:00:00-08:00",end:"",allDay:false},
  ],
  "2026-01-16": [
    {id:"d97650b8",summary:"Mathnasium",start:"2026-01-16T16:00:00-08:00",end:"",allDay:false},
  ],
  "2026-01-17": [
    {id:"4525e0bf",summary:"pick up snowboard",start:"2026-01-17T09:30:00-08:00",end:"",allDay:false},
    {id:"86b0352a",summary:"Basketball Game",start:"2026-01-17T14:00:00-08:00",end:"",allDay:false},
  ],
  "2026-01-18": [
    {id:"60d454a5",summary:"Drop off mom at the airport",start:"2026-01-18T05:30:00-08:00",end:"",allDay:false},
    {id:"65702f19",summary:"Ski at stevens",start:"2026-01-18T07:00:00-08:00",end:"",allDay:false},
  ],
  "2026-01-19": [
    {id:"b0cc5791",summary:"sienna oil change",start:"2026-01-19T08:00:00-08:00",end:"",allDay:false},
  ],
  "2026-01-21": [
    {id:"c5366947",summary:"Basketball Practice",start:"2026-01-21T17:30:00-08:00",end:"",allDay:false},
  ],
  "2026-01-23": [
    {id:"81a1a0e3",summary:"Mathnasium",start:"2026-01-23T16:00:00-08:00",end:"",allDay:false},
  ],
  "2026-01-24": [
    {id:"33cdf740",summary:"Basketball Game",start:"2026-01-24T15:00:00-08:00",end:"",allDay:false},
    {id:"374c282e",summary:"Rupesh house",start:"2026-01-24T18:00:00-08:00",end:"",allDay:false},
  ],
  "2026-01-25": [
    {id:"a6003d39",summary:"Galactic Quest II",start:"2026-01-25T10:00:00-08:00",end:"",allDay:false},
  ],
  "2026-01-28": [
    {id:"39b64e22",summary:"Review Beacon and Baywater projects",start:"2026-01-28T14:00:00-08:00",end:"",allDay:false},
    {id:"42bbc219",summary:"Basketball Practice",start:"2026-01-28T17:30:00-08:00",end:"",allDay:false},
  ],
  "2026-01-29": [
    {id:"8946361b",summary:"Gardener",start:"2026-01-29T12:00:00-08:00",end:"",allDay:false},
  ],
  "2026-01-30": [
    {id:"97e20c53",summary:"Mathnasium",start:"2026-01-30T16:00:00-08:00",end:"",allDay:false},
  ],
  "2026-01-31": [
    {id:"2621108e",summary:"Theo Bday at Skyzone",start:"2026-01-31T10:30:00-08:00",end:"",allDay:false},
    {id:"8f87648a",summary:"hair cut",start:"2026-01-31T13:00:00-08:00",end:"",allDay:false},
    {id:"c380384c",summary:"Basketball Game",start:"2026-01-31T16:00:00-08:00",end:"",allDay:false},
  ],
  "2026-02-04": [
    {id:"482a5021",summary:"Basketball Practice",start:"2026-02-04T17:30:00-08:00",end:"",allDay:false},
  ],
  "2026-02-05": [
    {id:"70dc39f1",summary:"Review Beacon and Baywater projects",start:"2026-02-05T13:00:00-08:00",end:"",allDay:false},
  ],
  "2026-02-06": [
    {id:"44221f37",summary:"Aiden Field Trip",start:"2026-02-06T08:00:00-08:00",end:"",allDay:false},
  ],
  "2026-02-07": [
    {id:"c9ca175f",summary:"Basketball Game",start:"2026-02-07T16:00:00-08:00",end:"",allDay:false},
    {id:"6ab18e99",summary:"Bellevue Sleep Test",start:"2026-02-07T19:30:00-08:00",end:"",allDay:false},
  ],
  "2026-02-08": [
    {id:"ac1f0b82",summary:"super bowl (pats vs. seahawks)",start:"2026-02-08T15:30:00-08:00",end:"",allDay:false},
  ],
  "2026-02-11": [
    {id:"d3a6b8c1",summary:"Basketball Practice",start:"2026-02-11T17:30:00-08:00",end:"",allDay:false},
  ],
  "2026-02-12": [
    {id:"8f94ffc2",summary:"Gardener",start:"2026-02-12T12:00:00-08:00",end:"",allDay:false},
    {id:"ecd9030d",summary:"Review Beacon and Baywater projects",start:"2026-02-12T13:00:00-08:00",end:"",allDay:false},
  ],
  "2026-02-13": [
    {id:"25a62fb1",summary:"Pick up DS",start:"2026-02-13T15:00:00-08:00",end:"",allDay:false},
    {id:"d0d5a083",summary:"Mathnasium",start:"2026-02-13T16:00:00-08:00",end:"",allDay:false},
  ],
  "2026-02-14": [
    {id:"06baa5ed",summary:"Seattle City Center/Pike's market",start:"2026-02-14T10:00:00-08:00",end:"",allDay:false},
  ],
  "2026-02-15": [
    {id:"8fe73a81",summary:"Snowqualmie Falls & Bellevue",start:"2026-02-15T10:00:00-08:00",end:"",allDay:false},
  ],
  "2026-02-16": [
    {id:"4899825c",summary:"Bainbridge and/or shopping",start:"2026-02-16T10:00:00-08:00",end:"",allDay:false},
  ],
  "2026-02-18": [
    {id:"bb899f55",summary:"Basketball Practice",start:"2026-02-18T17:30:00-08:00",end:"",allDay:false},
    {id:"15a01ddf",summary:"Flight to Ontario (AS 592)",start:"2026-02-18T20:05:00-08:00",end:"",allDay:false},
  ],
  "2026-02-19": [
    {id:"ca36093b",summary:"Review Beacon and Baywater projects",start:"2026-02-19T13:00:00-08:00",end:"",allDay:false},
  ],
  "2026-02-21": [
    {id:"89b5292f",summary:"Dinner at Daniel's house",start:"2026-02-21T18:00:00-08:00",end:"",allDay:false},
  ],
  "2026-02-25": [
    {id:"49fa3f8f",summary:"Basketball Practice",start:"2026-02-25T17:30:00-08:00",end:"",allDay:false},
  ],
  "2026-02-26": [
    {id:"3fa87484",summary:"Gardener",start:"2026-02-26T12:00:00-08:00",end:"",allDay:false},
    {id:"34637df5",summary:"Review Beacon and Baywater projects",start:"2026-02-26T13:00:00-08:00",end:"",allDay:false},
  ],
  "2026-02-27": [
    {id:"cf51bb64",summary:"Mathnasium",start:"2026-02-27T16:00:00-08:00",end:"",allDay:false},
  ],
  "2026-02-28": [
    {id:"997fe267",summary:"Basketball Game",start:"2026-02-28T14:00:00-08:00",end:"",allDay:false},
  ],
  "2026-03-01": [
    {id:"99b4c6c1",summary:"ski",start:"2026-03-01T07:00:00-08:00",end:"",allDay:false},
  ],
  "2026-03-04": [
    {id:"1c6efb4a",summary:"Basketball Practice",start:"2026-03-04T17:30:00-08:00",end:"",allDay:false},
  ],
  "2026-03-05": [
    {id:"d3fa459f",summary:"Review Beacon and Baywater projects",start:"2026-03-05T13:00:00-08:00",end:"",allDay:false},
  ],
  "2026-03-06": [
    {id:"7a88583f",summary:"Mathnasium",start:"2026-03-06T16:00:00-08:00",end:"",allDay:false},
  ],
  "2026-03-07": [
    {id:"d6180502",summary:"Basketball Game",start:"2026-03-07T13:00:00-08:00",end:"",allDay:false},
  ],
  "2026-03-11": [
    {id:"3bdc300e",summary:"Basketball Practice",start:"2026-03-11T17:30:00-07:00",end:"",allDay:false},
  ],
  "2026-03-12": [
    {id:"f30016a5",summary:"Gardener",start:"2026-03-12T12:00:00-07:00",end:"",allDay:false},
    {id:"f77e9e8a",summary:"Review Beacon and Baywater projects",start:"2026-03-12T13:00:00-07:00",end:"",allDay:false},
  ],
  "2026-03-13": [
    {id:"0cd0970b",summary:"Mathnasium",start:"2026-03-13T16:00:00-07:00",end:"",allDay:false},
  ],
  "2026-03-14": [
    {id:"9cd008ed",summary:"Cancel Peacock",start:"2026-03-14T08:00:00-07:00",end:"",allDay:false},
  ],
  "2026-03-19": [
    {id:"0815bb03",summary:"Review Beacon and Baywater projects",start:"2026-03-19T14:30:00-07:00",end:"",allDay:false},
  ],
  "2026-03-20": [
    {id:"a8904d79",summary:"Mathnasium",start:"2026-03-20T16:00:00-07:00",end:"",allDay:false},
  ],
  "2026-03-21": [
    {id:"cc6a4f2a",summary:"dinner w/ rupesh",start:"2026-03-21T17:00:00-07:00",end:"",allDay:false},
  ],
  "2026-03-22": [
    {id:"3fda8518",summary:"Baseball practice",start:"2026-03-22T13:00:00-07:00",end:"",allDay:false},
  ],
  "2026-03-25": [
    {id:"7838b101",summary:"Baseball practice",start:"2026-03-25T18:00:00-07:00",end:"",allDay:false},
  ],
  "2026-03-26": [
    {id:"5ed92c1f",summary:"Gardener",start:"2026-03-26T12:00:00-07:00",end:"",allDay:false},
    {id:"c6755f16",summary:"Review Beacon and Baywater projects",start:"2026-03-26T14:00:00-07:00",end:"",allDay:false},
  ],
  "2026-03-27": [
    {id:"62c4cb23",summary:"Mathnasium",start:"2026-03-27T16:00:00-07:00",end:"",allDay:false},
  ],
  "2026-03-28": [
    {id:"fba3b012",summary:"Korean School - Aiden",start:"2026-03-28T09:30:00-07:00",end:"",allDay:false},
    {id:"6e6f7546",summary:"Hair cut",start:"2026-03-28T12:00:00-07:00",end:"",allDay:false},
    {id:"4fd56be4",summary:"Baseball - James Baldwin elementary",start:"2026-03-28T15:15:00-07:00",end:"",allDay:false},
  ],
  "2026-03-29": [
    {id:"eff43eda",summary:"Cherry Blossom/UV",start:"2026-03-29T10:00:00-07:00",end:"",allDay:false},
  ],
  "2026-04-01": [
    {id:"_6d1jahhp61330b9k6or3cb9k8p330ba27524ab9l74o3idi46d0jacpn84_20260402T010000Z",summary:"baseball practice",start:"2026-04-01T18:00:00-07:00",end:"2026-04-01T19:00:00-07:00",allDay:false},
  ],
  "2026-04-02": [
    {id:"ncht1rksj1s18rn0amdqdqp191_20260402T210000Z",summary:"Review Beacon and Baywater projects",start:"2026-04-02T12:00:00-07:00",end:"2026-04-02T13:00:00-07:00",allDay:false},
  ],
  "2026-04-03": [
    {id:"94kirt6csdtq9prki29a243cjg_20260403",summary:"Sharon Mom's Bday",start:"",end:"",allDay:true},
    {id:"1504d04rbf9qb7lllqot8jmqrj_20260403T230000Z",summary:"Mathnasium",start:"2026-04-03T17:00:00-07:00",end:"2026-04-03T18:00:00-07:00",allDay:false},
  ],
  "2026-04-04": [
    {id:"0pnj98iu6cpeung85ud85d88kj_20260404T163000Z",summary:"Korean School - Aiden",start:"2026-04-04T09:30:00-07:00",end:"2026-04-04T12:00:00-07:00",allDay:false},
    {id:"_8p2jcci46t13ab9j8534ab9k8kpk4b9o7523cba564sjacpl70pjechm84_20260404T221500Z",summary:"Baseball - James Baldwin elementary ",start:"2026-04-04T15:15:00-07:00",end:"2026-04-04T16:15:00-07:00",allDay:false},
  ],
  "2026-04-05": [
    {id:"11ph3snsc4ndjfgmrsvdif03i4",summary:"Easter egg hunt",start:"2026-04-05T09:00:00-07:00",end:"2026-04-05T10:00:00-07:00",allDay:false},
    {id:"2j65cjbu79vov38imjnnq3q845",summary:"Ride Bike to UV",start:"2026-04-05T11:00:00-07:00",end:"2026-04-05T16:00:00-07:00",allDay:false},
  ],
  "2026-04-06": [
    {id:"1lp6pbqst0340dhn01nlp1hhab",summary:"Aubree Spring Break",start:"",end:"",allDay:true},
  ],
  "2026-04-07": [
    {id:"_8cqkaca56gp46b9o6gs30b9k8kok6b9p8kq30b9m68p44e1j6h33icq66o_20260407",summary:"Charlie's bday",start:"",end:"",allDay:true},
  ],
  "2026-04-08": [
    {id:"_6l24ah9p68o42ba4751k6b9k891kaba26gr3cb9o88r44ghh84r3ie1j6o_20260408",summary:"ray k bday",start:"",end:"",allDay:true},
    {id:"_6d1jahhp61330b9k6or3cb9k8p330ba27524ab9l74o3idi46d0jacpn84_20260409T010000Z",summary:"baseball practice",start:"2026-04-08T18:00:00-07:00",end:"2026-04-08T19:00:00-07:00",allDay:false},
  ],
  "2026-04-09": [
    {id:"cmsvbrgtnm7424l677dvggjdot_20260409T190000Z",summary:"Gardener",start:"2026-04-09T12:00:00-07:00",end:"2026-04-09T13:00:00-07:00",allDay:false},
    {id:"ncht1rksj1s18rn0amdqdqp191_20260409T210000Z",summary:"Review Beacon and Baywater projects",start:"2026-04-09T14:00:00-07:00",end:"2026-04-09T15:00:00-07:00",allDay:false},
  ],
  "2026-04-10": [
    {id:"_6cr46ci464r46b9g6co3gb9k6p1j0b9p8oojeb9o6934ae9h8orjgea48g_20260410",summary:"jonathan bday",start:"",end:"",allDay:true},
    {id:"1504d04rbf9qb7lllqot8jmqrj_20260410T230000Z",summary:"Mathnasium",start:"2026-04-10T16:00:00-07:00",end:"2026-04-10T17:00:00-07:00",allDay:false},
  ],
  "2026-04-11": [
    {id:"0pnj98iu6cpeung85ud85d88kj_20260411T163000Z",summary:"Korean School - Aiden",start:"2026-04-11T09:30:00-07:00",end:"2026-04-11T12:00:00-07:00",allDay:false},
    {id:"_8p2jcci46t13ab9j8534ab9k8kpk4b9o7523cba564sjacpl70pjechm84_20260411T221500Z",summary:"Baseball - James Baldwin elementary ",start:"2026-04-11T15:15:00-07:00",end:"2026-04-11T16:15:00-07:00",allDay:false},
    {id:"5sakkncvo92tl299auu30phb19",summary:"Tax time",start:"2026-04-11T20:30:00-07:00",end:"2026-04-11T23:00:00-07:00",allDay:false},
  ],
  "2026-04-13": [
    {id:"5vgmmo4ja64c2246efes3lu5j2",summary:"Aiden Spring Break",start:"",end:"",allDay:true},
  ],
  "2026-04-15": [
    {id:"58buohq8gbnenar4hde0dkb1pr",summary:"Whistler",start:"",end:"",allDay:true},
  ],
  "2026-04-16": [
    {id:"ncht1rksj1s18rn0amdqdqp191_20260416T210000Z",summary:"Review Beacon and Baywater projects",start:"2026-04-16T14:00:00-07:00",end:"2026-04-16T15:00:00-07:00",allDay:false},
    {id:"upfc8oqc0mrgprb1fb0vp4u3b8",summary:"Case Condition Clearance",start:"2026-04-16T15:00:00-07:00",end:"2026-04-16T16:00:00-07:00",allDay:false},
  ],
  "2026-04-17": [
    {id:"1504d04rbf9qb7lllqot8jmqrj_20260417T230000Z",summary:"Mathnasium",start:"2026-04-17T16:00:00-07:00",end:"2026-04-17T17:00:00-07:00",allDay:false},
  ],
  "2026-04-18": [
    {id:"1kf35d7tkl3isf6etu4n6mds8e",summary:"drive home (stop by surrey for lunch)",start:"2026-04-18T09:00:00-07:00",end:"2026-04-18T16:00:00-07:00",allDay:false},
  ],
  "2026-04-19": [
    {id:"bj91tltkg49583k69ptgk6i2no_20260419",summary:"My Bday",start:"",end:"",allDay:true},
  ],
  "2026-04-20": [
    {id:"25e3hnbps4c8g5v91h67hrt0a2",summary:"AppMod offsite in Austin",start:"",end:"",allDay:true},
  ],
  "2026-04-23": [
    {id:"cmsvbrgtnm7424l677dvggjdot_20260423T190000Z",summary:"Gardener",start:"2026-04-23T12:00:00-07:00",end:"2026-04-23T13:00:00-07:00",allDay:false},
    {id:"ncht1rksj1s18rn0amdqdqp191_20260423T210000Z",summary:"Review Beacon and Baywater projects",start:"2026-04-23T14:00:00-07:00",end:"2026-04-23T15:00:00-07:00",allDay:false},
  ],
  "2026-04-24": [
    {id:"1504d04rbf9qb7lllqot8jmqrj_20260424T230000Z",summary:"Mathnasium",start:"2026-04-24T16:00:00-07:00",end:"2026-04-24T17:00:00-07:00",allDay:false},
  ],
  "2026-04-25": [
    {id:"0pnj98iu6cpeung85ud85d88kj_20260425T163000Z",summary:"Korean School - Aiden",start:"2026-04-25T09:30:00-07:00",end:"2026-04-25T12:00:00-07:00",allDay:false},
    {id:"592rfmrle06gv7tdifv8q5kbro",summary:"Baseball Game",start:"2026-04-25T13:30:00-07:00",end:"2026-04-25T15:30:00-07:00",allDay:false},
    {id:"4rh3f0snptq80k8j9i4qedeckh",summary:"Costco/HM mart",start:"2026-04-25T15:30:00-07:00",end:"2026-04-25T17:00:00-07:00",allDay:false},
  ],
  "2026-04-26": [
    {id:"2jd1bq478aec5f1rrvvqm50o0c",summary:"Mercer bday party",start:"2026-04-26T10:00:00-07:00",end:"2026-04-26T12:30:00-07:00",allDay:false},
    {id:"7s8drh9v9bt8po1ddq737vtq5s",summary:"Spring cleaning (Grill and plant flowers)",start:"2026-04-26T10:00:00-07:00",end:"2026-04-26T11:30:00-07:00",allDay:false},
    {id:"0l2psl67hhgr1rbbau16o583q4",summary:"Maple Leaf playtime ",start:"2026-04-26T13:00:00-07:00",end:"2026-04-26T15:30:00-07:00",allDay:false},
  ],
  "2026-04-27": [
    {id:"034qpr058gqljacdvmcjsoogvo_20260427T230000Z",summary:"pick up aiden",start:"2026-04-27T16:00:00-07:00",end:"2026-04-27T17:00:00-07:00",allDay:false},
  ],
  "2026-04-28": [],
  "2026-04-29": [
    {id:"ckaqsktepecl00ulnqgbnaeg18_20260430",summary:"Anisha's Bday",start:"",end:"",allDay:true},
    {id:"ncht1rksj1s18rn0amdqdqp191_20260430T210000Z",summary:"Review Beacon and Baywater projects",start:"2026-04-30T14:00:00-07:00",end:"2026-04-30T15:00:00-07:00",allDay:false},
  ],
  "2026-05-01": [
    {id:"1504d04rbf9qb7lllqot8jmqrj_20260501T230000Z",summary:"Mathnasium",start:"2026-05-01T16:00:00-07:00",end:"2026-05-01T17:00:00-07:00",allDay:false},
  ],
  "2026-05-02": [
    {id:"0pnj98iu6cpeung85ud85d88kj_20260502T163000Z",summary:"Korean School - Aiden",start:"2026-05-02T09:30:00-07:00",end:"2026-05-02T12:00:00-07:00",allDay:false},
    {id:"2etbv67sskuu9pdh1kqfrdlic5",summary:"baseball game",start:"2026-05-02T12:00:00-07:00",end:"2026-05-02T14:00:00-07:00",allDay:false},
  ],
  "2026-05-03": [
    {id:"1le0t2ec555pfc1maqo3l9gtli",summary:"Shane bday party",start:"2026-05-03T13:00:00-07:00",end:"2026-05-03T15:00:00-07:00",allDay:false},
    {id:"63icdno0h04b5hulv2ffhghfsl",summary:"Quinn Bday Party",start:"2026-05-03T15:00:00-07:00",end:"2026-05-03T17:00:00-07:00",allDay:false},
  ],
  "2026-05-04": [
    {id:"034qpr058gqljacdvmcjsoogvo_20260504T230000Z",summary:"pick up aiden",start:"2026-05-04T16:00:00-07:00",end:"2026-05-04T17:00:00-07:00",allDay:false},
  ],
  "2026-05-07": [
    {id:"cmsvbrgtnm7424l677dvggjdot_20260507T190000Z",summary:"Gardener",start:"2026-05-07T12:00:00-07:00",end:"2026-05-07T13:00:00-07:00",allDay:false},
    {id:"ncht1rksj1s18rn0amdqdqp191_20260507T210000Z",summary:"Review Beacon and Baywater projects",start:"2026-05-07T14:00:00-07:00",end:"2026-05-07T15:00:00-07:00",allDay:false},
  ],
  "2026-05-08": [
    {id:"1504d04rbf9qb7lllqot8jmqrj_20260508T230000Z",summary:"Mathnasium",start:"2026-05-08T16:00:00-07:00",end:"2026-05-08T17:00:00-07:00",allDay:false},
    {id:"0pnj98iu6cpeung85ud85d88kj_20260509T163000Z",summary:"Korean School - Aiden",start:"2026-05-08T18:00:00-07:00",end:"2026-05-08T21:00:00-07:00",allDay:false},
  ],
  "2026-05-09": [
    {id:"6n0ggndgc9svj5d2567b8ku2d0",summary:"baseball game",start:"2026-05-09T10:00:00-07:00",end:"2026-05-09T12:00:00-07:00",allDay:false},
  ],
  "2026-05-10": [
    {id:"r7q8fode2ekpmpjm2cleprd30g_20260510",summary:"Sharon's Dad Bday",start:"",end:"",allDay:true},
  ],
  "2026-05-11": [
    {id:"7h8p42e34ohsk3ortpbr7farn0_20260511",summary:"Wedding Anniversary",start:"",end:"",allDay:true},
    {id:"034qpr058gqljacdvmcjsoogvo_20260511T230000Z",summary:"pick up aiden",start:"2026-05-11T16:00:00-07:00",end:"2026-05-11T17:00:00-07:00",allDay:false},
  ],
  "2026-05-12": [
    {id:"4dtpu6g9eqtbrdmmek0i25kbak_20260512",summary:"Haley's Bday",start:"",end:"",allDay:true},
  ],
  "2026-05-14": [
    {id:"ncht1rksj1s18rn0amdqdqp191_20260514T210000Z",summary:"Review Beacon and Baywater projects",start:"2026-05-14T14:00:00-07:00",end:"2026-05-14T15:00:00-07:00",allDay:false},
  ],
  "2026-05-15": [
    {id:"08rjqv8u1qgov60r76cnvd528v_20260515",summary:"Aubree Bday",start:"",end:"",allDay:true},
    {id:"1504d04rbf9qb7lllqot8jmqrj_20260515T230000Z",summary:"Mathnasium",start:"2026-05-15T16:00:00-07:00",end:"2026-05-15T17:00:00-07:00",allDay:false},
  ],
  "2026-05-16": [
    {id:"0pnj98iu6cpeung85ud85d88kj_20260516T163000Z",summary:"Korean School - Aiden",start:"2026-05-16T09:30:00-07:00",end:"2026-05-16T12:00:00-07:00",allDay:false},
    {id:"2529ori6e8ieohsgjsqb5q9jsn",summary:"Baseball Game",start:"2026-05-16T13:30:00-07:00",end:"2026-05-16T15:30:00-07:00",allDay:false},
  ],
  "2026-05-17": [
    {id:"5sjhatugdhgoaokj23e7sql6l2",summary:"Aubree Bday Party",start:"2026-05-17T11:00:00-07:00",end:"2026-05-17T14:00:00-07:00",allDay:false},
  ],
  "2026-05-18": [
    {id:"034qpr058gqljacdvmcjsoogvo_20260518T230000Z",summary:"pick up aiden",start:"2026-05-18T16:00:00-07:00",end:"2026-05-18T17:00:00-07:00",allDay:false},
  ],
  "2026-05-21": [
    {id:"cmsvbrgtnm7424l677dvggjdot_20260521T190000Z",summary:"Gardener",start:"2026-05-21T12:00:00-07:00",end:"2026-05-21T13:00:00-07:00",allDay:false},
    {id:"ncht1rksj1s18rn0amdqdqp191_20260521T210000Z",summary:"Review Beacon and Baywater projects",start:"2026-05-21T14:00:00-07:00",end:"2026-05-21T15:00:00-07:00",allDay:false},
  ],
  "2026-05-22": [
    {id:"aik7ps17upp8ujv8b1subj2eq0_20260522",summary:"Chi's Bday",start:"",end:"",allDay:true},
    {id:"1504d04rbf9qb7lllqot8jmqrj_20260522T230000Z",summary:"Mathnasium",start:"2026-05-22T16:00:00-07:00",end:"2026-05-22T17:00:00-07:00",allDay:false},
  ],
  "2026-05-23": [
    {id:"1jg1g80slc624ktn4mdnfdtlui",summary:"Suncadia Resort at Hyatt (",start:"",end:"",allDay:true},
    {id:"0pnj98iu6cpeung85ud85d88kj_20260523T163000Z",summary:"Korean School - Aiden",start:"2026-05-23T09:30:00-07:00",end:"2026-05-23T12:00:00-07:00",allDay:false},
  ],
  "2026-05-25": [
    {id:"_65338hhi70r3cb9p6so44b9k64sk6b9o88p4cb9m8gpj4dpk8cqj8gi664_20260525",summary:"Elai's bday",start:"",end:"",allDay:true},
    {id:"034qpr058gqljacdvmcjsoogvo_20260525T230000Z",summary:"pick up aiden",start:"2026-05-25T16:00:00-07:00",end:"2026-05-25T17:00:00-07:00",allDay:false},
  ],
  "2026-05-28": [
    {id:"ncht1rksj1s18rn0amdqdqp191_20260528T210000Z",summary:"Review Beacon and Baywater projects",start:"2026-05-28T14:00:00-07:00",end:"2026-05-28T15:00:00-07:00",allDay:false},
  ],
  "2026-05-29": [
    {id:"1504d04rbf9qb7lllqot8jmqrj_20260529T230000Z",summary:"Mathnasium",start:"2026-05-29T16:00:00-07:00",end:"2026-05-29T17:00:00-07:00",allDay:false},
  ],
  "2026-05-30": [
    {id:"0pnj98iu6cpeung85ud85d88kj_20260530T163000Z",summary:"Korean School - Aiden",start:"2026-05-30T09:30:00-07:00",end:"2026-05-30T12:00:00-07:00",allDay:false},
  ],
  "2026-06-01": [
    {id:"034qpr058gqljacdvmcjsoogvo_20260601T230000Z",summary:"pick up aiden",start:"2026-06-01T16:00:00-07:00",end:"2026-06-01T17:00:00-07:00",allDay:false},
  ],
  "2026-06-02": [
    {id:"ov136cb1abclta7vdgk4ukbv6o_20260602",summary:"Christian Bday",start:"",end:"",allDay:true},
  ],
  "2026-06-04": [
    {id:"cmsvbrgtnm7424l677dvggjdot_20260604T190000Z",summary:"Gardener",start:"2026-06-04T12:00:00-07:00",end:"2026-06-04T13:00:00-07:00",allDay:false},
    {id:"ncht1rksj1s18rn0amdqdqp191_20260604T210000Z",summary:"Review Beacon and Baywater projects",start:"2026-06-04T14:00:00-07:00",end:"2026-06-04T15:00:00-07:00",allDay:false},
  ],
  "2026-06-05": [
    {id:"1504d04rbf9qb7lllqot8jmqrj_20260605T230000Z",summary:"Mathnasium",start:"2026-06-05T16:00:00-07:00",end:"2026-06-05T17:00:00-07:00",allDay:false},
  ],
  "2026-06-06": [
    {id:"2ou23qkh62k5o8n7st9shackik",summary:"Aubree LA trip",start:"",end:"",allDay:true},
    {id:"jjvlo3mm2t14145u3ldpu2s7v4_20260606",summary:"Xavi Bday",start:"",end:"",allDay:true},
    {id:"t6j6adi9o680ml47cqh4bvel5s_20260606",summary:"Cnote's Bday",start:"",end:"",allDay:true},
    {id:"0pnj98iu6cpeung85ud85d88kj_20260606T163000Z",summary:"Korean School - Aiden",start:"2026-06-06T09:30:00-07:00",end:"2026-06-06T12:00:00-07:00",allDay:false},
  ],
  "2026-06-08": [
    {id:"034qpr058gqljacdvmcjsoogvo_20260608T230000Z",summary:"pick up aiden",start:"2026-06-08T16:00:00-07:00",end:"2026-06-08T17:00:00-07:00",allDay:false},
  ],
  "2026-06-11": [
    {id:"ncht1rksj1s18rn0amdqdqp191_20260611T210000Z",summary:"Review Beacon and Baywater projects",start:"2026-06-11T14:00:00-07:00",end:"2026-06-11T15:00:00-07:00",allDay:false},
  ],
  "2026-06-12": [
    {id:"2st0qa2t4npaft8hu609noteok_20260612",summary:"Jay's Bday ",start:"",end:"",allDay:true},
    {id:"1504d04rbf9qb7lllqot8jmqrj_20260612T230000Z",summary:"Mathnasium",start:"2026-06-12T16:00:00-07:00",end:"2026-06-12T17:00:00-07:00",allDay:false},
  ],
  "2026-06-13": [
    {id:"0pnj98iu6cpeung85ud85d88kj_20260613T163000Z",summary:"Korean School - Aiden",start:"2026-06-13T09:30:00-07:00",end:"2026-06-13T12:00:00-07:00",allDay:false},
  ],
  "2026-06-15": [
    {id:"034qpr058gqljacdvmcjsoogvo_20260615T230000Z",summary:"pick up aiden",start:"2026-06-15T16:00:00-07:00",end:"2026-06-15T17:00:00-07:00",allDay:false},
  ],
  "2026-06-18": [
    {id:"cmsvbrgtnm7424l677dvggjdot_20260618T190000Z",summary:"Gardener",start:"2026-06-18T12:00:00-07:00",end:"2026-06-18T13:00:00-07:00",allDay:false},
    {id:"ncht1rksj1s18rn0amdqdqp191_20260618T210000Z",summary:"Review Beacon and Baywater projects",start:"2026-06-18T14:00:00-07:00",end:"2026-06-18T15:00:00-07:00",allDay:false},
  ],
  "2026-06-19": [
    {id:"1504d04rbf9qb7lllqot8jmqrj_20260619T230000Z",summary:"Mathnasium",start:"2026-06-19T16:00:00-07:00",end:"2026-06-19T17:00:00-07:00",allDay:false},
  ],
  "2026-06-20": [
    {id:"0pnj98iu6cpeung85ud85d88kj_20260620T163000Z",summary:"Korean School - Aiden",start:"2026-06-20T09:30:00-07:00",end:"2026-06-20T12:00:00-07:00",allDay:false},
  ],
  "2026-06-22": [
    {id:"2fviusbkgj3bsfsg7o9d1doval",summary:"potential LA trip",start:"",end:"",allDay:true},
    {id:"_6ss36ga16csj6b9k6csj2b9k60qjaba28923aba56cs3egq46133gh218o_20260622",summary:"Steven Bday",start:"",end:"",allDay:true},
    {id:"_8or3agph6l2j4ba36sok2b9k8ks42ba28p146b9m70o3ac9o6srk2da56g_20260622",summary:"joo ahn bday",start:"",end:"",allDay:true},
  ],
  "2026-06-25": [
    {id:"ncht1rksj1s18rn0amdqdqp191_20260625T210000Z",summary:"Review Beacon and Baywater projects",start:"2026-06-25T14:00:00-07:00",end:"2026-06-25T15:00:00-07:00",allDay:false},
  ],
  "2026-06-26": [
    {id:"1504d04rbf9qb7lllqot8jmqrj_20260626T230000Z",summary:"Mathnasium",start:"2026-06-26T16:00:00-07:00",end:"2026-06-26T17:00:00-07:00",allDay:false},
  ],
  "2026-06-27": [
    {id:"_88sj4h258l148b9l70pj0b9k64oj4ba18523cb9h85330g9o6h1jgdpi6o_20260627",summary:"JP Bday",start:"",end:"",allDay:true},
    {id:"0pnj98iu6cpeung85ud85d88kj_20260627T163000Z",summary:"Korean School - Aiden",start:"2026-06-27T09:30:00-07:00",end:"2026-06-27T12:00:00-07:00",allDay:false},
  ],
  "2026-06-29": [
    {id:"767721ipd06mufqqplk09ltrdk_20260629",summary:"Zackary Bday",start:"",end:"",allDay:true},
  ],
  "2026-07-01": [
    {id:"41o8i0aiv888bd0q3orq7adb10",summary:"North Cascades",start:"",end:"",allDay:true},
  ],
  "2026-07-02": [
    {id:"cmsvbrgtnm7424l677dvggjdot_20260702T190000Z",summary:"Gardener",start:"2026-07-02T12:00:00-07:00",end:"2026-07-02T13:00:00-07:00",allDay:false},
    {id:"ncht1rksj1s18rn0amdqdqp191_20260702T210000Z",summary:"Review Beacon and Baywater projects",start:"2026-07-02T14:00:00-07:00",end:"2026-07-02T15:00:00-07:00",allDay:false},
  ],
  "2026-07-03": [
    {id:"1504d04rbf9qb7lllqot8jmqrj_20260703T230000Z",summary:"Mathnasium",start:"2026-07-03T16:00:00-07:00",end:"2026-07-03T17:00:00-07:00",allDay:false},
  ],
  "2026-07-09": [
    {id:"ncht1rksj1s18rn0amdqdqp191_20260709T210000Z",summary:"Review Beacon and Baywater projects",start:"2026-07-09T14:00:00-07:00",end:"2026-07-09T15:00:00-07:00",allDay:false},
  ],
  "2026-07-10": [
    {id:"nd57k3iqur6eijkfuskupb9404_20260710",summary:"Kenny Bday",start:"",end:"",allDay:true},
    {id:"taibqj6giclf5cj8eaqq6c22i4_20260710",summary:"Jason Ma Bday",start:"",end:"",allDay:true},
    {id:"1504d04rbf9qb7lllqot8jmqrj_20260710T230000Z",summary:"Mathnasium",start:"2026-07-10T16:00:00-07:00",end:"2026-07-10T17:00:00-07:00",allDay:false},
  ],
  "2026-07-16": [
    {id:"_752j8ea175248ba66gs38b9k6osk6b9o6sr3iba589238ga264rjeg9j6s_20260716",summary:"Congo's Bday",start:"",end:"",allDay:true},
    {id:"cmsvbrgtnm7424l677dvggjdot_20260716T190000Z",summary:"Gardener",start:"2026-07-16T12:00:00-07:00",end:"2026-07-16T13:00:00-07:00",allDay:false},
    {id:"ncht1rksj1s18rn0amdqdqp191_20260716T210000Z",summary:"Review Beacon and Baywater projects",start:"2026-07-16T14:00:00-07:00",end:"2026-07-16T15:00:00-07:00",allDay:false},
  ],
  "2026-07-17": [
    {id:"1504d04rbf9qb7lllqot8jmqrj_20260717T230000Z",summary:"Mathnasium",start:"2026-07-17T16:00:00-07:00",end:"2026-07-17T17:00:00-07:00",allDay:false},
  ],
  "2026-07-18": [
    {id:"mnsvkmh83vmpspn2far9l42up4_20260718",summary:"Matt Mather Bday",start:"",end:"",allDay:true},
  ],
  "2026-07-23": [
    {id:"ncht1rksj1s18rn0amdqdqp191_20260723T210000Z",summary:"Review Beacon and Baywater projects",start:"2026-07-23T14:00:00-07:00",end:"2026-07-23T15:00:00-07:00",allDay:false},
  ],
  "2026-07-24": [
    {id:"1504d04rbf9qb7lllqot8jmqrj_20260724T230000Z",summary:"Mathnasium",start:"2026-07-24T16:00:00-07:00",end:"2026-07-24T17:00:00-07:00",allDay:false},
  ],
  "2026-07-29": [
    {id:"1ff2ovv36adsq4uvm76jq5uak2",summary:"Mexico/Cabo",start:"",end:"",allDay:true},
  ],
  "2026-07-30": [
    {id:"cmsvbrgtnm7424l677dvggjdot_20260730T190000Z",summary:"Gardener",start:"2026-07-30T12:00:00-07:00",end:"2026-07-30T13:00:00-07:00",allDay:false},
    {id:"ncht1rksj1s18rn0amdqdqp191_20260730T210000Z",summary:"Review Beacon and Baywater projects",start:"2026-07-30T14:00:00-07:00",end:"2026-07-30T15:00:00-07:00",allDay:false},
  ],
  "2026-07-31": [
    {id:"0ki3c0oljp7g280h8qont4b3ic_20260731",summary:"DaeSuk Bday",start:"",end:"",allDay:true},
    {id:"1504d04rbf9qb7lllqot8jmqrj_20260731T230000Z",summary:"Mathnasium",start:"2026-07-31T16:00:00-07:00",end:"2026-07-31T17:00:00-07:00",allDay:false},
  ],
  "2026-08-02": [
    {id:"_8d33ecq26kr34b9m70s4ab9k8l2j2b9p8513cba36l1j4d1g8cr34c1h8o_20260802",summary:"Chaith's Bday",start:"",end:"",allDay:true},
  ],
  "2026-08-06": [
    {id:"ncht1rksj1s18rn0amdqdqp191_20260806T210000Z",summary:"Review Beacon and Baywater projects",start:"2026-08-06T14:00:00-07:00",end:"2026-08-06T15:00:00-07:00",allDay:false},
  ],
  "2026-08-07": [
    {id:"1504d04rbf9qb7lllqot8jmqrj_20260807T230000Z",summary:"Mathnasium",start:"2026-08-07T16:00:00-07:00",end:"2026-08-07T17:00:00-07:00",allDay:false},
  ],
  "2026-08-13": [
    {id:"sjur3po75r2ia8mjbl7l6mdjo8_20260813",summary:"Father's Memorial Day",start:"",end:"",allDay:true},
    {id:"cmsvbrgtnm7424l677dvggjdot_20260813T190000Z",summary:"Gardener",start:"2026-08-13T12:00:00-07:00",end:"2026-08-13T13:00:00-07:00",allDay:false},
    {id:"ncht1rksj1s18rn0amdqdqp191_20260813T210000Z",summary:"Review Beacon and Baywater projects",start:"2026-08-13T14:00:00-07:00",end:"2026-08-13T15:00:00-07:00",allDay:false},
  ],
  "2026-08-14": [
    {id:"1504d04rbf9qb7lllqot8jmqrj_20260814T230000Z",summary:"Mathnasium",start:"2026-08-14T16:00:00-07:00",end:"2026-08-14T17:00:00-07:00",allDay:false},
  ],
  "2026-08-15": [
    {id:"0m7sk2o54l69l88q83kfkiqtjq",summary:"Sister visiting",start:"",end:"",allDay:true},
  ],
  "2026-08-16": [
    {id:"_6t1k4dq488sjeba5650jcb9k6srj0ba160r44ba675242cpo64rk2dph64_20260816",summary:"Jaume's Bday",start:"",end:"",allDay:true},
    {id:"_70qjcghg60sj2b9j74r4ab9k6t2kcb9o60qjib9p6orjicpk8p346da16s_20260816",summary:"Julia's Bday",start:"",end:"",allDay:true},
  ],
  "2026-08-20": [
    {id:"518dqkn3nc01qabvafu7obaemr",summary:"Vancouver",start:"",end:"",allDay:true},
    {id:"ncht1rksj1s18rn0amdqdqp191_20260820T210000Z",summary:"Review Beacon and Baywater projects",start:"2026-08-20T14:00:00-07:00",end:"2026-08-20T15:00:00-07:00",allDay:false},
  ],
  "2026-08-21": [
    {id:"1504d04rbf9qb7lllqot8jmqrj_20260821T230000Z",summary:"Mathnasium",start:"2026-08-21T16:00:00-07:00",end:"2026-08-21T17:00:00-07:00",allDay:false},
  ],
  "2026-08-26": [
    {id:"_712k4d218933iba46go38b9k6ko4ab9o8grj6b9h88p32d9k61148chn6c_20260826",summary:"Mauricio bday",start:"",end:"",allDay:true},
  ],
  "2026-08-27": [
    {id:"cmsvbrgtnm7424l677dvggjdot_20260827T190000Z",summary:"Gardener",start:"2026-08-27T12:00:00-07:00",end:"2026-08-27T13:00:00-07:00",allDay:false},
    {id:"ncht1rksj1s18rn0amdqdqp191_20260827T210000Z",summary:"Review Beacon and Baywater projects",start:"2026-08-27T14:00:00-07:00",end:"2026-08-27T15:00:00-07:00",allDay:false},
  ],
  "2026-08-28": [
    {id:"1504d04rbf9qb7lllqot8jmqrj_20260828T230000Z",summary:"Mathnasium",start:"2026-08-28T16:00:00-07:00",end:"2026-08-28T17:00:00-07:00",allDay:false},
  ],
  "2026-09-03": [
    {id:"ncht1rksj1s18rn0amdqdqp191_20260903T210000Z",summary:"Review Beacon and Baywater projects",start:"2026-09-03T14:00:00-07:00",end:"2026-09-03T15:00:00-07:00",allDay:false},
  ],
  "2026-09-04": [
    {id:"1504d04rbf9qb7lllqot8jmqrj_20260904T230000Z",summary:"Mathnasium",start:"2026-09-04T16:00:00-07:00",end:"2026-09-04T17:00:00-07:00",allDay:false},
  ],
  "2026-09-10": [
    {id:"cmsvbrgtnm7424l677dvggjdot_20260910T190000Z",summary:"Gardener",start:"2026-09-10T12:00:00-07:00",end:"2026-09-10T13:00:00-07:00",allDay:false},
    {id:"ncht1rksj1s18rn0amdqdqp191_20260910T210000Z",summary:"Review Beacon and Baywater projects",start:"2026-09-10T14:00:00-07:00",end:"2026-09-10T15:00:00-07:00",allDay:false},
  ],
  "2026-09-11": [
    {id:"1504d04rbf9qb7lllqot8jmqrj_20260911T230000Z",summary:"Mathnasium",start:"2026-09-11T16:00:00-07:00",end:"2026-09-11T17:00:00-07:00",allDay:false},
  ],
  "2026-09-13": [
    {id:"_60ok4d9k70ojib9i60p48b9k74rj4b9o6cq42b9k6csjiha48coj4h1g8o_20260913",summary:"mike mom’s memorial",start:"",end:"",allDay:true},
  ],
  "2026-09-17": [
    {id:"ncht1rksj1s18rn0amdqdqp191_20260917T210000Z",summary:"Review Beacon and Baywater projects",start:"2026-09-17T14:00:00-07:00",end:"2026-09-17T15:00:00-07:00",allDay:false},
  ],
  "2026-09-18": [
    {id:"1504d04rbf9qb7lllqot8jmqrj_20260918T230000Z",summary:"Mathnasium",start:"2026-09-18T16:00:00-07:00",end:"2026-09-18T17:00:00-07:00",allDay:false},
  ],
  "2026-09-19": [
    {id:"_6t23gchk6123cba36cq3ab9k75134b9p8913gba38osjichm6h142c9m6g_20260919",summary:"John Hwang Bday",start:"",end:"",allDay:true},
  ],
  "2026-09-21": [
    {id:"0i9248ms1ovt0de4vmuh170rom",summary:"London Partner Equip",start:"",end:"",allDay:true},
  ],
  "2026-09-24": [
    {id:"cmsvbrgtnm7424l677dvggjdot_20260924T190000Z",summary:"Gardener",start:"2026-09-24T12:00:00-07:00",end:"2026-09-24T13:00:00-07:00",allDay:false},
    {id:"ncht1rksj1s18rn0amdqdqp191_20260924T210000Z",summary:"Review Beacon and Baywater projects",start:"2026-09-24T14:00:00-07:00",end:"2026-09-24T15:00:00-07:00",allDay:false},
  ],
  "2026-09-25": [
    {id:"1504d04rbf9qb7lllqot8jmqrj_20260925T230000Z",summary:"Mathnasium",start:"2026-09-25T16:00:00-07:00",end:"2026-09-25T17:00:00-07:00",allDay:false},
  ],
  "2026-09-27": [
    {id:"bv2rnt3i46eu06qn6iotseqg50_20260927",summary:"Clayton's Bday",start:"",end:"",allDay:true},
  ],
  "2026-10-01": [
    {id:"ncht1rksj1s18rn0amdqdqp191_20261001T210000Z",summary:"Review Beacon and Baywater projects",start:"2026-10-01T14:00:00-07:00",end:"2026-10-01T15:00:00-07:00",allDay:false},
  ],
  "2026-10-02": [
    {id:"1504d04rbf9qb7lllqot8jmqrj_20261002T230000Z",summary:"Mathnasium",start:"2026-10-02T16:00:00-07:00",end:"2026-10-02T17:00:00-07:00",allDay:false},
  ],
  "2026-10-04": [
    {id:"kv94ms6kg5er56htv1snlssslk_20261004",summary:"Tim Lane Bday",start:"",end:"",allDay:true},
  ],
  "2026-10-06": [
    {id:"_8534cdhk70sj6b9i84q32b9k6kp32ba188o3ab9i6d0j4c24750kahi560_20261006",summary:"james kim bday",start:"",end:"",allDay:true},
    {id:"_8os42cpm74p4cb9k60qjcb9k6gr32ba26p24cb9n84r3cd9g74o3cdhk6c_20261006",summary:"Caroline bday",start:"",end:"",allDay:true},
  ],
  "2026-10-08": [
    {id:"cmsvbrgtnm7424l677dvggjdot_20261008T190000Z",summary:"Gardener",start:"2026-10-08T12:00:00-07:00",end:"2026-10-08T13:00:00-07:00",allDay:false},
    {id:"ncht1rksj1s18rn0amdqdqp191_20261008T210000Z",summary:"Review Beacon and Baywater projects",start:"2026-10-08T14:00:00-07:00",end:"2026-10-08T15:00:00-07:00",allDay:false},
  ],
  "2026-10-09": [
    {id:"1504d04rbf9qb7lllqot8jmqrj_20261009T230000Z",summary:"Mathnasium",start:"2026-10-09T16:00:00-07:00",end:"2026-10-09T17:00:00-07:00",allDay:false},
  ],
  "2026-10-11": [
    {id:"4d1efp4lo4uvjr5n1m0a9i4204_20261011",summary:"Mike's Bday",start:"",end:"",allDay:true},
  ],
  "2026-10-15": [
    {id:"ncht1rksj1s18rn0amdqdqp191_20261015T210000Z",summary:"Review Beacon and Baywater projects",start:"2026-10-15T14:00:00-07:00",end:"2026-10-15T15:00:00-07:00",allDay:false},
  ],
  "2026-10-16": [
    {id:"1504d04rbf9qb7lllqot8jmqrj_20261016T230000Z",summary:"Mathnasium",start:"2026-10-16T16:00:00-07:00",end:"2026-10-16T17:00:00-07:00",allDay:false},
  ],
  "2026-10-20": [
    {id:"_74rj0di48cpj0b9o70pjib9k8h1k8ba184s3iba56spj6dq18l13icpi6o_20261020",summary:"Sam's bday",start:"",end:"",allDay:true},
  ],
  "2026-10-22": [
    {id:"_88qk6ha38go32ba66l2jeb9k6l0kcba26gokab9k8d33ccpk60p42chi70_20261022",summary:"rupesh bday",start:"",end:"",allDay:true},
    {id:"cmsvbrgtnm7424l677dvggjdot_20261022T190000Z",summary:"Gardener",start:"2026-10-22T12:00:00-07:00",end:"2026-10-22T13:00:00-07:00",allDay:false},
    {id:"ncht1rksj1s18rn0amdqdqp191_20261022T210000Z",summary:"Review Beacon and Baywater projects",start:"2026-10-22T14:00:00-07:00",end:"2026-10-22T15:00:00-07:00",allDay:false},
  ],
  "2026-10-23": [
    {id:"1504d04rbf9qb7lllqot8jmqrj_20261023T230000Z",summary:"Mathnasium",start:"2026-10-23T16:00:00-07:00",end:"2026-10-23T17:00:00-07:00",allDay:false},
  ],
  "2026-10-27": [
    {id:"56f4fm5u3fvnupnllnk81shpmn",summary:"Tokyo Partner Equip",start:"",end:"",allDay:true},
  ],
  "2026-10-29": [
    {id:"ncht1rksj1s18rn0amdqdqp191_20261029T210000Z",summary:"Review Beacon and Baywater projects",start:"2026-10-29T14:00:00-07:00",end:"2026-10-29T15:00:00-07:00",allDay:false},
  ],
  "2026-10-30": [
    {id:"1504d04rbf9qb7lllqot8jmqrj_20261030T230000Z",summary:"Mathnasium",start:"2026-10-30T16:00:00-07:00",end:"2026-10-30T17:00:00-07:00",allDay:false},
  ],
  "2026-11-03": [
    {id:"_8gq3cghm6cq3gb9i70o38b9k8h33cb9o8osj6ba488sjihhp8go36h266k_20261103",summary:"Paul Kim Bday",start:"",end:"",allDay:true},
  ],
  "2026-11-05": [
    {id:"cmsvbrgtnm7424l677dvggjdot_20261105T200000Z",summary:"Gardener",start:"2026-11-05T12:00:00-08:00",end:"2026-11-05T13:00:00-08:00",allDay:false},
    {id:"ncht1rksj1s18rn0amdqdqp191_20261105T220000Z",summary:"Review Beacon and Baywater projects",start:"2026-11-05T14:00:00-08:00",end:"2026-11-05T15:00:00-08:00",allDay:false},
  ],
  "2026-11-06": [
    {id:"1504d04rbf9qb7lllqot8jmqrj_20261107T000000Z",summary:"Mathnasium",start:"2026-11-06T16:00:00-08:00",end:"2026-11-06T17:00:00-08:00",allDay:false},
  ],
  "2026-11-11": [
    {id:"4q7onhnts510gq7bkjdc9gacig_20261111",summary:"Shan Bday",start:"",end:"",allDay:true},
  ],
  "2026-11-12": [
    {id:"ncht1rksj1s18rn0amdqdqp191_20261112T220000Z",summary:"Review Beacon and Baywater projects",start:"2026-11-12T14:00:00-08:00",end:"2026-11-12T15:00:00-08:00",allDay:false},
  ],
  "2026-11-13": [
    {id:"_8d0jge9l6t34ab9h6h0k4b9k8gq3iba18d0j2b9h6cq38dhk68pk2ga36o_20261113",summary:"Daniel Baek's Bday",start:"",end:"",allDay:true},
    {id:"1504d04rbf9qb7lllqot8jmqrj_20261114T000000Z",summary:"Mathnasium",start:"2026-11-13T16:00:00-08:00",end:"2026-11-13T17:00:00-08:00",allDay:false},
  ],
  "2026-11-14": [
    {id:"56sq5ju39dc39gue9n1odogj0d_20261114",summary:"Ella's Bday",start:"",end:"",allDay:true},
    {id:"_70s42ca26t332b9l891j8b9k60o42ba16t330b9j8goj2chi70rj4cpg64_20261114",summary:"Jaime's Bday",start:"",end:"",allDay:true},
  ],
  "2026-11-15": [
    {id:"_6h0j4gq36csj0ba1751jeb9k65230b9o6csj6b9i6oo3ih9m8d232ghp64_20261115",summary:"이모부 bday",start:"",end:"",allDay:true},
  ],
  "2026-11-19": [
    {id:"cmsvbrgtnm7424l677dvggjdot_20261119T200000Z",summary:"Gardener",start:"2026-11-19T12:00:00-08:00",end:"2026-11-19T13:00:00-08:00",allDay:false},
    {id:"ncht1rksj1s18rn0amdqdqp191_20261119T220000Z",summary:"Review Beacon and Baywater projects",start:"2026-11-19T14:00:00-08:00",end:"2026-11-19T15:00:00-08:00",allDay:false},
  ],
  "2026-11-20": [
    {id:"1504d04rbf9qb7lllqot8jmqrj_20261121T000000Z",summary:"Mathnasium",start:"2026-11-20T16:00:00-08:00",end:"2026-11-20T17:00:00-08:00",allDay:false},
  ],
  "2026-11-21": [
    {id:"2m1ic9j5gan5cpjocmiq70kcmk_20261121",summary:"Tyson's Bday",start:"",end:"",allDay:true},
  ],
  "2026-11-26": [
    {id:"t5us8iij38rjdf66oju0vfgun4_20261126",summary:"Sharon's Bday",start:"",end:"",allDay:true},
    {id:"ncht1rksj1s18rn0amdqdqp191_20261126T220000Z",summary:"Review Beacon and Baywater projects",start:"2026-11-26T14:00:00-08:00",end:"2026-11-26T15:00:00-08:00",allDay:false},
  ],
  "2026-11-27": [
    {id:"1504d04rbf9qb7lllqot8jmqrj_20261128T000000Z",summary:"Mathnasium",start:"2026-11-27T16:00:00-08:00",end:"2026-11-27T17:00:00-08:00",allDay:false},
  ],
  "2026-12-03": [
    {id:"cmsvbrgtnm7424l677dvggjdot_20261203T200000Z",summary:"Gardener",start:"2026-12-03T12:00:00-08:00",end:"2026-12-03T13:00:00-08:00",allDay:false},
    {id:"ncht1rksj1s18rn0amdqdqp191_20261203T220000Z",summary:"Review Beacon and Baywater projects",start:"2026-12-03T14:00:00-08:00",end:"2026-12-03T15:00:00-08:00",allDay:false},
  ],
  "2026-12-04": [
    {id:"1hif7399p6eqq6rjrg2944vqcj_20261204",summary:"Jeremy Baker Bday",start:"",end:"",allDay:true},
    {id:"1504d04rbf9qb7lllqot8jmqrj_20261205T000000Z",summary:"Mathnasium",start:"2026-12-04T16:00:00-08:00",end:"2026-12-04T17:00:00-08:00",allDay:false},
  ],
  "2026-12-10": [
    {id:"ncht1rksj1s18rn0amdqdqp191_20261210T220000Z",summary:"Review Beacon and Baywater projects",start:"2026-12-10T14:00:00-08:00",end:"2026-12-10T15:00:00-08:00",allDay:false},
  ],
  "2026-12-11": [
    {id:"1504d04rbf9qb7lllqot8jmqrj_20261212T000000Z",summary:"Mathnasium",start:"2026-12-11T16:00:00-08:00",end:"2026-12-11T17:00:00-08:00",allDay:false},
  ],
  "2026-12-17": [
    {id:"cmsvbrgtnm7424l677dvggjdot_20261217T200000Z",summary:"Gardener",start:"2026-12-17T12:00:00-08:00",end:"2026-12-17T13:00:00-08:00",allDay:false},
    {id:"ncht1rksj1s18rn0amdqdqp191_20261217T220000Z",summary:"Review Beacon and Baywater projects",start:"2026-12-17T14:00:00-08:00",end:"2026-12-17T15:00:00-08:00",allDay:false},
  ],
  "2026-12-18": [
    {id:"_75330dpo74qjgb9l6spj4b9k6kpk8b9o68q3ib9l8kq3ie9j8h14cgpj68_20261218",summary:"Jordan's Bday",start:"",end:"",allDay:true},
    {id:"1504d04rbf9qb7lllqot8jmqrj_20261219T000000Z",summary:"Mathnasium",start:"2026-12-18T16:00:00-08:00",end:"2026-12-18T17:00:00-08:00",allDay:false},
  ],
  "2026-12-21": [
    {id:"_60s3igi674s3gb9h6op34b9k84pj0ba18l0jgb9p8h13gg9l6spj2d1h6g_20261221",summary:"Eddie Choe's Bday",start:"",end:"",allDay:true},
  ],
  "2026-12-24": [
    {id:"ncht1rksj1s18rn0amdqdqp191_20261224T220000Z",summary:"Review Beacon and Baywater projects",start:"2026-12-24T14:00:00-08:00",end:"2026-12-24T15:00:00-08:00",allDay:false},
  ],
  "2026-12-25": [
    {id:"1504d04rbf9qb7lllqot8jmqrj_20261226T000000Z",summary:"Mathnasium",start:"2026-12-25T16:00:00-08:00",end:"2026-12-25T17:00:00-08:00",allDay:false},
  ],
  "2026-12-29": [
    {id:"703b0v6gcqpkkeqrcjkaqohfk3_20261229",summary:"Aiden's Bday",start:"",end:"",allDay:true},
  ],
  "2026-12-31": [
    {id:"cmsvbrgtnm7424l677dvggjdot_20261231T200000Z",summary:"Gardener",start:"2026-12-31T12:00:00-08:00",end:"2026-12-31T13:00:00-08:00",allDay:false},
    {id:"ncht1rksj1s18rn0amdqdqp191_20261231T220000Z",summary:"Review Beacon and Baywater projects",start:"2026-12-31T14:00:00-08:00",end:"2026-12-31T15:00:00-08:00",allDay:false},
  ],
};

function getEventsForDate(dateStr) { return CALENDAR[dateStr] || []; }

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
  const [photos, setPhotos] = useState([]);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [aiRunning, setAiRunning] = useState(false);
  const [calEvents, setCalEvents] = useState([]);
  const [calLoading, setCalLoading] = useState(false);
  const [calendarData, setCalendarData] = useState(CALENDAR);
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
  const [expanded, setExpanded] = useState({});
  const [editingTags, setEditingTags] = useState(null);

  // Reflect state
  const [reflectPrompt, setReflectPrompt] = useState("");
  const [reflection, setReflection] = useState(null);
  const [reflecting, setReflecting] = useState(false);

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
          [{ role: "user", content: `Journal entry: "${text}"\n\nRespond ONLY with JSON: {"category":"kids|sharon|work|personal|home|family","mood":"great|good|okay|hard|tough|funny|proud|grateful"}` }],
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
    if (!text.trim()) { setStatus({ type: "err", msg: "Write something first!" }); return; }
    setSaving(true);
    setStatus(null);
    const entry = {
      id: uid(),
      date: logDate,
      text,
      intent,
      category: detectedCat,
      mood: detectedMood,
      linkedEvents,
      photos,
      createdAt: new Date().toISOString(),
    };
    const updated = { ...journal, entries: [entry, ...journal.entries] };
    setJournal(updated);
    await saveJournal(updated);
    setSaving(false);
    setStatus({ type: "ok", msg: "✓ Saved to your journal" });
    setText(""); setIntent(null); setLinkedEvents([]); setDetectedCat(null); setDetectedMood(null); setPhotos([]);
    setTimeout(() => setStatus(null), 3000);
  };

  const updateEntryTags = async (entryId, updates) => {
    const updated = { ...journal, entries: journal.entries.map(e => e.id === entryId ? { ...e, ...updates } : e) };
    setJournal(updated);
    await saveJournal(updated);
    setEditingTags(null);
  };

  const generateReflection = async (prompt) => {
    if (!prompt.trim()) return;
    setReflecting(true);
    setReflection(null);

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

    const text2 = await callClaude(
      [{ role: "user", content: `Today's date is ${getToday()}.\n\n${journalSection}\n\n${calendarSection}\n\nKevin's request: "${prompt}"\n\nRespond conversationally and warmly, using the journal entries and calendar events above as context. If Kevin asks about a specific period, focus on that. If he asks about a person or theme, find relevant moments across all entries.` }],
      "You are a warm, thoughtful journaling companion for Kevin (48, works at AWS, married to Sharon, kids Aiden age 7 and a daughter). You know his life well through his journal and calendar. Be personal, insightful, and encouraging."
    );
    setReflection(text2);
    if (text2 && !text2.startsWith("Error:")) {
      const saved = {
        id: uid(),
        prompt,
        generatedAt: new Date().toISOString(),
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

  const filteredEntries = journal.entries.filter(e => {
    if (filter === "all") return true;
    if (filter === "milestones") return e.intent === "milestone";
    if (filter === "stories") return e.intent === "story";
    return e.category === filter;
  });

  // ── STATS ──
  const totalEntries = journal.entries.length;
  const milestones = journal.entries.filter(e => e.intent === "milestone").length;
  const catCounts = {};
  journal.entries.forEach(e => { if (e.category) catCounts[e.category] = (catCounts[e.category] || 0) + 1; });
  const topCat = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0];

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
              <button key={f.id} className={`filter-btn${filter===f.id?" active":""}`} onClick={()=>setFilter(f.id)}>
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
          ) : filteredEntries.map(entry => (
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
                onClick={() => setEditingTags(editingTags === entry.id ? null : entry.id)}
                style={{marginTop:10,background:"none",border:"1px solid var(--border)",borderRadius:8,padding:"4px 10px",fontSize:12,color:"var(--ink-2)",cursor:"pointer"}}
              >
                ✏️ Edit tags
              </button>
              {editingTags === entry.id && (
                <div style={{marginTop:10,padding:12,background:"var(--card)",borderRadius:10,border:"1px solid var(--border)"}}>
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
        </div>
      )}

      {/* ── REFLECT TAB ── */}
      {tab === "reflect" && (
        <div className="section">
          {/* Stats */}
          <div className="stats-grid">
            <div className="stat-box">
              <div className="stat-num">{totalEntries}</div>
              <div className="stat-label">Total Entries</div>
            </div>
            <div className="stat-box">
              <div className="stat-num">{milestones}</div>
              <div className="stat-label">Milestones</div>
            </div>
            <div className="stat-box">
              <div className="stat-num">{topCat ? catIcon(topCat[0]) : "—"}</div>
              <div className="stat-label">{topCat ? `Most: ${CATEGORIES.find(c=>c.id===topCat[0])?.label}` : "No data yet"}</div>
            </div>
            <div className="stat-box">
              <div className="stat-num">{journal.entries.filter(e=>e.date===getToday()).length}</div>
              <div className="stat-label">Today's Entries</div>
            </div>
          </div>

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
                <div key={r.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 4px",borderBottom:"1px solid var(--border)"}}>
                  <span style={{fontSize:14,color:"var(--ink-1)"}}>✨ {r.prompt || "Reflection"}</span>
                  <span style={{fontSize:12,color:"var(--ink-3)",whiteSpace:"nowrap",marginLeft:12}}>
                    {r.generatedAt ? new Date(r.generatedAt).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
