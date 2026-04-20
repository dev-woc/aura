# Feature: Aura Phase 2 — Async Generation, Beat-Sync Player, Publish & Discovery

The following plan should be complete, but validate documentation and codebase patterns before implementing. Pay special attention to import paths (`@/*` alias), existing Drizzle schema patterns, Neon Auth session patterns (`const { data: session } = await auth.getSession()`), and the lazy-init patterns for `db` and `auth`.

---

## Feature Description

Phase 2 completes the Aura loop: Artists can publish their generated visual experiences; Listeners can discover and play them. The generation pipeline moves from synchronous (times out on Vercel) to async job-based with client polling. The preview player becomes beat-synchronized using Spotify Audio Analysis data stored in `songs.beatGrid`.

## User Stories

**Artist:** As an artist, I want frame generation to run as a long-lived background job (not block the browser tab) so I can close the tab and come back to finished results.

**Artist:** As an artist, I want to publish my style brief so listeners can discover and experience my music visually.

**Listener:** As a listener, I want to browse and play published artist experiences so I can enjoy music as a generative visual.

## Problem Statement

1. Frame generation via Replicate SDXL is synchronous — 10 frames × ~15s each = ~150s, exceeding Vercel's 60s function timeout. Production will always fail.
2. `songs.beatGrid` is never populated — the analyze route calls `getAudioFeatures` but never `getAudioAnalysis`. Beat-sync playback is not possible.
3. `styleBriefs` has no `published` field — artists cannot gate listener visibility.
4. The listener dashboard is a placeholder. There are no discovery or play routes.

## Solution Statement

Add a `generationJobs` table so frame generation runs in a separate long-timeout route (`maxDuration = 300`) while the client polls a lightweight status endpoint. Populate `beatGrid` during analysis. Add `published`/`publishedAt` to `styleBriefs`, a publish button in the Studio UI, and public-facing discovery + player pages for listeners using a beat-synced `AuraPlayer` component.

## Feature Metadata

**Feature Type**: Enhancement + New Capability  
**Estimated Complexity**: High  
**Primary Systems Affected**: DB schema, generate API routes, listener UI, player component  
**Dependencies**: All existing (no new packages needed)

---

## CONTEXT REFERENCES

### Relevant Codebase Files — READ BEFORE IMPLEMENTING

- `src/lib/db/schema.ts` — all Drizzle tables; study relations block before adding new tables
- `src/lib/db/index.ts` — Proxy-based lazy init; `db` is safe to import at module level
- `src/lib/auth/server.ts` — lazy `auth.getSession()` returns `{ data: session }` where session is `{ user: { id } }`
- `src/types/index.ts` — `BeatGrid` interface already defined; add `GenerationJob` type here
- `src/lib/spotify.ts` (lines 96-113) — `getAudioAnalysis` already implemented and exported; returns `{ tempo, beats, sections }`
- `src/lib/replicate.ts` — `generateFrames()` is the synchronous call to wrap in a job; study its params
- `src/app/api/generate/analyze/route.ts` — updates `songs` with `narrativeMap`, `moodProfile` but NOT `beatGrid`; must add `getAudioAnalysis` call here
- `src/app/api/generate/frames/route.ts` — current synchronous generation; Phase 2 replaces this with async job dispatch
- `src/app/api/style-briefs/route.ts` — list + create; returns `{ styleBriefs }` array
- `src/app/api/style-briefs/[id]/route.ts` — GET/PATCH/DELETE with ownership check; mirror auth pattern here
- `src/app/(studio)/studio/[id]/page.tsx` — edit page with `onFramesGenerated` callback; update to poll job status
- `src/app/(studio)/studio/page.tsx` — card grid; add published badge
- `src/app/(listener)/dashboard/page.tsx` — placeholder; replace with discovery feed
- `src/app/(listener)/layout.tsx` — listener nav shell; add Discover nav link
- `src/components/studio/preview-player.tsx` — static CSS cross-fade player; read for interface patterns
- `biome.json` — tabs, 100-char width, double quotes, trailing commas, semicolons

### New Files to Create

