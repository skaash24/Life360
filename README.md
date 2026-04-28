# Life360 — Kevin's Personal Life Journal

A personal life journal and memory system. Captures daily moments, family stories, kids' milestones, moods, and life reflections. Connected to Google Calendar.

## About
- Built with React + Vite
- Started April 27, 2026
- Family: Sharon (wife), Aiden (son), daughter

## Features
- Date navigator (yesterday / today / tomorrow + calendar picker)
- Google Calendar events auto-loaded per day
- AI auto-tagging: category, mood, people detected
- Quick-tap intents: 🏆 Milestone · 📖 Story · 😂 Funny · 🙏 Grateful
- Photo attachments
- Timeline with filters (Milestones, Stories, by category)
- Weekly/monthly/yearly AI reflections

## Categories
⭐ Kids · ❤️ Sharon · 💼 Work · 🙋 Personal · 🏠 Home · 👨‍👧‍👦 Family

## Moods
✨ Great · 😊 Good · 😐 Okay · 😔 Hard · 🌧️ Tough · 😂 Funny · 🦁 Proud · 🙏 Grateful

## Setup

```bash
npm install
npm run dev
```

## Deploy to Vercel

1. Push to GitHub
2. Import repo on vercel.com
3. Deploy (zero config needed)

## Storage
- Currently uses Claude artifact persistent storage
- Future: Google Drive integration for cross-device sync
- Calendar data: pre-loaded from Google Calendar each session by Claude

## Tech Stack
- React 18 + Vite
- Lora + DM Sans fonts
- Warm beige/terracotta palette
- Anthropic Claude API for AI tagging + reflections
