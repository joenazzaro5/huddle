Huddle — Youth Sports Coordination App
Huddle is a mobile app built for youth sports coaches and parents. It reduces the manual coordination overhead that comes with running a youth sports team — practice planning, lineup decisions, schedules, and team communication — and adds AI-powered features that help coaches show up more prepared.
Built with React Native / Expo. Currently in active development.

AI Features
AI Practice Planner
Coaches describe their team, focus areas, and session length. The app sends a structured prompt to the Anthropic API (Claude) and returns a complete practice plan — drills, timing, and progression — formatted as JSON and rendered as a coach-facing session view.
AI Lineup Builder
Coaches input their roster and game context. The AI returns a recommended starting lineup and formation with positional rationale, structured as JSON and displayed on an interactive field view.
Both features use claude-sonnet via the Anthropic Messages API with structured JSON output prompting.

Stack

React Native / Expo
TypeScript
Supabase (backend / auth)
Anthropic API (Claude) for AI features
Expo EAS Build for iOS distribution


Views

Coach view — practice planner, AI lineup builder, drill library, team roster, schedule
Parent view — schedule, team updates, snack signup, drill of the day
Athlete view — training streak, drill of the day, upcoming games


Status
Active prototype. AI Practice Planner and AI Lineup Builder are functional and wired to the Anthropic API. App has been built and tested via Expo Go and TestFlight on iOS.