```
src/lib/db/schema.ts                            — ADD generationJobs table + published fields
src/app/api/generate/frames/route.ts            — REWRITE: dispatch async job, return { jobId }
src/app/api/generate/jobs/[jobId]/route.ts      — NEW: GET poll job status
src/app/api/style-briefs/[id]/publish/route.ts  — NEW: POST toggle published
src/app/api/discover/route.ts                   — NEW: GET public list of published briefs
src/app/api/play/[briefId]/route.ts             — NEW: GET public brief + frames (no auth)
src/components/player/aura-player.tsx           — NEW: beat-sync player
src/app/(listener)/discover/page.tsx            — NEW: listener discovery page
src/app/(listener)/play/[briefId]/page.tsx      — NEW: listener play page
```

### Relevant Documentation

- Vercel `maxDuration`: export `const maxDuration = 300` from any route file to extend timeout to 300s on Pro plan
- Drizzle `pgTable` + `relations` patterns: mirror existing table/relation blocks in `schema.ts` exactly
- Next.js App Router dynamic segments: `{ params: Promise<{ jobId: string }> }` — must `await params` before use (Next.js 15)
- Replicate async prediction API (optional optimization): `replicate.predictions.create()` + `replicate.wait()` — not required if `maxDuration = 300` is sufficient

### Patterns to Follow

**Auth pattern (ALL protected routes):**
```typescript
const { data: session } = await auth.getSession();
if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
```

**Ownership check pattern (from `src/app/api/style-briefs/[id]/route.ts`):**
```typescript
const artist = await db.query.artists.findFirst({ where: eq(artists.userId, session!.user!.id) });
if (!artist) return NextResponse.json({ error: "Artist not found" }, { status: 404 });
// then check brief.artistId === artist.id
```

**Dynamic params (Next.js 15 — params is a Promise):**
```typescript
export async function GET(_req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  ...
}
```

**Drizzle insert + returning:**
```typescript
const [job] = await db.insert(generationJobs).values({ ... }).returning();
```

**Schema table definition (mirror existing style):**
```typescript
export const generationJobs = pgTable("generation_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  styleBriefId: uuid("style_brief_id").notNull().references(() => styleBriefs.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"), // 'pending' | 'running' | 'done' | 'failed'
  error: text("error"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("idx_generation_jobs_brief_id").on(table.styleBriefId)]);
```

**BeatGrid mapping from Spotify AudioAnalysis:**
```typescript
// src/lib/spotify.ts getAudioAnalysis returns:
// { tempo, beats: [{ start (seconds), duration, confidence }], sections: [...] }
// Map to BeatGrid:
const beatGrid: BeatGrid = {
  bpm: analysis.tempo,
  beats: analysis.beats.map(b => ({ startMs: Math.round(b.start * 1000), confidence: b.confidence })),
  sections: analysis.sections.map((s, i) => ({
    startMs: Math.round(s.start * 1000),
    endMs: Math.round((s.start + s.duration) * 1000),
    label: `Section ${i + 1}`,
  })),
};
```

**Beat-sync playback logic:**
```typescript
// Find which frame to show: find the beat nearest to currentMs, then map to frame index
// frames are sorted by sortOrder; advance frame every N beats (e.g. every 8 beats)
const BEATS_PER_FRAME = 8;
const beatIndex = beats.findIndex(b => b.startMs > currentMs) - 1;
const frameIndex = Math.floor(Math.max(0, beatIndex) / BEATS_PER_FRAME) % frames.length;
```

---

## IMPLEMENTATION PLAN

### Phase 1: Schema + Migration

Extend `styleBriefs` with `published`/`publishedAt`, add `generationJobs` table, run migration.

### Phase 2: Beat Grid Population

Update the existing analyze route to call `getAudioAnalysis` after `getAudioFeatures` and persist `beatGrid` to `songs`.

### Phase 3: Async Generation

Rewrite `/api/generate/frames` to insert a `generationJobs` row and immediately return `{ jobId }`. The actual generation happens in a separate route with `maxDuration = 300`. Add a polling endpoint `GET /api/generate/jobs/[jobId]`.

Update the Studio edit page (`studio/[id]/page.tsx`) to poll the job status and call `onFramesGenerated` when done.

### Phase 4: Publish Flow

Add `POST /api/style-briefs/[id]/publish` toggle. Add a Publish/Unpublish button to the Studio edit page. Show published badge on the Studio list page.

### Phase 5: Listener Discovery + Player

Add public routes: `GET /api/discover` (published briefs list) and `GET /api/play/[briefId]` (brief + frames, no auth). Build listener pages: `/discover` (grid) and `/play/[briefId]`. Build the `AuraPlayer` beat-sync component.

