# Huddle — Open Issues

Last updated: April 14 2026 (session 2)

## Fixed today

- [x] GIFs broken — FIXED
- [x] Parent home entry point links — FIXED
- [x] Multi-team not showing — FIXED
- [x] Poll entry point routing — FIXED

## P0 — Broken (fix first, test locally before building)

- [x] GIFs broken — GIPHY integration not returning results
- [x] Multi-team not showing — seed data function not running correctly
- [x] Poll entry point on home screen not displaying correctly
- [x] Parent home entry point links going to wrong destinations

## P0 — Flaky / regressed

- [ ] RSVP count not updating immediately on coach side — optimistic update fires but count occasionally reverts; needs investigation
- [ ] Standings missing from parent Team tab — regressed, tab renders but content may be empty depending on build

## P1 — Missing features

- [ ] Polls removed from Team tab but not fully integrated into chat
- [ ] Poll creation needs more than 3 options (add dynamic "Add option +" button)
- [ ] No way to unpin a message in chat
- [ ] More reaction emoji options needed (currently only 5)
- [ ] Onboarding not showing for existing users (need Reset button to work)

## P2 — Design / copy issues

- [ ] Parent hero card missing "Add to calendar" button — coach hero has it, parent does not
- [ ] Hero card copy inconsistency: coach shows "8 days", parent shows "in 8 days" — pick one and apply everywhere
- [ ] Chat message design looks off — review bubble layout and spacing
- [ ] Multi-team pill switcher UI needs review once seeding works

## V2 — Future / not for current build

- [ ] RSVP should track player attendance, not adult attendance — currently RSVPs are per-user (coach/parent); V2 should let coaches mark each player present/absent per event

## Process rules (follow every session)

1. Read this file at the start of every Claude Code session
2. Fix ONE issue at a time
3. Test locally with npx expo start before EAS build
4. Check off items as they are fixed
5. Never batch more than 3 file changes in one Claude Code prompt
6. If rate limit hit, wait 60 seconds — do NOT re-send the same prompt
