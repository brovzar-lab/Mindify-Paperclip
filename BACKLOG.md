# Mindify Backlog

Living checklist for what's pending, what's blocking, and what's deferred.
Update this any time work lands or a new caveat is discovered. The
`TECHNICAL_PLAN.md` is the source-of-truth doc; this file tracks the gap
between the plan and current reality.

**Last updated:** 2026-04-14

---

## How to use this file

- **Now / Decisions Needed** — pick the next action from here
- **Known Issues** — tech debt that should be fixed but isn't blocking yet
- **Workstream Status** — quick health check on each WS from the plan
- **Suggested Next Steps** — prioritized punch list
- **Backlog (Post-MVP)** — wishes and v2 items, kept here so we don't lose them
- **Environment State** — what's already configured locally / in the cloud
- **Quick Commands** — the cheat sheet

---

## Now / Decisions Needed

### BLOCKED: Cloud Functions are not deployed
Required for the full record → transcribe → classify → items-in-Brain
loop to work. Deployment requires upgrading the Firebase project to the
Blaze (pay-as-you-go) plan. The Spark (free) plan covers everything
else; Blaze stays at $0/month for hobby traffic but needs a card on file.

**To unblock:**
1. Upgrade `mindify-93328` to Blaze in the Firebase console
   (Project settings → Usage and billing → Modify plan)
2. Set the secrets:
   ```bash
   firebase functions:secrets:set OPENAI_API_KEY
   firebase functions:secrets:set ANTHROPIC_API_KEY
   ```
3. Deploy:
   ```bash
   firebase deploy --only functions
   ```

**Alternative (no Blaze):** Build an `npm run seed:demo` script that
writes ~10 realistic fake items directly to Firestore so The Brain has
content for visual review. Recording → classification still won't work
end-to-end, but the UI is fully demoable. ~30 lines of code.

### SECURITY: Rotate the Anthropic API key
A previous key (`sk-ant-api03-pl6Y…`) leaked in shell command history
during a `test:classify` run. Treat it as compromised even though no
known third-party access has occurred.

**Action:**
1. Revoke at https://console.anthropic.com/settings/keys
2. Generate a fresh key
3. Replace the value in `functions/.env`
4. Going forward use `read -s ANTHROPIC_API_KEY && export ANTHROPIC_API_KEY`
   so the value never lands in shell history

### WS1 (Design) — no design handoff yet
The plan calls for a Figma component library. Current `src/theme/index.ts`
is a placeholder calm/muted palette. WS3 components were built theme-
swappable, so designer output should drop in without component rewrites.

---

## Known Issues / Technical Debt

### Prompt cache buffer is paper-thin
- Current prompt: **4152 tokens** (verified via `npm run count:prompt`)
- Haiku 4.5 cache floor: **4096 tokens**
- Headroom: **only 56 tokens**
- Risk: any edit to `functions/src/prompts/classification.ts` that trims
  content could silently drop us below the floor and disable caching —
  the request still works, but cost goes up ~10x for the cached portion.
- Fix: pad with ~500 tokens of additional content (more few-shot
  examples, especially edge cases like multilingual transcripts and
  recurring habits). Run `npm run count:prompt` after every prompt edit.

### `createdAt` typing is loose
- `ItemDoc.createdAt` is declared `number` in `src/types/models.ts` but
  Firestore actually returns a `Timestamp`
- Not currently breaking — no UI code formats dates yet
- When date display is added (e.g. "captured 5m ago"): tighten the type
  to `Timestamp | number` and call `.toDate()` / `.toMillis()` at the
  display boundary

### iOS Simulator microphone is unreliable
- Recordings in the simulator often produce silence or short partial audio
- Use a real iPhone via Expo Go for any record-flow testing
- Not a code issue; document it in the contributor guide once we have one

### No optimistic UI on item complete/snooze
- `ItemCard` complete/snooze actions round-trip Firestore before the
  card animates away
- Feels fine on Wi-Fi; laggy on bad cellular
- Fix: add a local "pending" set in the Zustand store and filter the
  brain list against it

### Permission-denied UX is bare
- Onboarding shows static "open Settings → Mindify → Microphone" copy
- No deep-link to system Settings
- Trivial fix: `import { Linking } from 'react-native'; Linking.openSettings();`

### Long thoughts may exceed Whisper / Storage limits
- Storage rules cap at 25 MB ≈ 30 min of m4a audio
- No client warning when approaching the limit
- Future: soft warning past 5 minutes, hard stop near 25 MB

### Functions test runner relies on `process.env` fallback
- `classifyTranscript` accepts an optional `Anthropic` client; the test
  runner builds its own from `process.env.ANTHROPIC_API_KEY`
- Works today on Node 20+; if the Firebase Functions SDK ever stops
  bundling `defineSecret` with env-var fallback, the runner stays unaffected
  but production code paths would need a stub-secret in dev

---

## Workstream Status

### WS1 — Design (Product Designer)
- ⚪️ Not started — no designer onboarded
- Theme placeholder shipped in `src/theme/index.ts`
- Engineers blocked from final polish until handoff lands

### WS2 — App Architecture & Backend
- 🟢 Scaffold complete (Expo + TypeScript + EAS, Firebase project, security rules)
- 🟢 Cloud Functions code complete (Storage trigger → Whisper → Claude → grouping → atomic Firestore batch)
- 🟢 Smart grouping heuristic: union-find on category + token overlap
- 🔴 Functions not deployed — see "Now / Decisions Needed"