---

## STEP-BY-STEP TASKS

### Task 1: UPDATE `src/lib/db/schema.ts`

- **ADD** `published boolean` (default `false`) and `publishedAt timestamp (nullable)` columns to `styleBriefs` table
- **ADD** `generationJobs` table (see schema pattern in Context References above)
- **ADD** `generationJobsRelations` relation: `one(styleBriefs, ...)` 
- **UPDATE** `styleBriefsRelations` to include `many(generationJobs)`
- **IMPORTS**: add `generationJobs` to the existing imports block (already has `boolean`, `timestamp`, etc.)
- **VALIDATE**: `npx tsc --noEmit` — no type errors

### Task 2: RUN DB migration

- **VALIDATE**: `npm run db:push` — applies schema changes to Neon (confirm with `y` if prompted)

### Task 3: UPDATE `src/types/index.ts`

- **ADD** `GenerationJob` type: `export type GenerationJob = InferSelectModel<typeof generationJobs>;`
- **ADD** `generationJobs` to the import from `@/lib/db/schema`
- **VALIDATE**: `npx tsc --noEmit`

### Task 4: UPDATE `src/app/api/generate/analyze/route.ts`

- **ADD** import: `import { getAudioFeatures, getAudioAnalysis } from "@/lib/spotify";` (replace existing single-function import)
- **ADD** import: `import type { BeatGrid } from "@/types";`
- **ADD** after `const audioFeatures = await getAudioFeatures(spotifyTrackId);`:
  ```typescript
  const audioAnalysis = await getAudioAnalysis(spotifyTrackId);
  const beatGrid: BeatGrid = {
    bpm: audioAnalysis.tempo,
    beats: audioAnalysis.beats.map(b => ({ startMs: Math.round(b.start * 1000), confidence: b.confidence })),
    sections: audioAnalysis.sections.map((s, i) => ({
      startMs: Math.round(s.start * 1000),
      endMs: Math.round((s.start + s.duration) * 1000),
      label: `Section ${i + 1}`,
    })),
  };
  ```
- **UPDATE** the `db.update(songs).set({...})` call to also set `beatGrid`
- **GOTCHA**: `beatGrid` column is `jsonb` in Drizzle — pass the typed object directly, Drizzle serializes it
- **VALIDATE**: `npx tsc --noEmit`

### Task 5: ADD `src/app/api/generate/jobs/[jobId]/route.ts` — job status polling

```typescript
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { artists, generationJobs, styleBriefs, generatedFrames } from "@/lib/db/schema";

export async function GET(_req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { data: session } = await auth.getSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { jobId } = await params;

  const job = await db.query.generationJobs.findFirst({ where: eq(generationJobs.id, jobId) });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  // Verify ownership via styleBrief → artist
  const brief = await db.query.styleBriefs.findFirst({ where: eq(styleBriefs.id, job.styleBriefId) });
  const artist = await db.query.artists.findFirst({ where: eq(artists.userId, session!.user!.id) });
  if (!brief || !artist || brief.artistId !== artist.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // If done, return frames too
  if (job.status === "done") {
    const frames = await db.query.generatedFrames.findMany({
      where: eq(generatedFrames.styleBriefId, job.styleBriefId),
      orderBy: (f, { asc }) => [asc(f.sortOrder)],
    });
    return NextResponse.json({ job, frames });
  }

  return NextResponse.json({ job, frames: [] });
}
```

- **VALIDATE**: `npx tsc --noEmit`

### Task 6: ADD `src/app/api/generate/frames/worker/route.ts` — long-running generation worker

This is the actual generation route with extended timeout. It is called by the frames dispatch route (Task 7), not the browser.

