# Huddle

AI-powered youth sports coordination app for coaches and parents.
Previously named "Cue" — rebranded to Huddle April 2026.
GitHub: https://github.com/joenazzaro5/huddle

## Core positioning
"Built for every huddle."
The wedge is AI-generated practice planning. Everything else supports that core.
Tagline: "Helping everyday coaches coach with confidence."

## Stack
- React Native + Expo (mobile)
- Supabase (auth, database, real-time)
- Anthropic Claude API (AI features via direct API call)
- TypeScript throughout
- Expo EAS Build (iOS distribution)
- AsyncStorage (local caching for plans, streaks, snacks)

## Project structure
- app/ — screens (home, practice, games, chat, account, parent-home, parent-team, index)
- lib/ — shared utilities (header.tsx, roleStore.tsx, season.ts, seedTestData.ts)
- supabase/ — database schema
- assets/ — images and static files
- admin/ — standalone React web admin tool (Vite)

## Brand
- Primary green: #1A7A4A
- Navy: #0D1B2A
- Name: Huddle
- Tagline: Built for every huddle.

## User roles
Three demo teams seeded in Supabase:
1. Marin Cheetahs (U10 Girls) — COACH. team_id: b42de721-85da-4b61-823a-3054d5e10145
2. San Rafael Tigers (U8 Girls) — PARENT. team_id: 5c3d7406-d03b-43cf-8eb1-d868b9bdbb7f
3. San Rafael Sharks (U12 Boys) — COACH (game day demo)

User UID: b782f661-8583-42e0-9858-6e7c5c720d92
Supabase URL: https://yvspywmhwqdapxemxlug.supabase.co

## Role switching
Team pills in header auto-switch role. Cheetahs/Sharks = coach. Tigers = parent.
No manual role switcher — the team pill IS the role switcher.

## Key screens
Coach: home, practice, games, chat, account
Parent: parent-home, parent-team
Onboarding: app/index.tsx — splash, role selection, slides (3 per role), auth
AsyncStorage key: huddle_onboarding_complete

## AI features
- Practice plan: calls Anthropic API with team age/focus context
- Cached in AsyncStorage huddle_active_plan (24hr TTL)
- Feedback stored in huddle_practice_feedback, used in next prompt
- Focus pills: Dribbling, Passing, Shooting, Defending, All
- Default plan: Passing and Movement (Rondo 4v2, Triangle Passing, Possession 5v5)
- Drill swap: select replacement from drill library

## Season schedule
lib/season.ts — April 22 to June 7 2026
Practices Wed + Fri 4pm, Games Sunday 10am, Marin Community Fields

## Mock data
Most data mocked due to Supabase RLS. Falls back to mock when Supabase returns empty.
Events: mock based on team (Cheetahs=Dribbling, Tigers=Passing)
Players, standings, stats, snacks all mocked in-app.

## Chat
Messages table: team_id, user_id, body, is_deleted
Soft delete via is_deleted column (UPDATE policy in Supabase required)
GIFs via GIPHY API key: OprgOo4Y5iCyxUDYT1O9Acyja61pGho2
Polls inline: body starts with POLL: followed by JSON
Real-time subscription filtered by team_id

## Streak tracker
Keys: huddle_streak_data_coach and huddle_streak_data_parent (separate)
Stores { count, dates: [] }. Celebrations at 3-day and 7-day milestones.

## Snack schedule
AsyncStorage key: huddle_snacks_ + teamId. Cancel functionality available.

## Key copy decisions
No AI labels in UI — use "Personalized for your team" instead
Section labels in Title Case. Build practice plan. Give practice feedback.
Practice at home for drill of the day. Empowerment language not AI-forward.

## Dev workflow
Local testing: npx expo start --lan
Phone hotspot for demos away from home
EAS credits reset May 6 2026
Claude Code: cd ~/Desktop/cue && claude

## Open issues
P0: Roster/Standings/Snacks tabs in games.tsx keep regressing
P0: Parent home hero card sometimes null (RLS blocks Supabase event query)
P1: Drill diagrams need improvement
P1: Push notifications not yet implemented
P1: Admin tool needs more work before commissioner demo
P2: Formation options need age-appropriate options per team

## Business context
Pitched to Rory Crawford (CEO BevSpot, HBS) April 2026.
Rory building 60-day playbook to test viability.
Vision: youth soccer first, all youth sports, then every huddle.
Next steps: real user feedback, San Rafael Soccer pilot, commissioner conversation.
Goal: raise funding and pursue full time if results are there.

## Coding conventions
TypeScript, functional components, hooks only.
Read ONLY files mentioned in the prompt.
One issue per Claude Code prompt, commit after each fix.
