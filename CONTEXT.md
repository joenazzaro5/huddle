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

## Open issues — critical fixes needed
1. **Home hero card empty state** — hero card shows empty/placeholder; needs full season schedule data. Season: practices Wed + Fri, games Sunday, late August through first week of November.
2. **Practice plan default state** — practice plan module on both home screen and practice tab must show a default plan immediately on load; never show an empty state.
3. **Team tab sub-tab labels cut off** — sub-tab labels are being clipped; must render as horizontally scrollable tabs with full untruncated words.
4. **Team tab full season schedule** — team tab schedule must show the complete season (same data as home screen: Wed/Fri practices + Sunday games).
5. **Games tab inline lineup builder** — AI lineup builder must live inline on the games tab, not on a separate screen.
6. **Formation changer on field view** — games tab field view needs a formation selector so coaches can switch formations without leaving the screen.
7. **Parent home completeness** — parent home screen needs: practice plan visible, roster section, standings section.
8. **Shuffle button discoverability** — shuffle button on practice plan has no label; must show a visible text label so it is not an easter egg.
9. **Drill library picker** — coaches need the ability to pick individual drills from the drill library and insert them into their practice plan.
10. **Post-practice feedback loop** — after practice, coach should be able to rate each drill: too easy / just right / too hard. Drives future AI plan personalization.
11. **Snacks tab personality** — snacks tab needs more fun and personality in its design and copy.
12. **Season stats redesign** — season stats section needs a full visual redesign.

## Open feedback / lower priority
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