```typescript
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generatedFrames, generationJobs, songs, styleBriefs } from "@/lib/db/schema";
import { generateFrames } from "@/lib/replicate";
import type { ArtStyle, MoodProfile, NarrativeMap, PaletteColor } from "@/types";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  // Internal-only route — secured by secret header, not user auth
  const secret = request.headers.get("x-worker-secret");
  if (secret !== process.env.WORKER_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { jobId } = await request.json();

  const job = await db.query.generationJobs.findFirst({ where: eq(generationJobs.id, jobId) });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  await db.update(generationJobs).set({ status: "running", startedAt: new Date() }).where(eq(generationJobs.id, jobId));

  try {
    const [brief, song] = await Promise.all([
      db.query.styleBriefs.findFirst({ where: eq(styleBriefs.id, job.styleBriefId) }),
      db.query.styleBriefs.findFirst({ where: eq(styleBriefs.id, job.styleBriefId) })
        .then(b => b?.songId ? db.query.songs.findFirst({ where: eq(songs.id, b.songId) }) : null),
    ]);

    if (!brief || !song?.narrativeMap || !song.moodProfile) {
      await db.update(generationJobs).set({ status: "failed", error: "Missing brief or song analysis", completedAt: new Date() }).where(eq(generationJobs.id, jobId));
      return NextResponse.json({ error: "Missing data" }, { status: 422 });
    }

    const frames = await generateFrames({
      segments: (song.narrativeMap as NarrativeMap).segments,
      mood: song.moodProfile as MoodProfile,
      artStyle: brief.artStyle as ArtStyle,
      palette: brief.palette as PaletteColor[],
    });

    if (frames.length > 0) {
      await db.insert(generatedFrames).values(
        frames.map(f => ({
          styleBriefId: brief.id,
          songId: song!.id,
          frameUrl: f.frameUrl,
          timestampSeconds: f.timestampSeconds,
          sortOrder: f.sortOrder,
          prompt: f.prompt,
        })),
      );
    }

    await db.update(styleBriefs).set({ status: "ready" }).where(eq(styleBriefs.id, brief.id));
    await db.update(generationJobs).set({ status: "done", completedAt: new Date() }).where(eq(generationJobs.id, jobId));

    return NextResponse.json({ ok: true, frameCount: frames.length });
  } catch (error) {
    console.error("[generate/frames/worker]", error);
    await db.update(generationJobs).set({ status: "failed", error: String(error), completedAt: new Date() }).where(eq(generationJobs.id, jobId));
    await db.update(styleBriefs).set({ status: "draft" }).where(eq(generationJobs.id, jobId)); // reset
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
```

- **GOTCHA**: `db.update(styleBriefs).set({ status: "draft" }).where(eq(generationJobs.id, jobId))` in catch block has wrong table — fix to `eq(styleBriefs.id, job.styleBriefId)` 
- **VALIDATE**: `npx tsc --noEmit`

### Task 7: REWRITE `src/app/api/generate/frames/route.ts` — async dispatch

Replace the synchronous generation with a job dispatch:

```typescript
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { artists, generationJobs, songs, styleBriefs } from "@/lib/db/schema";
import { generateRateLimiter } from "@/lib/rate-limit";
import { generateFramesSchema } from "@/lib/validations";

export async function POST(request: NextRequest) {
  const { data: session } = await auth.getSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!generateRateLimiter.check(session!.user!.id).success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const body = await request.json();
  const parsed = generateFramesSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

  const { songId, styleBriefId } = parsed.data;

  const artist = await db.query.artists.findFirst({ where: eq(artists.userId, session!.user!.id) });
  if (!artist) return NextResponse.json({ error: "Artist not found" }, { status: 404 });

  const [brief, song] = await Promise.all([
    db.query.styleBriefs.findFirst({ where: eq(styleBriefs.id, styleBriefId) }),
    db.query.songs.findFirst({ where: eq(songs.id, songId) }),
  ]);

  if (!brief || brief.artistId !== artist.id) {
    return NextResponse.json({ error: "Style brief not found" }, { status: 404 });
  }
  if (!song?.narrativeMap || !song.moodProfile) {
    return NextResponse.json({ error: "Song must be analyzed first" }, { status: 422 });
  }

  // Create job record
  const [job] = await db.insert(generationJobs).values({ styleBriefId }).returning();

  // Mark brief as generating
  await db.update(styleBriefs).set({ status: "generating" }).where(eq(styleBriefs.id, styleBriefId));

  // Dispatch to worker route (fire-and-forget via fetch)
  const workerUrl = new URL("/api/generate/frames/worker", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");
  fetch(workerUrl.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-worker-secret": process.env.WORKER_SECRET ?? "",
    },
    body: JSON.stringify({ jobId: job.id }),
  }).catch(err => console.error("[generate/frames] worker dispatch failed:", err));

  return NextResponse.json({ jobId: job.id, status: "pending" });
}
```

