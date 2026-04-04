# Huddle

AI-powered youth sports coordination app for coaches, parents, and athletes.
Previously named "Cue" — rebranded to Huddle April 2026.

## Core positioning
"TeamSnap tells you when practice is. Huddle tells you what to do at practice."
The wedge is AI-generated practice planning. Everything else is secondary.

## Stack
- React Native + Expo (mobile)
- Supabase (auth, database, storage)
- Anthropic Claude API via Supabase Edge Function (AI features)
- TypeScript throughout
- Expo EAS Build (App Store distribution)

## Project structure
- `app/` — screens and navigation (home, practice, games, chat, account, roster, subs, player)
- `lib/` — shared utilities (header.tsx, supabase.ts, ai.ts)
- `supabase/` — database schema and edge functions
- `assets/` — images and static files

## Brand
- Primary color: #1A56DB (blue)
- Dark: #1E40AF
- Light: #DBEAFE
- Text: #111827
- Background: #F7F7F5
- Name: Huddle
- Tagline: Your AI coaching assistant
- Icon: top-down huddle of figures in a ring, blue background

## User roles
- Coach: AI practice planner, field view, lineup builder, roster, chat
- Parent: schedule, RSVP, chat
- Athlete: drill library, ideas lab

## AI features
- AI Practice Planner: generates Play-Practice-Play structured sessions via Supabase Edge Function
- AI Lineup Builder: generates starting lineup and substitution plan

## Practice plan structure (Play-Practice-Play)
- Opening Play (15 min) — color: #4CAF50 green
- Practice Phase (30 min) — color: #1A56DB blue
- Final Play (15 min) — color: #FF6B35 orange
Phase colors are intentionally distinct — do not change them to match brand blue.

## Current state (April 2026)
- Auth working via Supabase
- Coach home, practice, games, chat, account screens live
- AI practice plan auto-generates on home screen load
- Field view with player positions working on games tab
- Standalone build deployed to iPhone via EAS preview

## Open feedback / next fixes
- Drill presentation needs upgrade — should feel like best-in-class content app
- Athlete section should feel like a game, not a list
- Button naming inconsistent between Home and Practice tabs
- Chat bubbles need color consistency check after rebrand
- Games tab field player circles still using green — needs blue audit

## Coding conventions
- TypeScript throughout
- Functional components with hooks only
- No class components
- No hardcoded team colors — always use #1A56DB as primary
- Keep sed-friendly: avoid nested quotes in style objects where possible
