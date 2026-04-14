# Huddle — Open Issues

Last updated: April 14 2026

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

## P1 — Missing features

- [ ] Polls removed from Team tab but not fully integrated into chat
- [ ] Poll creation needs more than 3 options (add dynamic "Add option +" button)
- [ ] No way to unpin a message in chat
- [ ] More reaction emoji options needed (currently only 5)
- [ ] Onboarding not showing for existing users (need Reset button to work)

## P2 — Design issues

- [ ] Chat message design looks off — review bubble layout and spacing
- [ ] Multi-team pill switcher UI needs review once seeding works

## Process rules (follow every session)

1. Read this file at the start of every Claude Code session
2. Fix ONE issue at a time
3. Test locally with npx expo start before EAS build
4. Check off items as they are fixed
5. Never batch more than 3 file changes in one Claude Code prompt
6. If rate limit hit, wait 60 seconds — do NOT re-send the same prompt