- **ADD** to `.env.example`: `WORKER_SECRET=` and `NEXT_PUBLIC_APP_URL=`
- **GOTCHA**: `fetch()` from a Next.js route to itself requires `NEXT_PUBLIC_APP_URL` in production (Vercel auto-sets `VERCEL_URL` but not with `https://` prefix — use `NEXT_PUBLIC_APP_URL` explicitly)
- **VALIDATE**: `npx tsc --noEmit`

### Task 8: UPDATE `src/app/(studio)/studio/[id]/page.tsx` — poll job status

- **ADD** state: `const [jobId, setJobId] = useState<string | null>(null);`
- **ADD** state: `const [jobStatus, setJobStatus] = useState<string | null>(null);`
- **UPDATE** `handleFramesGenerated` → replace with `handleGenerationStarted(newJobId: string)` that sets `jobId`
- **ADD** polling `useEffect`:
  ```typescript
  useEffect(() => {
    if (!jobId || jobStatus === "done" || jobStatus === "failed") return;
    const interval = setInterval(async () => {
      const res = await fetch(`/api/generate/jobs/${jobId}`);
      const data = await res.json();
      setJobStatus(data.job?.status ?? null);
      if (data.job?.status === "done" && data.frames?.length) {
        setFrames(data.frames);
        setJobId(null);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [jobId, jobStatus]);
  ```
- **UPDATE** `StyleBriefForm` prop: `onFramesGenerated` → receives `{ jobId: string }` from the API response; set jobId state
- **ADD** generating status indicator: when `jobStatus === "running"` or `"pending"`, show spinner with "Generating frames…"
- **VALIDATE**: `npx tsc --noEmit`

### Task 9: UPDATE `src/components/studio/style-brief-form.tsx` — update onFramesGenerated signature

- **UPDATE** prop type: `onFramesGenerated?: (jobId: string) => void` (was `(frames: GeneratedFrame[]) => void`)
- **UPDATE** the generate button's fetch handler: after `POST /api/generate/frames`, call `onFramesGenerated(data.jobId)` instead of passing frames
- **VALIDATE**: `npx tsc --noEmit`

### Task 10: ADD `src/app/api/style-briefs/[id]/publish/route.ts` — publish toggle

```typescript
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { artists, styleBriefs } from "@/lib/db/schema";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { data: session } = await auth.getSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const artist = await db.query.artists.findFirst({ where: eq(artists.userId, session!.user!.id) });
  if (!artist) return NextResponse.json({ error: "Artist not found" }, { status: 404 });

  const brief = await db.query.styleBriefs.findFirst({ where: eq(styleBriefs.id, id) });
  if (!brief || brief.artistId !== artist.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (brief.status !== "ready") {
    return NextResponse.json({ error: "Brief must be ready before publishing" }, { status: 422 });
  }

  const nowPublished = !brief.published;
  const [updated] = await db
    .update(styleBriefs)
    .set({ published: nowPublished, publishedAt: nowPublished ? new Date() : null })
    .where(eq(styleBriefs.id, id))
    .returning();

  return NextResponse.json({ styleBrief: updated });
}
```

- **VALIDATE**: `npx tsc --noEmit`

### Task 11: UPDATE `src/app/(studio)/studio/[id]/page.tsx` — add Publish button

- **ADD** state: `const [publishing, setPublishing] = useState(false);`
- **ADD** handler:
  ```typescript
  const handlePublish = async () => {
    if (!brief) return;
    setPublishing(true);
    const res = await fetch(`/api/style-briefs/${brief.id}/publish`, { method: "POST" });
    const data = await res.json();
    if (data.styleBrief) setBrief(prev => prev ? { ...prev, ...data.styleBrief } : null);
    setPublishing(false);
  };
  ```
- **ADD** to the page header (alongside the title): a `Button` that shows "Publish" or "Unpublish" based on `brief.published`, disabled when `brief.status !== "ready"` or `publishing`
- **VALIDATE**: `npx tsc --noEmit`

### Task 12: UPDATE `src/app/(studio)/studio/page.tsx` — published badge

- **UPDATE** `statusColors` map: add `published: "bg-blue-100 text-blue-700"`
- **UPDATE** card status badge: if `brief.published` show "published" badge in addition to (or instead of) the status badge
- **VALIDATE**: `npx tsc --noEmit`

### Task 13: ADD `src/app/api/discover/route.ts` — public discovery list

