# Mindify MVP — Technical Plan

**Prepared by:** CTO, Mindify
**Date:** April 11, 2026

---

## Architecture Overview

Mindify is a React Native (Expo) mobile app with a Firebase backend and a Claude-powered AI processing pipeline.

```
[Mobile App (React Native / Expo)]
              |
              v
   [Firebase Cloud Functions]
              |
        +-----+-----+
        |           |
    [Whisper]   [Claude]   ← transcription + classification
        |           |
        +-----+-----+
              |
              v
         [Firestore]   ← real-time listener on client
```

---

## Data Model

### `users/{userId}`
```
uid, createdAt, settings { theme, notifications }
```

### `recordings/{recordingId}`
```
userId, audioUrl (Cloud Storage), transcript,
createdAt, processedAt
```

### `items/{itemId}`
```
userId, recordingId,
type: 'task' | 'idea' | 'project',
title, body?,
category: string (Errands, Health, Work, Personal, …),
categoryColor: hex,
energyLevel: 1 | 2 | 3,
urgency: 'high' | 'medium' | 'low',
bucket: 'today' | 'tomorrow' | 'someday',
groupId?: string,
createdAt, completedAt?
```

### `groups/{groupId}`
```
userId, title, category, itemIds[], createdAt
```

---

## Key Technical Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Transcription | OpenAI Whisper API | Best accuracy, handles natural/ADHD speech |
| AI Classification | Claude API (claude-haiku-4-5) | Fast, cost-efficient, structured JSON output |
| Mobile Framework | React Native + Expo (managed workflow) | Cross-platform, fast iteration |
| Backend | Firebase (Firestore, Auth, Storage, Functions) | Real-time listeners, easy scaling |
| Audio | expo-av | Expo-native, well-supported |
| Local State | Zustand | Lightweight, minimal boilerplate |
| Auth | Anonymous first, upgrade to Apple/Google | Zero-friction onboarding |

---

## Workstreams

### WS1 — Design (Product Designer)
- ADHD-friendly design system: calm palette, generous spacing, clear hierarchy
- Home screen: oversized record button as primary CTA
- Recording feedback: waveform animation + elapsed timer
- The Brain: grouped/sorted item list with visual type indicators
- Item cards: type icon, category chip, energy bars, urgency dot
- Figma component library (deliverable for engineers)

### WS2 — App Architecture & Backend (Lead App Engineer)
- Expo + TypeScript project scaffold (EAS build config)
- Firebase project setup: Firestore, Auth, Storage, Functions
- Cloud Functions: audio upload trigger → Whisper → Claude → write items
- Claude prompt: structured JSON output per item (type, category, energy, urgency, bucket)
- Firestore security rules
- Smart grouping logic: detect repeated category+keyword patterns across a session

### WS3 — Mobile App Implementation (Senior Mobile Engineers)
- Voice recording screen with live waveform feedback (expo-av)
- The Brain view: filter by bucket/type, sort by urgency/energy
- Item card component matching design system
- Tap-to-complete + swipe-to-snooze gestures
- Navigation: home ↔ brain ↔ item detail
- Onboarding: permission prompts (mic), anonymous auth

### WS4 — AI Integration & Quality (Senior Web Engineer)
- Prompt engineering for Claude classification (few-shot examples)
- Test harness: diverse voice input samples → validate classification accuracy
- Edge cases: multiple items in one recording, ambiguous phrasing, background noise
- Latency budget: target < 8s end-to-end (record stop → items appear)
- Cost monitoring and rate limiting

---

## MVP Scope

**In scope:**
- Voice capture → AI pipeline → organized items in The Brain
- Check off tasks (mark done)
- Smart grouping (repeated items merged)
- Anonymous auth (no sign-up friction)

**Out of scope (v2):**
- Lock screen widget
- Offline queue
- Social auth
- Push notifications
- Sharing / collaboration

---

## Dependencies

```
WS1 (Design)   → WS3 (Mobile UI) can start in parallel but needs design handoff before final polish
WS2 (Backend)  → WS3 + WS4 depend on Firebase + Functions being scaffolded first
WS4 (AI)       runs alongside WS2 — prompt engineering can start before Functions deploy
```

Suggested order: **WS1 + WS2 in parallel first**, then **WS3 + WS4 unblock once scaffold is ready**.