### WS3 — Mobile App
- 🟢 Functional scaffold complete: Onboarding, Home, Brain, ItemDetail
- 🟢 Navigation, hooks, state, components, theme
- 🟢 Anonymous auth with AsyncStorage persistence
- 🟢 Recording → Storage upload working
- 🟡 Pending:
  - WS1 design integration (blocked on WS1)
  - Optimistic UI for complete/snooze
  - Settings deep-link on permission denial
  - Recording-length warnings near Storage limits
  - Polish pass on animations and microcopy

### WS4 — AI Integration & Quality
- 🟢 12-fixture test harness, 100% accuracy, 90.8% cache-read share, 1.77¢/run
- 🟢 Prompt-size verifier (`count:prompt`)
- 🟢 Cost-monitoring ledger at `costs/{userId}/{yyyy-mm}/{recordingId}`
- 🟢 Per-user hourly rate limiter (30/hr)
- 🟡 Pending:
  - Latency benchmark on real audio uploads (requires Functions deploy)
  - Cost aggregation scheduled function + dashboard query
  - Pad prompt past 4500 tokens for cache-floor headroom
  - Grow fixture set from 12 to ~25-30 (recurring habits, multilingual,
    recovery from Whisper artifacts)

---

## Suggested Next Steps (priority ordered)

1. **Rotate the Anthropic API key** (security; takes 2 min)
2. **Decide deploy vs. seed:** upgrade to Blaze + deploy Functions for
   real E2E, OR build `npm run seed:demo` for UI-only review
3. **Pad the classification prompt** past 4500 tokens so cache stays safe
4. **Onboard a designer** for WS1 OR finalize the placeholder palette
5. **WS3 polish pass** — optimistic UI + Settings deep-link + recording-
   length warnings
6. **WS4 latency benchmark** — wire up a one-shot script that uploads a
   sample audio file and times the full pipeline against `LATENCY_BUDGET_MS`
7. **CI** — typecheck + classification fixtures on PR (GitHub Actions)

---

## Backlog (Post-MVP)

Per the technical plan's "Out of scope (v2)" plus follow-ups discovered
during scaffolding:

### v2 (per plan)
- Lock screen widget
- Offline queue (capture without connectivity, sync on reconnect)
- Apple / Google social auth (currently anonymous-only)
- Push notifications
- Sharing / collaboration

### Engineering quality
- Cost aggregation function with monthly rollups
- Cost dashboard (Admin SDK script or Cloud Function with Hosting)
- E2E test harness (Detox or Maestro)
- Deeper grouping algorithm (sentence embeddings instead of token-overlap)
- Streaming Whisper for latency win if benchmark blows the 8s budget
- Multi-language support
- Item search / full-text search
- Accessibility audit (VoiceOver labels, dynamic type, color contrast)
- Sentry / Crashlytics integration

### Product wishes (not committed)
- "Speak again" prompt when transcript is < 3 words
- "Snippet review" — show transcript next to extracted items
- Edit-after-the-fact (today: delete + re-record only)
- Recurring items / habits with smart defaults
- "Brain dump" mode — long-form recording with chunked classification
- Calendar integration for items with dates
- Integrations with Things/Todoist/Notion/Linear

---

## Environment State

So we don't re-discover this every session.

### Firebase
- Project: **mindify-93328**
- Owner account: billyrovzar@gmail.com
- Plan: **Spark (free)** — needs Blaze upgrade for Cloud Functions
- Aliased `default` in `.firebaserc`
- Services enabled: Authentication (Anonymous), Firestore, Storage
- Security rules deployed: `firestore.rules`, `storage.rules`
- Cloud Functions: **NOT deployed**

### Local secrets (gitignored, not in repo)
- `/.env` — Firebase web config (`EXPO_PUBLIC_FIREBASE_*`)
- `/functions/.env` — Anthropic API key (rotate before next use)
- For deployed Functions: secrets read via `defineSecret`, set via
  `firebase functions:secrets:set OPENAI_API_KEY` /
  `firebase functions:secrets:set ANTHROPIC_API_KEY`

### Local dev tooling
- macOS, Node 25.6.1, npm 11.9.0
- Expo CLI via `npx`
- Firebase CLI installed globally (`npm install -g firebase-tools`)
- iOS Simulator + Expo Go installed (mic flaky — prefer real device)

### Repo
- GitHub: brovzar-lab/Mindify-Paperclip
- Default branch: **main**
- Audit-trail branch: `claude/mindify-mvp-technical-plan-hWmHa`
  (kept for history; both branches at the same HEAD)
- Local clone: `/Users/quantumcode/CODE/mindify-paperclip`

---

## Quick Commands

All run from `mindify-paperclip/` (or noted subdir).

| Goal | Command |
|---|---|
| Start the app | `npx expo start` then scan QR with iPhone Camera |
| Run classification tests | `cd functions && npm run test:classify` |
| Verify prompt size | `cd functions && npm run count:prompt` |
| Deploy security rules only | `firebase deploy --only firestore:rules,storage` |
| Deploy Cloud Functions (needs Blaze) | `firebase deploy --only functions` |
| Set a Firebase secret | `firebase functions:secrets:set <NAME>` |
| View Firestore in console | https://console.firebase.google.com/project/mindify-93328/firestore |
| View Storage in console | https://console.firebase.google.com/project/mindify-93328/storage |
| View Functions logs | `firebase functions:log` |
| Type-check the app | `npm run typecheck` |
| Type-check the functions | `cd functions && npm run build` |