```typescript
import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { artists, songs, styleBriefs } from "@/lib/db/schema";

export async function GET() {
  const published = await db.query.styleBriefs.findMany({
    where: and(eq(styleBriefs.published, true), eq(styleBriefs.status, "ready")),
    with: { song: true, artist: true },
    orderBy: [desc(styleBriefs.publishedAt)],
    limit: 50,
  });

  return NextResponse.json({ briefs: published });
}
```

- **GOTCHA**: `and(eq(...), eq(...))` — import `and` from `drizzle-orm`
- **VALIDATE**: `npx tsc --noEmit`

### Task 14: ADD `src/app/api/play/[briefId]/route.ts` — public play data

```typescript
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generatedFrames, styleBriefs } from "@/lib/db/schema";

export async function GET(_req: Request, { params }: { params: Promise<{ briefId: string }> }) {
  const { briefId } = await params;

  const brief = await db.query.styleBriefs.findFirst({
    where: eq(styleBriefs.id, briefId),
    with: { song: true, artist: true },
  });

  if (!brief?.published) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const frames = await db.query.generatedFrames.findMany({
    where: eq(generatedFrames.styleBriefId, briefId),
    orderBy: (f, { asc }) => [asc(f.sortOrder)],
  });

  return NextResponse.json({ brief, frames });
}
```

- **VALIDATE**: `npx tsc --noEmit`

### Task 15: ADD `src/components/player/aura-player.tsx` — beat-sync player

```typescript
"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import type { BeatGrid, GeneratedFrame } from "@/types";

interface AuraPlayerProps {
  frames: GeneratedFrame[];
  beatGrid: BeatGrid | null;
  durationMs: number;
}

const BEATS_PER_FRAME = 8;
const FALLBACK_INTERVAL_MS = 4000;

export function AuraPlayer({ frames, beatGrid, durationMs }: AuraPlayerProps) {
  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  const getFrameForMs = useCallback((currentMs: number): number => {
    if (!beatGrid?.beats.length) {
      // Fallback: fixed interval
      return Math.floor(currentMs / FALLBACK_INTERVAL_MS) % frames.length;
    }
    const beats = beatGrid.beats;
    const beatIdx = beats.findIndex(b => b.startMs > currentMs) - 1;
    return Math.floor(Math.max(0, beatIdx) / BEATS_PER_FRAME) % frames.length;
  }, [beatGrid, frames.length]);

  const tick = useCallback(() => {
    if (!startTimeRef.current) return;
    const elapsed = Date.now() - startTimeRef.current;
    if (elapsed >= durationMs) {
      // Loop
      startTimeRef.current = Date.now();
    }
    setFrameIndex(getFrameForMs(elapsed % durationMs));
    rafRef.current = requestAnimationFrame(tick);
  }, [durationMs, getFrameForMs]);

  const play = () => {
    startTimeRef.current = Date.now();
    setPlaying(true);
    rafRef.current = requestAnimationFrame(tick);
  };

  const pause = () => {
    setPlaying(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  };

  useEffect(() => {
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  if (!frames.length) return null;

  const current = frames[frameIndex];

  return (
    <div className="space-y-4">
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
        <Image
          key={current.id}
          src={current.frameUrl}
          alt={`Frame ${frameIndex + 1}`}
          fill
          className="object-cover transition-opacity duration-300"
          priority
        />
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={playing ? pause : play}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {playing ? "Pause" : "Play"}
        </button>
        <p className="text-xs text-muted-foreground">
          {frameIndex + 1} / {frames.length}
          {beatGrid ? ` · ${Math.round(beatGrid.bpm)} BPM` : ""}
        </p>
      </div>

      {/* Thumbnail strip */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {frames.map((f, i) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFrameIndex(i)}
            className={`relative h-12 w-20 flex-shrink-0 overflow-hidden rounded ${
              i === frameIndex ? "ring-2 ring-primary" : "opacity-60 hover:opacity-100"
            }`}
          >
            <Image src={f.frameUrl} alt={`${i + 1}`} fill className="object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}
```

- **VALIDATE**: `npx tsc --noEmit`

### Task 16: ADD `src/app/(listener)/discover/page.tsx`

```typescript
"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Artist, Song, StyleBrief } from "@/types";

type DiscoverBrief = StyleBrief & { song: Song | null; artist: Artist };

export default function DiscoverPage() {
  const [briefs, setBriefs] = useState<DiscoverBrief[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/discover")
      .then(r => r.json())
      .then(data => setBriefs(data.briefs ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-16"><p className="text-muted-foreground">Loading...</p></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Discover</h1>
      {briefs.length === 0 && (
        <p className="py-16 text-center text-muted-foreground">No experiences published yet.</p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {briefs.map(brief => (
          <Link key={brief.id} href={`/play/${brief.id}`}>
            <Card className="cursor-pointer transition-shadow hover:shadow-md">
              <CardHeader>
                <CardTitle className="line-clamp-1 text-base">{brief.title || "Untitled"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <p className="text-sm text-muted-foreground">{brief.artist.displayName}</p>
                {brief.song && (
                  <p className="text-xs text-muted-foreground">{brief.song.title} — {brief.song.artistName}</p>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- **VALIDATE**: `npx tsc --noEmit`

### Task 17: ADD `src/app/(listener)/play/[briefId]/page.tsx`

```typescript
"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AuraPlayer } from "@/components/player/aura-player";
import type { Artist, BeatGrid, GeneratedFrame, Song, StyleBrief } from "@/types";

type PlayBrief = StyleBrief & { song: Song | null; artist: Artist };

export default function PlayPage() {
  const { briefId } = useParams<{ briefId: string }>();
  const [brief, setBrief] = useState<PlayBrief | null>(null);
  const [frames, setFrames] = useState<GeneratedFrame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!briefId) return;
    fetch(`/api/play/${briefId}`)
      .then(r => r.json())
      .then(data => {
        if (data.brief) { setBrief(data.brief); setFrames(data.frames ?? []); }
        else setError("Not found");
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }, [briefId]);

  if (loading) return <div className="flex justify-center py-16"><p className="text-muted-foreground">Loading...</p></div>;
  if (error || !brief) return <div className="flex justify-center py-16"><p className="text-destructive">{error || "Not found"}</p></div>;

  const beatGrid = brief.song?.beatGrid as BeatGrid | null ?? null;
  const durationMs = brief.song?.durationMs ?? 240_000;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{brief.title || "Untitled"}</h1>
        <p className="text-muted-foreground">{brief.artist.displayName}</p>
        {brief.song && (
          <p className="mt-1 text-sm text-muted-foreground">{brief.song.title} — {brief.song.artistName}</p>
        )}
      </div>
      <AuraPlayer frames={frames} beatGrid={beatGrid} durationMs={durationMs} />
    </div>
  );
}
```

- **VALIDATE**: `npx tsc --noEmit`

### Task 18: UPDATE `src/app/(listener)/dashboard/page.tsx` — replace placeholder

```typescript
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
      <h1 className="text-2xl font-semibold">Welcome to Aura</h1>
      <p className="text-muted-foreground">Discover generative visual experiences from your favourite artists.</p>
      <Button asChild>
        <Link href="/discover">Browse Experiences</Link>
      </Button>
    </div>
  );
}
```

- **VALIDATE**: `npx tsc --noEmit`

### Task 19: UPDATE `src/app/(listener)/layout.tsx` — add Discover nav link

- **ADD** a `<Link href="/discover">` nav item between the logo and sign-out button
- **VALIDATE**: `npx tsc --noEmit`

### Task 20: FINAL BUILD VALIDATION

- **VALIDATE**: `npm run build` — zero errors, zero type errors
- **VALIDATE**: `npm run lint` (Biome check) — zero warnings

---

## TESTING STRATEGY

### Unit Tests

- `src/lib/spotify.ts` — mock `spotifyFetch`, assert `getAudioAnalysis` maps `beats[].start` seconds → `startMs` milliseconds correctly
- Beat-sync logic — pure function test: given a `BeatGrid` with known beats, assert `getFrameForMs` returns correct frame index at various timestamps

### Integration Tests (manual — no test infra for API routes in Phase 1)

- POST `/api/generate/analyze` with a valid `styleBriefId` + `spotifyTrackId` → response includes `song.beatGrid` with `bpm` and `beats` array
- POST `/api/generate/frames` → returns `{ jobId, status: "pending" }` immediately (< 2s)
- GET `/api/generate/jobs/[jobId]` immediately after dispatch → `{ job: { status: "pending" | "running" } }`
- POST `/api/style-briefs/[id]/publish` → toggles `published`; rejects if `status !== "ready"`
- GET `/api/discover` → returns only `published: true && status: "ready"` briefs
- GET `/api/play/[briefId]` → returns brief + frames without auth; 404 for unpublished

### Edge Cases

- `beatGrid` is null (song analyzed before Phase 2) → `AuraPlayer` falls back to 4s fixed interval
- Worker receives job where `song.narrativeMap` is null → sets job `status: "failed"` gracefully
- Publish called on `status: "generating"` brief → 422 response
- `durationMs` is null on song → `AuraPlayer` defaults to 240_000ms (4 minutes)

---

## VALIDATION COMMANDS

### Level 1: Type Check
```bash
npx tsc --noEmit
```

### Level 2: Lint
```bash
npx biome check --write src/
```

### Level 3: Build
```bash
npm run build
```

### Level 4: DB Migration
```bash
npm run db:push
```

### Level 5: Manual API Validation
```bash
# Analyze (populates beatGrid)
curl -X POST http://localhost:3000/api/generate/analyze \
  -H "Content-Type: application/json" \
  -d '{"spotifyTrackId":"...","styleBriefId":"...","trackTitle":"...","artistName":"..."}'

# Dispatch async generation
curl -X POST http://localhost:3000/api/generate/frames \
  -H "Content-Type: application/json" \
  -d '{"songId":"...","styleBriefId":"...","frameCount":10}'
# → should return { jobId, status: "pending" } in < 2s

# Poll job
curl http://localhost:3000/api/generate/jobs/{jobId}

# Publish
curl -X POST http://localhost:3000/api/style-briefs/{id}/publish

# Public discovery (no auth)
curl http://localhost:3000/api/discover
curl http://localhost:3000/api/play/{briefId}
```

---

## ACCEPTANCE CRITERIA

- [ ] `songs.beatGrid` is populated after `/api/generate/analyze` succeeds
- [ ] POST `/api/generate/frames` returns `{ jobId }` within 2 seconds (no timeout risk)
- [ ] GET `/api/generate/jobs/[jobId]` returns correct status and frames when done
- [ ] Workers route (`/api/generate/frames/worker`) uses `maxDuration = 300`
- [ ] Artists can publish/unpublish ready style briefs
- [ ] Only `published: true && status: "ready"` briefs appear in `/api/discover`
- [ ] `/api/play/[briefId]` returns 404 for unpublished briefs
- [ ] `AuraPlayer` advances frames on beat boundaries when `beatGrid` is present
- [ ] `AuraPlayer` falls back to 4s interval when `beatGrid` is null
- [ ] Listener `/discover` page shows published brief cards
- [ ] Listener `/play/[briefId]` page renders `AuraPlayer` with beat-sync data
- [ ] `npm run build` exits 0 with no type errors
- [ ] No regressions: Studio create/edit/preview flow still works

---

## COMPLETION CHECKLIST

- [ ] All 20 tasks completed in order
- [ ] `npm run db:push` applied schema changes
- [ ] `npx tsc --noEmit` passes after each task
- [ ] `npm run build` passes at the end
- [ ] Manual API tests for all new endpoints pass
- [ ] Beat-sync playback verified in browser with a real brief

---

## NOTES

**Worker secret pattern**: The `/api/generate/frames/worker` route is secured by a shared secret (`WORKER_SECRET`) rather than user auth. This is a simple internal-only pattern. For production, consider using a proper queue (e.g., Inngest, QStash) instead of self-calling fetch.

**Why fire-and-forget fetch**: Next.js 15 does not yet have native background job support in App Router without an external queue. Calling `fetch()` to a long-timeout route and returning `{ jobId }` immediately is the lowest-complexity approach that works on Vercel Pro. The worker route must have `maxDuration = 300`.

**`NEXT_PUBLIC_APP_URL` env var**: Must be set in Vercel environment variables. In development it defaults to `http://localhost:3000`. Without this, the worker dispatch fetch will fail in production.

**Beat-sync timing**: `requestAnimationFrame` is used instead of `setInterval` for smooth frame advancement. The loop tracks wall-clock elapsed time via `Date.now()` against `startTimeRef`. This approach avoids timer drift. There is no actual audio playback — the visual syncs to simulated time, not a playing audio track. Adding real audio sync (Web Audio API) is a Phase 3 concern.

**Confidence Score: 8/10** — All integration points are mapped to specific files and line numbers. The main risk is the fire-and-forget worker pattern on Vercel (platform-specific behavior). If Vercel terminates the originating request before the worker completes, use QStash or Inngest as a drop-in replacement for the dispatch step only.
