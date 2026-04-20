# Feature: Aura Phase 1 — Artist Studio + Single-Song Visual Generation

The following plan should be complete, but validate documentation and codebase patterns before implementing. Pay special attention to import paths (use `@/*` alias), Drizzle schema patterns, and Neon Auth session patterns.

---

## Feature Description

Phase 1 of Aura: a generative visual music experience platform. Artists sign up, define a Style Brief (palette, art style, layer weights, reference images, linked Spotify track), and trigger pre-generation of 10-15 visual frames for that song. Claude analyzes the lyrics and mood; Replicate (SDXL) generates the frames; a browser preview player cycles through them with CSS transitions. Listeners get a placeholder dashboard.

## User Stories

**Artist:** As an artist, I want to define my visual language for a song and see AI-generated preview frames so I can validate how Aura will represent my music visually.

**Listener:** As a listener, I want to create an account so I can access the platform when artist content is available.

## Problem Statement

The codebase is a cleaned link-in-bio scaffold. It has auth, a DB connection, and UI primitives — but everything specific to Aura (schema, API routes, Studio UI, generation pipeline) is missing. The signup form is broken (calls a deleted API route). The app has no concept of user roles.

## Solution Statement

Build on the existing auth + Neon + Next.js scaffold. Add role-based auth (Artist / Listener), full Drizzle schema, external API clients (Spotify, Genius, Claude, Replicate, Vercel Blob), a complete set of Studio API routes, and the Artist Studio UI ending with a working in-browser preview player.

## Feature Metadata

**Feature Type**: New Capability  
**Estimated Complexity**: High  
**Primary Systems Affected**: Auth, DB schema, API routes, Studio UI, generation pipeline  
**Dependencies**: `@anthropic-ai/sdk`, `replicate`, `@vercel/blob`, `genius-lyrics`

---

## CONTEXT REFERENCES

### Relevant Codebase Files — READ BEFORE IMPLEMENTING

- `src/lib/db/schema.ts` — currently empty placeholder; this is where ALL Drizzle tables go
- `src/lib/db/index.ts` — Drizzle client pattern: `neon(process.env.DATABASE_URL!)` + `drizzle(sql, { schema })`
- `src/types/index.ts` — currently empty; add `InferSelectModel` types here
- `src/lib/validations.ts` — currently empty; add all Zod schemas here
- `src/lib/rate-limit.ts` (lines 1-35) — `createRateLimiter(maxRequests, windowMs)` pattern; `apiRateLimiter` is pre-exported
- `src/lib/auth/client.ts` — `authClient` via `createAuthClient()` from `@neondatabase/auth/next`
- `src/lib/auth/server.ts` — `auth` via `createAuthServer()` from `@neondatabase/auth/next/server`
- `src/middleware.ts` — cookie-based session check pattern; update matcher for new Aura routes
- `src/app/layout.tsx` — root layout with `AuthProvider` + `Toaster`; update metadata
- `src/app/(auth)/layout.tsx` — centered card layout for auth pages
- `src/app/(dashboard)/layout.tsx` — nav shell with sign-out; currently references old routes
- `src/components/auth/signup-form.tsx` — BROKEN: calls deleted `/api/profile` POST and imports empty `slugSchema`; full rewrite needed
- `src/components/auth/login-form.tsx` — redirects to `/editor` after login; update to role-based redirect
- `src/components/auth/google-button.tsx` — Google OAuth button (keep as-is)
- `src/components/auth/auth-provider.tsx` — `NeonAuthUIProvider` wrapper (keep as-is)
- `src/components/ui/*` — shadcn/ui primitives available: button, card, dialog, dropdown-menu, input, label, separator, sonner, tabs, textarea, avatar
- `src/app/api/auth/[...path]/route.ts` — Neon Auth catch-all handler (keep as-is)
- `drizzle.config.ts` — schema path `./src/lib/db/schema.ts`, out `./drizzle`
- `.env.example` — add new env vars here
- `package.json` — name is still `link-in-bio-page-builder`; add new deps
- `biome.json` — tabs, 100 char width, double quotes, trailing commas, semicolons

### Files to Delete

- `src/components/auth/slug-input.tsx` — slug concept removed from Aura

### New Files to Create

```
src/lib/spotify.ts                          — Spotify Client Credentials client (search + audio features/analysis)
src/lib/genius.ts                           — Genius lyrics client (genius-lyrics package wrapper)
src/lib/claude.ts                           — Anthropic Claude client (lyric + mood analysis)
src/lib/replicate.ts                        — Replicate client (SDXL frame generation)

src/app/onboarding/page.tsx                 — Role selection page (Artist / Listener) post-signup
src/app/(studio)/layout.tsx                 — Studio shell layout (artist-only nav)
src/app/(studio)/studio/page.tsx            — Style Brief list dashboard
src/app/(studio)/studio/new/page.tsx        — Create Style Brief wizard
src/app/(studio)/studio/[id]/page.tsx       — Edit Style Brief + preview player

src/app/(listener)/layout.tsx               — Listener shell layout
src/app/(listener)/dashboard/page.tsx       — Listener placeholder dashboard

src/app/api/users/me/route.ts               — GET current user (id, role, artist profile)
src/app/api/users/role/route.ts             — POST set user role (artist | listener) after onboarding
src/app/api/artists/route.ts                — POST create artist profile
src/app/api/spotify/search/route.ts         — GET search Spotify tracks/albums
src/app/api/spotify/analysis/[id]/route.ts  — GET Spotify Audio Analysis for a track
src/app/api/genius/lyrics/route.ts          — GET fetch lyrics for a track
src/app/api/upload/reference-image/route.ts — POST upload reference image to Vercel Blob
src/app/api/style-briefs/route.ts           — GET list / POST create style brief
src/app/api/style-briefs/[id]/route.ts      — GET / PUT / DELETE single style brief
src/app/api/generate/analyze/route.ts       — POST run Claude lyric + mood analysis for a song
src/app/api/generate/frames/route.ts        — POST trigger Replicate frame generation
src/app/api/generate/frames/[songId]/route.ts — GET generated frames for a song

src/components/studio/style-brief-form.tsx  — Main style brief form container
src/components/studio/palette-picker.tsx    — Up to 8 HEX color swatches with add/remove
src/components/studio/art-style-selector.tsx — Taxonomy grid + free text input
src/components/studio/layer-weight-sliders.tsx — Mood/Audio/Lyrics sliders that sum to 100
src/components/studio/reference-image-upload.tsx — Drag-and-drop + click upload (3-10 images)
src/components/studio/spotify-track-search.tsx — Debounced search, result list, select handler
src/components/studio/preview-player.tsx    — Frame cycling player with CSS transitions

src/lib/__tests__/spotify.test.ts           — Unit tests for Spotify client
src/lib/__tests__/claude.test.ts            — Unit tests for Claude analysis functions
```

### Relevant Documentation — READ BEFORE IMPLEMENTING

- Neon Auth Next.js: https://neon.com/docs/auth/overview — session retrieval in API routes uses `auth.getSession(req)`
- Drizzle ORM pgTable: https://orm.drizzle.team/docs/sql-schema-declaration — follow existing `pgTable` + `relations` pattern in schema.ts
- Drizzle jsonb: https://orm.drizzle.team/docs/column-types/pg#jsonb — use `jsonb()` for narrative_map, mood_profile, beat_grid, palette, layer_weights
- Vercel Blob: https://vercel.com/docs/storage/vercel-blob/using-blob-sdk#upload-a-blob — `put(filename, body, { access: 'public' })` returns `{ url }`
- Replicate Node SDK: https://github.com/replicate/replicate-javascript — `replicate.run(model, { input })` returns output array; for SDXL use `stability-ai/sdxl`
- Anthropic SDK: https://docs.anthropic.com/en/api/getting-started — use `client.messages.create({ model: 'claude-sonnet-4-6', max_tokens, messages })`
- Spotify Client Credentials: https://developer.spotify.com/documentation/web-api/tutorials/client-credentials-flow — POST to `https://accounts.spotify.com/api/token` with `grant_type=client_credentials`
- Spotify Audio Analysis: https://developer.spotify.com/documentation/web-api/reference/get-audio-analysis — returns beats[], sections[], segments[] arrays
- genius-lyrics package: https://genius-lyrics.js.org/ — `const Genius = require('genius-lyrics'); const client = new Genius.Client(token); const searches = await client.songs.search(query); const lyrics = await searches[0].lyrics()`
- shadcn/ui Slider: https://ui.shadcn.com/docs/components/slider — `npx shadcn add slider` then `import { Slider } from '@/components/ui/slider'`

### Patterns to Follow

**DB Client (mirror `src/lib/db/index.ts`):**
```typescript
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";
const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });
```

**Drizzle Table (mirror existing schema pattern):**
```typescript
export const myTable = pgTable(
  "my_table",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("idx_my_table_user_id").on(table.userId)],
);
```

**API Route auth check (all protected routes):**
```typescript
import { auth } from "@/lib/auth/server";
const session = await auth.getSession(request);
if (!session?.userId) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

**API Route rate limiting:**
```typescript
import { apiRateLimiter } from "@/lib/rate-limit";
const ip = request.headers.get("x-forwarded-for") ?? "unknown";
const { success } = apiRateLimiter.check(ip);
if (!success) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
```

**Biome formatting:**
- Tabs for indentation
- Double quotes for strings
- Trailing commas in multi-line
- Semicolons required
- Line width 100 chars
- Run `npm run lint:fix` after each file

**Naming conventions:**
- Files: kebab-case (`style-brief-form.tsx`)
- Components: PascalCase (`StyleBriefForm`)
- DB tables: snake_case (`style_briefs`)
- Drizzle exports: camelCase (`styleBriefs`)
- Types: PascalCase (`StyleBrief`)
- API routes: REST conventions, kebab-case paths

**Client component pattern:**
- Top of file: `"use client";`
- Server components by default (no directive needed)
- Use `useState` / `useCallback` only in client components

**Error handling in API routes:**
```typescript
try {
  // ...
} catch (error) {
  console.error("[route-name]", error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
```

---

## IMPLEMENTATION PLAN

### Phase 1: Foundation & Cleanup

Resolve broken state, update config, add dependencies, clear dead code.

### Phase 2: Database Schema + Types

All Drizzle tables, relations, and TypeScript types in one pass so subsequent phases have correct imports.

### Phase 3: Fix Auth + Role System

Rewrite signup, add onboarding, update login redirect, update middleware and dashboard layout.

### Phase 4: External API Clients

Isolated, testable client modules for Spotify, Genius, Claude, Replicate. No UI, no routes yet.

### Phase 5: API Routes

All server-side endpoints. Build in dependency order: users → artists → Spotify/Genius passthrough → upload → style-briefs → generate.

### Phase 6: Studio UI

Pages and components. Build in dependency order: layout → list → create → edit+preview.

### Phase 7: Tests + Validation

Unit tests for clients and schemas. Run full validation suite.

---

## STEP-BY-STEP TASKS

### TASK 1: UPDATE package.json

- **UPDATE** `"name"` field: `"link-in-bio-page-builder"` → `"aura"`
- **ADD** to `dependencies`:
  ```json
  "@anthropic-ai/sdk": "^0.39.0",
  "replicate": "^1.0.1",
  "@vercel/blob": "^0.27.0",
  "genius-lyrics": "^4.4.9"
  ```
- **REMOVE** from `dependencies`: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` (link-in-bio remnants, not needed for Phase 1)
- **VALIDATE**: `npm install --legacy-peer-deps`

### TASK 2: UPDATE .env.example

- **ADD** new env vars below existing ones:
  ```env
  # Spotify API (Client Credentials — no user OAuth needed for Phase 1)
  SPOTIFY_CLIENT_ID=
  SPOTIFY_CLIENT_SECRET=

  # Genius API
  GENIUS_ACCESS_TOKEN=

  # Anthropic Claude
  ANTHROPIC_API_KEY=

  # Replicate
  REPLICATE_API_TOKEN=

  # Vercel Blob
  BLOB_READ_WRITE_TOKEN=

  # App
  NEXT_PUBLIC_APP_URL=http://localhost:3000
  ```
- **VALIDATE**: File saves cleanly

### TASK 3: UPDATE src/app/layout.tsx metadata

- **UPDATE** metadata:
  ```typescript
  export const metadata: Metadata = {
    title: "Aura",
    description: "Where music becomes visual",
  };
  ```
- **VALIDATE**: `npm run lint`

### TASK 4: DELETE src/components/auth/slug-input.tsx

- **REMOVE** the file entirely
- **VALIDATE**: `ls src/components/auth/` — slug-input.tsx gone

### TASK 5: ADD shadcn Slider component

- **RUN**: `npx shadcn add slider` (needed for layer weight sliders)
- **VALIDATE**: `ls src/components/ui/slider.tsx`

### TASK 6: UPDATE src/lib/db/schema.ts — full Aura schema

Replace the placeholder comment with all tables. Import order matters for foreign key references.

```typescript
import { relations } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  boolean,
} from "drizzle-orm/pg-core";

// User metadata (extends Neon Auth neon_auth.users)
// role: 'artist' | 'listener' | null (null = onboarding not complete)
export const usersMeta = pgTable(
  "users_meta",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull().unique(),
    role: text("role"), // 'artist' | 'listener'
    onboardingComplete: boolean("onboarding_complete").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("idx_users_meta_user_id").on(table.userId)],
);

// Artist profiles
export const artists = pgTable(
  "artists",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull().unique(),
    spotifyArtistId: text("spotify_artist_id"),
    displayName: text("display_name").notNull().default(""),
    verified: boolean("verified").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_artists_user_id").on(table.userId),
    index("idx_artists_spotify_id").on(table.spotifyArtistId),
  ],
);

// Songs (cached metadata + analysis results)
// narrative_map: { segments: Array<{ startMs, endMs, prompt, themes, imagery }> }
// mood_profile: { valence, energy, quadrant, tone, paletteHint, textureChar }
// beat_grid: { bpm, beats: Array<{ startMs, confidence }>, sections: Array<{ startMs, label }> }
export const songs = pgTable(
  "songs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    spotifyTrackId: text("spotify_track_id").notNull().unique(),
    geniusId: text("genius_id"),
    title: text("title").notNull(),
    artistName: text("artist_name").notNull(),
    albumName: text("album_name"),
    durationMs: integer("duration_ms"),
    lyricsCache: text("lyrics_cache"),
    narrativeMap: jsonb("narrative_map"),
    moodProfile: jsonb("mood_profile"),
    beatGrid: jsonb("beat_grid"),
    analyzedAt: timestamp("analyzed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("idx_songs_spotify_track_id").on(table.spotifyTrackId)],
);

// Style Briefs
// palette: Array<{ hex: string, label: string }>
// artStyle: { descriptors: string[], freeText: string }
// layerWeights: { mood: number, audio: number, lyrics: number } (sum = 100)
// referenceImageUrls: string[]
export const styleBriefs = pgTable(
  "style_briefs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
    songId: uuid("song_id").references(() => songs.id, { onDelete: "set null" }),
    title: text("title").notNull().default(""),
    palette: jsonb("palette").notNull().default([]),
    artStyle: jsonb("art_style").notNull().default({}),
    layerWeights: jsonb("layer_weights").notNull().default({ mood: 33, audio: 33, lyrics: 34 }),
    referenceImageUrls: jsonb("reference_image_urls").notNull().default([]),
    status: text("status").notNull().default("draft"), // 'draft' | 'generating' | 'ready'
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_style_briefs_artist_id").on(table.artistId),
    index("idx_style_briefs_song_id").on(table.songId),
  ],
);

// Generated frames
// prompt: the full composite prompt used for this frame
export const generatedFrames = pgTable(
  "generated_frames",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    styleBriefId: uuid("style_brief_id")
      .notNull()
      .references(() => styleBriefs.id, { onDelete: "cascade" }),
    songId: uuid("song_id")
      .notNull()
      .references(() => songs.id, { onDelete: "cascade" }),
    frameUrl: text("frame_url").notNull(),
    timestampSeconds: integer("timestamp_seconds").notNull().default(0),
    sortOrder: integer("sort_order").notNull().default(0),
    prompt: text("prompt"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_generated_frames_brief_id").on(table.styleBriefId),
    index("idx_generated_frames_song_id").on(table.songId),
  ],
);

// Relations
export const usersMetaRelations = relations(usersMeta, ({ one }) => ({
  artist: one(artists, { fields: [usersMeta.userId], references: [artists.userId] }),
}));

export const artistsRelations = relations(artists, ({ many }) => ({
  styleBriefs: many(styleBriefs),
}));

export const songsRelations = relations(songs, ({ many }) => ({
  styleBriefs: many(styleBriefs),
  generatedFrames: many(generatedFrames),
}));

export const styleBriefsRelations = relations(styleBriefs, ({ one, many }) => ({
  artist: one(artists, { fields: [styleBriefs.artistId], references: [artists.id] }),
  song: one(songs, { fields: [styleBriefs.songId], references: [songs.id] }),
  generatedFrames: many(generatedFrames),
}));

export const generatedFramesRelations = relations(generatedFrames, ({ one }) => ({
  styleBrief: one(styleBriefs, {
    fields: [generatedFrames.styleBriefId],
    references: [styleBriefs.id],
  }),
  song: one(songs, { fields: [generatedFrames.songId], references: [songs.id] }),
}));
```

- **VALIDATE**: `npm run db:push` (pushes schema to Neon)

### TASK 7: UPDATE src/types/index.ts

```typescript
import type { InferSelectModel } from "drizzle-orm";
import type { artists, generatedFrames, songs, styleBriefs, usersMeta } from "@/lib/db/schema";

export type UserMeta = InferSelectModel<typeof usersMeta>;
export type Artist = InferSelectModel<typeof artists>;
export type Song = InferSelectModel<typeof songs>;
export type StyleBrief = InferSelectModel<typeof styleBriefs>;
export type GeneratedFrame = InferSelectModel<typeof generatedFrames>;

export type UserRole = "artist" | "listener";

// Style Brief sub-types (matching jsonb fields)
export interface PaletteColor {
  hex: string;
  label: string;
}

export interface ArtStyle {
  descriptors: string[];
  freeText: string;
}

export interface LayerWeights {
  mood: number;   // 0-100, sum of all three = 100
  audio: number;
  lyrics: number;
}

// Narrative map segment (Agent 02 output, stored in songs.narrative_map)
export interface NarrativeSegment {
  startMs: number;
  endMs: number;
  lyrics: string;
  prompt: string;
  themes: string[];
  imagery: string[];
}

export interface NarrativeMap {
  segments: NarrativeSegment[];
  dominantThemes: string[];
  intensityArc: Array<{ timestampMs: number; intensity: number }>;
}

// Mood profile (Agent 03 output, stored in songs.mood_profile)
export interface MoodProfile {
  valence: number;       // 0-1 from Spotify
  energy: number;        // 0-1 from Spotify
  quadrant: string;      // 'high-valence-high-energy' | etc.
  tone: string;          // 'triumphant' | 'melancholic' | 'anxious' | 'euphoric' | etc.
  paletteHint: string;   // 'warm-saturated' | 'cool-muted' | etc.
  textureChar: string;   // 'sharp' | 'soft' | 'fluid' | 'fractured'
}

// Beat grid (from Spotify Audio Analysis, stored in songs.beat_grid)
export interface BeatGrid {
  bpm: number;
  beats: Array<{ startMs: number; confidence: number }>;
  sections: Array<{ startMs: number; endMs: number; label: string }>;
}

// Spotify search result (used in UI, not stored)
export interface SpotifyTrack {
  id: string;
  name: string;
  artistName: string;
  albumName: string;
  durationMs: number;
  albumArtUrl: string | null;
}
```

- **VALIDATE**: `npm run build` (type check only — will fail on missing pages, but types should be clean)

### TASK 8: UPDATE src/lib/validations.ts

```typescript
import { z } from "zod";

export const userRoleSchema = z.enum(["artist", "listener"]);

export const paletteColorSchema = z.object({
  hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color"),
  label: z.string().max(50),
});

export const artStyleSchema = z.object({
  descriptors: z.array(z.string()).max(10),
  freeText: z.string().max(500),
});

export const layerWeightsSchema = z
  .object({
    mood: z.number().int().min(0).max(100),
    audio: z.number().int().min(0).max(100),
    lyrics: z.number().int().min(0).max(100),
  })
  .refine((w) => w.mood + w.audio + w.lyrics === 100, {
    message: "Layer weights must sum to 100",
  });

export const styleBriefSchema = z.object({
  title: z.string().max(100),
  songId: z.string().uuid().optional(),
  palette: z.array(paletteColorSchema).max(8),
  artStyle: artStyleSchema,
  layerWeights: layerWeightsSchema,
  referenceImageUrls: z.array(z.string().url()).min(0).max(10),
});

export const spotifySearchSchema = z.object({
  q: z.string().min(1).max(200),
});

export const generateAnalyzeSchema = z.object({
  spotifyTrackId: z.string().min(1),
  styleBriefId: z.string().uuid(),
});

export const generateFramesSchema = z.object({
  songId: z.string().uuid(),
  styleBriefId: z.string().uuid(),
  frameCount: z.number().int().min(5).max(15).default(10),
});
```

- **VALIDATE**: `npm run lint`

### TASK 9: UPDATE src/lib/rate-limit.ts

- **REMOVE** `slugCheckRateLimiter` export (slug concept gone)
- **ADD** new limiters:
```typescript
export const generateRateLimiter = createRateLimiter(5, 60_000);   // 5 generations/min per user
export const uploadRateLimiter = createRateLimiter(20, 60_000);    // 20 uploads/min per user
```
- **KEEP** `apiRateLimiter` (used by all API routes)
- **VALIDATE**: `npm run lint`

### TASK 10: CREATE src/lib/spotify.ts

Spotify Client Credentials flow. Cache the token in module scope (refreshes when expired).

```typescript
// Spotify Client Credentials auth + API client
// Token is cached in module scope and refreshed when expired

interface SpotifyToken {
  access_token: string;
  expires_at: number;
}

let cachedToken: SpotifyToken | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expires_at - 30_000) {
    return cachedToken.access_token;
  }

  const credentials = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`,
  ).toString("base64");

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) throw new Error(`Spotify token error: ${res.status}`);

  const data = await res.json();
  cachedToken = {
    access_token: data.access_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };
  return cachedToken.access_token;
}

async function spotifyFetch(path: string): Promise<unknown> {
  const token = await getAccessToken();
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Spotify API error ${res.status}: ${path}`);
  return res.json();
}

export interface SpotifyTrackResult {
  id: string;
  name: string;
  artistName: string;
  albumName: string;
  durationMs: number;
  albumArtUrl: string | null;
}

export async function searchTracks(query: string, limit = 10): Promise<SpotifyTrackResult[]> {
  const params = new URLSearchParams({ q: query, type: "track", limit: String(limit) });
  const data = await spotifyFetch(`/search?${params}`) as {
    tracks: { items: Array<{
      id: string;
      name: string;
      artists: Array<{ name: string }>;
      album: { name: string; images: Array<{ url: string }> };
      duration_ms: number;
    }>};
  };
  return data.tracks.items.map((t) => ({
    id: t.id,
    name: t.name,
    artistName: t.artists[0]?.name ?? "",
    albumName: t.album.name,
    durationMs: t.duration_ms,
    albumArtUrl: t.album.images[0]?.url ?? null,
  }));
}

export interface AudioFeatures {
  valence: number;
  energy: number;
  danceability: number;
  acousticness: number;
  instrumentalness: number;
  tempo: number;
  mode: number;
  key: number;
}

export async function getAudioFeatures(trackId: string): Promise<AudioFeatures> {
  const data = await spotifyFetch(`/audio-features/${trackId}`) as AudioFeatures;
  return data;
}

export interface AudioAnalysis {
  beats: Array<{ start: number; duration: number; confidence: number }>;
  sections: Array<{ start: number; duration: number; loudness: number; tempo: number }>;
  tempo: number;
}

export async function getAudioAnalysis(trackId: string): Promise<AudioAnalysis> {
  const data = await spotifyFetch(`/audio-analysis/${trackId}`) as {
    track: { tempo: number };
    beats: Array<{ start: number; duration: number; confidence: number }>;
    sections: Array<{ start: number; duration: number; loudness: number; tempo: number }>;
  };
  return {
    tempo: data.track.tempo,
    beats: data.beats,
    sections: data.sections,
  };
}
```

- **VALIDATE**: `npm run lint`

### TASK 11: CREATE src/lib/genius.ts

```typescript
// Genius lyrics client using genius-lyrics package
// Wraps the package to return just what we need

// genius-lyrics uses require-style imports
// eslint-disable-next-line @typescript-eslint/no-require-imports
const GeniusClient = require("genius-lyrics");

interface GeniusSong {
  id: number;
  title: string;
  artist: { name: string };
  lyrics: () => Promise<string>;
}

let client: { songs: { search: (q: string) => Promise<GeniusSong[]> } } | null = null;

function getClient() {
  if (!client) {
    client = new GeniusClient.Client(process.env.GENIUS_ACCESS_TOKEN);
  }
  return client;
}

export async function fetchLyrics(
  trackTitle: string,
  artistName: string,
): Promise<{ geniusId: number | null; lyrics: string | null }> {
  try {
    const c = getClient();
    const query = `${trackTitle} ${artistName}`;
    const results = await c.songs.search(query);

    if (!results.length) return { geniusId: null, lyrics: null };

    const song = results[0];
    const lyrics = await song.lyrics();
    return { geniusId: song.id, lyrics };
  } catch (error) {
    console.error("[genius] fetchLyrics error:", error);
    return { geniusId: null, lyrics: null };
  }
}
```

- **VALIDATE**: `npm run lint`

### TASK 12: CREATE src/lib/claude.ts

Uses the Anthropic SDK with prompt caching. Exports two analysis functions consumed by the generate/analyze API route.

```typescript
import Anthropic from "@anthropic-ai/sdk";
import type { ArtStyle, LayerWeights, MoodProfile, NarrativeMap, PaletteColor } from "@/types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = "claude-sonnet-4-6";

export async function analyzeLyrics(params: {
  lyrics: string;
  trackTitle: string;
  artistName: string;
  artStyle: ArtStyle;
  palette: PaletteColor[];
}): Promise<NarrativeMap> {
  const systemPrompt = `You are a visual art director translating song lyrics into generative image prompts.
Given lyrics, your task is to produce a structured narrative map: a list of lyric segments, each with a specific visual scene prompt, key themes, and imagery keywords.
Keep prompts under 100 words each. Focus on concrete imagery, color, and atmosphere. Avoid abstract descriptions.
Return ONLY valid JSON matching this schema:
{
  "segments": [
    {
      "startMs": number,
      "endMs": number,
      "lyrics": "string",
      "prompt": "string — rich visual scene description for image generation",
      "themes": ["string"],
      "imagery": ["string"]
    }
  ],
  "dominantThemes": ["string"],
  "intensityArc": [{ "timestampMs": number, "intensity": number }]
}`;

  const userMessage = `Track: "${params.trackTitle}" by ${params.artistName}
Art style: ${params.artStyle.descriptors.join(", ")} ${params.artStyle.freeText}
Palette: ${params.palette.map((p) => `${p.hex} (${p.label})`).join(", ")}

Lyrics:
${params.lyrics}

Divide the song into 10-15 segments based on natural lyric breaks. Estimate timestamps based on verse/chorus structure. For each segment, write a 60-100 word visual scene prompt suitable for Stable Diffusion.`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: [
      {
        type: "text",
        text: systemPrompt,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userMessage }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  return JSON.parse(text) as NarrativeMap;
}

export async function analyzeMood(params: {
  audioFeatures: {
    valence: number;
    energy: number;
    danceability: number;
    acousticness: number;
    instrumentalness: number;
    tempo: number;
  };
  lyricsSentimentHint: string; // dominant themes from narrative map
}): Promise<MoodProfile> {
  const { audioFeatures: af } = params;

  // Determine quadrant from valence x energy
  const quadrant =
    af.valence >= 0.5
      ? af.energy >= 0.5
        ? "high-valence-high-energy"
        : "high-valence-low-energy"
      : af.energy >= 0.5
        ? "low-valence-high-energy"
        : "low-valence-low-energy";

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: `Given these audio features for a song, return a JSON mood profile.
Audio features: valence=${af.valence}, energy=${af.energy}, danceability=${af.danceability}, acousticness=${af.acousticness}, tempo=${af.tempo}
Quadrant: ${quadrant}
Lyric themes: ${params.lyricsSentimentHint}

Return ONLY valid JSON:
{
  "valence": ${af.valence},
  "energy": ${af.energy},
  "quadrant": "${quadrant}",
  "tone": "one of: triumphant, melancholic, anxious, euphoric, aggressive, peaceful, nostalgic, playful",
  "paletteHint": "one of: warm-saturated, warm-muted, cool-saturated, cool-muted, high-contrast, monochromatic",
  "textureChar": "one of: sharp, soft, fluid, fractured"
}`,
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  return JSON.parse(text) as MoodProfile;
}
```

- **VALIDATE**: `npm run lint`

### TASK 13: CREATE src/lib/replicate.ts

```typescript
import Replicate from "replicate";
import type { ArtStyle, MoodProfile, NarrativeSegment, PaletteColor } from "@/types";

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

// Current SDXL model on Replicate
const SDXL_MODEL =
  "stability-ai/sdxl:39ed52f2319f9b2f47bc4f5a5db63e6a792e6b95eba81c2ca61fc72e8b4a3d";

export interface GeneratedFrameResult {
  frameUrl: string;
  prompt: string;
  timestampSeconds: number;
  sortOrder: number;
}

function buildPrompt(params: {
  segment: NarrativeSegment;
  mood: MoodProfile;
  artStyle: ArtStyle;
  palette: PaletteColor[];
}): string {
  const { segment, mood, artStyle, palette } = params;
  const paletteDesc = palette.slice(0, 4).map((p) => p.label).join(", ");
  const styleDesc = artStyle.descriptors.join(", ");
  const freeText = artStyle.freeText ? `, ${artStyle.freeText}` : "";

  return [
    segment.prompt,
    `Art style: ${styleDesc}${freeText}.`,
    `Color palette: ${paletteDesc}.`,
    `Mood: ${mood.tone}, ${mood.textureChar} texture.`,
    "Cinematic, high detail, 4K, masterpiece.",
  ].join(" ");
}

function buildNegativePrompt(): string {
  return [
    "blurry, low quality, watermark, text, logo, signature, ugly, deformed",
    "nsfw, explicit, violence, gore",
  ].join(", ");
}

export async function generateFrames(params: {
  segments: NarrativeSegment[];
  mood: MoodProfile;
  artStyle: ArtStyle;
  palette: PaletteColor[];
  frameCount?: number;
}): Promise<GeneratedFrameResult[]> {
  const { segments, mood, artStyle, palette, frameCount = 10 } = params;

  // Select evenly-spaced segments up to frameCount
  const step = Math.max(1, Math.floor(segments.length / frameCount));
  const selected = segments.filter((_, i) => i % step === 0).slice(0, frameCount);

  const results: GeneratedFrameResult[] = [];

  for (let i = 0; i < selected.length; i++) {
    const segment = selected[i];
    const prompt = buildPrompt({ segment, mood, artStyle, palette });

    const output = await replicate.run(SDXL_MODEL, {
      input: {
        prompt,
        negative_prompt: buildNegativePrompt(),
        width: 1024,
        height: 576, // 16:9
        num_inference_steps: 30,
        guidance_scale: 7.5,
        num_outputs: 1,
      },
    }) as string[];

    if (output[0]) {
      results.push({
        frameUrl: output[0],
        prompt,
        timestampSeconds: Math.floor(segment.startMs / 1000),
        sortOrder: i,
      });
    }
  }

  return results;
}
```

- **GOTCHA**: Replicate output for SDXL is a `FileOutput[]` in newer SDK versions. The URL is at `output[0].toString()` or `String(output[0])`. Check the SDK version and use `.toString()` if needed.
- **VALIDATE**: `npm run lint`

### TASK 14: REWRITE src/components/auth/signup-form.tsx

Remove all slug logic. Add role selector (Artist / Listener radio). After Neon Auth signup, call `POST /api/users/me` to create the usersMeta record, then redirect to `/onboarding`.

```typescript
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";

export function SignupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const { error: authError } = await authClient.signUp.email({ email, password, name });
      if (authError) {
        setError(authError.message || "Failed to create account");
        return;
      }
      router.push("/onboarding");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" placeholder="Your name" value={name}
          onChange={(e) => setName(e.target.value)} aria-label="Name" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" placeholder="you@example.com" value={email}
          onChange={(e) => setEmail(e.target.value)} aria-label="Email" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" placeholder="At least 8 characters" value={password}
          onChange={(e) => setPassword(e.target.value)} aria-label="Password" />
      </div>
      {error && <p className="text-sm text-destructive text-center">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Creating Account..." : "Create Account"}
      </Button>
    </form>
  );
}
```

- **VALIDATE**: `npm run lint`

### TASK 15: UPDATE src/components/auth/login-form.tsx

- **UPDATE** redirect after successful login:
  - Call `GET /api/users/me` after login
  - If `role === 'artist'` → redirect `/studio`
  - If `role === 'listener'` → redirect `/dashboard`
  - If no role yet → redirect `/onboarding`
- **VALIDATE**: `npm run lint`

### TASK 16: UPDATE src/middleware.ts

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const allCookies = request.cookies.getAll();
  const sessionCookie = allCookies.find((c) => c.name.includes("neon-auth.session_token"));

  if (!sessionCookie?.value) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/onboarding",
    "/studio",
    "/studio/:path*",
    "/dashboard",
    "/dashboard/:path*",
  ],
};
```

- **VALIDATE**: `npm run lint`

### TASK 17: CREATE src/app/api/users/me/route.ts

GET: returns current user's `usersMeta` record (creates one if not exists). Used after login to determine redirect.

```typescript
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { usersMeta } from "@/lib/db/schema";

export async function GET(request: NextRequest) {
  const session = await auth.getSession(request);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let record = await db.query.usersMeta.findFirst({
    where: eq(usersMeta.userId, session.userId),
  });

  if (!record) {
    const [created] = await db.insert(usersMeta).values({ userId: session.userId }).returning();
    record = created;
  }

  return NextResponse.json({ user: record });
}
```

- **VALIDATE**: `npm run lint`

### TASK 18: CREATE src/app/api/users/role/route.ts

POST: sets role + marks onboarding complete. Creates artist record if role = 'artist'.

```typescript
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { artists, usersMeta } from "@/lib/db/schema";
import { userRoleSchema } from "@/lib/validations";

export async function POST(request: NextRequest) {
  const session = await auth.getSession(request);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = userRoleSchema.safeParse(body.role);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const role = parsed.data;

  await db
    .insert(usersMeta)
    .values({ userId: session.userId, role, onboardingComplete: true })
    .onConflictDoUpdate({
      target: usersMeta.userId,
      set: { role, onboardingComplete: true, updatedAt: new Date() },
    });

  if (role === "artist") {
    await db
      .insert(artists)
      .values({ userId: session.userId, displayName: session.user?.name ?? "" })
      .onConflictDoNothing();
  }

  return NextResponse.json({ success: true, role });
}
```

- **VALIDATE**: `npm run lint`

### TASK 19: CREATE src/app/onboarding/page.tsx

Full-page role selector. Two large cards: Artist / Listener. Clicking one calls `POST /api/users/role` then redirects.

```typescript
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  const selectRole = async (role: "artist" | "listener") => {
    setLoading(role);
    setError("");
    try {
      const res = await fetch("/api/users/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error("Failed to set role");
      router.push(role === "artist" ? "/studio" : "/dashboard");
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(null);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-8">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Welcome to Aura</h1>
          <p className="text-muted-foreground">How will you use Aura?</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <button type="button" onClick={() => selectRole("artist")} disabled={!!loading}
            className="text-left">
            <Card className="h-full cursor-pointer border-2 transition-colors hover:border-primary">
              <CardHeader>
                <CardTitle>I'm an Artist</CardTitle>
                <CardDescription>
                  Define the visual language for your music. Upload a Style Brief,
                  choose your palette and art style, and generate preview frames.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading === "artist" && <p className="text-sm text-muted-foreground">Setting up...</p>}
              </CardContent>
            </Card>
          </button>
          <button type="button" onClick={() => selectRole("listener")} disabled={!!loading}
            className="text-left">
            <Card className="h-full cursor-pointer border-2 transition-colors hover:border-primary">
              <CardHeader>
                <CardTitle>I'm a Listener</CardTitle>
                <CardDescription>
                  Experience generative art that responds to music in real time —
                  shaped by the artist's vision, alive with every beat.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading === "listener" && <p className="text-sm text-muted-foreground">Setting up...</p>}
              </CardContent>
            </Card>
          </button>
        </div>
        {error && <p className="text-center text-sm text-destructive">{error}</p>}
      </div>
    </div>
  );
}
```

- **VALIDATE**: `npm run lint`

### TASK 20: CREATE src/app/api/spotify/search/route.ts

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth/server";
import { apiRateLimiter } from "@/lib/rate-limit";
import { searchTracks } from "@/lib/spotify";
import { spotifySearchSchema } from "@/lib/validations";

export async function GET(request: NextRequest) {
  const session = await auth.getSession(request);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!apiRateLimiter.check(ip).success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = spotifySearchSchema.safeParse({ q: searchParams.get("q") });
  if (!parsed.success) return NextResponse.json({ error: "Missing query" }, { status: 400 });

  try {
    const tracks = await searchTracks(parsed.data.q);
    return NextResponse.json({ tracks });
  } catch (error) {
    console.error("[spotify/search]", error);
    return NextResponse.json({ error: "Spotify search failed" }, { status: 502 });
  }
}
```

- **VALIDATE**: `npm run lint`

### TASK 21: CREATE src/app/api/spotify/analysis/[id]/route.ts

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth/server";
import { getAudioAnalysis, getAudioFeatures } from "@/lib/spotify";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.getSession(request);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const [features, analysis] = await Promise.all([
      getAudioFeatures(id),
      getAudioAnalysis(id),
    ]);
    return NextResponse.json({ features, analysis });
  } catch (error) {
    console.error("[spotify/analysis]", error);
    return NextResponse.json({ error: "Spotify analysis failed" }, { status: 502 });
  }
}
```

- **VALIDATE**: `npm run lint`

### TASK 22: CREATE src/app/api/genius/lyrics/route.ts

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth/server";
import { fetchLyrics } from "@/lib/genius";

export async function GET(request: NextRequest) {
  const session = await auth.getSession(request);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title");
  const artist = searchParams.get("artist");

  if (!title || !artist) {
    return NextResponse.json({ error: "title and artist are required" }, { status: 400 });
  }

  const result = await fetchLyrics(title, artist);
  return NextResponse.json(result);
}
```

- **VALIDATE**: `npm run lint`

### TASK 23: CREATE src/app/api/upload/reference-image/route.ts

```typescript
import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth/server";
import { uploadRateLimiter } from "@/lib/rate-limit";

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function POST(request: NextRequest) {
  const session = await auth.getSession(request);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!uploadRateLimiter.check(session.userId).success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "File must be JPEG, PNG, or WebP" }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "File must be under 5MB" }, { status: 400 });
  }

  try {
    const filename = `aura/reference-images/${session.userId}/${Date.now()}-${file.name}`;
    const blob = await put(filename, file, { access: "public" });
    return NextResponse.json({ url: blob.url });
  } catch (error) {
    console.error("[upload/reference-image]", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
```

- **VALIDATE**: `npm run lint`

### TASK 24: CREATE src/app/api/style-briefs/route.ts

```typescript
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth/server";
import { apiRateLimiter } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { artists, styleBriefs } from "@/lib/db/schema";
import { styleBriefSchema } from "@/lib/validations";

export async function GET(request: NextRequest) {
  const session = await auth.getSession(request);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const artist = await db.query.artists.findFirst({
    where: eq(artists.userId, session.userId),
  });
  if (!artist) return NextResponse.json({ error: "Artist profile not found" }, { status: 404 });

  const briefs = await db.query.styleBriefs.findMany({
    where: eq(styleBriefs.artistId, artist.id),
    with: { song: true },
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });

  return NextResponse.json({ styleBriefs: briefs });
}

export async function POST(request: NextRequest) {
  const session = await auth.getSession(request);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!apiRateLimiter.check(ip).success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const artist = await db.query.artists.findFirst({
    where: eq(artists.userId, session.userId),
  });
  if (!artist) return NextResponse.json({ error: "Artist profile not found" }, { status: 404 });

  const body = await request.json();
  const parsed = styleBriefSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }

  const [brief] = await db
    .insert(styleBriefs)
    .values({ artistId: artist.id, ...parsed.data })
    .returning();

  return NextResponse.json({ styleBrief: brief }, { status: 201 });
}
```

- **VALIDATE**: `npm run lint`

### TASK 25: CREATE src/app/api/style-briefs/[id]/route.ts

GET, PUT, DELETE single style brief. Verify ownership (artist.userId === session.userId) on every mutation.

```typescript
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { artists, styleBriefs } from "@/lib/db/schema";
import { styleBriefSchema } from "@/lib/validations";

async function getArtistForSession(session: { userId: string }) {
  return db.query.artists.findFirst({ where: eq(artists.userId, session.userId) });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.getSession(request);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const artist = await getArtistForSession(session);
  if (!artist) return NextResponse.json({ error: "Artist not found" }, { status: 404 });

  const brief = await db.query.styleBriefs.findFirst({
    where: and(eq(styleBriefs.id, id), eq(styleBriefs.artistId, artist.id)),
    with: { song: true, generatedFrames: { orderBy: (t, { asc }) => [asc(t.sortOrder)] } },
  });
  if (!brief) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ styleBrief: brief });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.getSession(request);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const artist = await getArtistForSession(session);
  if (!artist) return NextResponse.json({ error: "Artist not found" }, { status: 404 });

  const body = await request.json();
  const parsed = styleBriefSchema.partial().safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

  const [updated] = await db
    .update(styleBriefs)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(styleBriefs.id, id), eq(styleBriefs.artistId, artist.id)))
    .returning();

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ styleBrief: updated });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.getSession(request);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const artist = await getArtistForSession(session);
  if (!artist) return NextResponse.json({ error: "Artist not found" }, { status: 404 });

  await db
    .delete(styleBriefs)
    .where(and(eq(styleBriefs.id, id), eq(styleBriefs.artistId, artist.id)));

  return NextResponse.json({ success: true });
}
```

- **VALIDATE**: `npm run lint`

### TASK 26: CREATE src/app/api/generate/analyze/route.ts

Runs the full analysis pipeline: fetch lyrics → Spotify audio features → Claude lyric analysis → Claude mood analysis → store results on the `songs` record.

```typescript
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { analyzeLyrics, analyzeMood } from "@/lib/claude";
import { fetchLyrics } from "@/lib/genius";
import { generateRateLimiter } from "@/lib/rate-limit";
import { getAudioFeatures } from "@/lib/spotify";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { artists, songs, styleBriefs } from "@/lib/db/schema";
import { generateAnalyzeSchema } from "@/lib/validations";

export async function POST(request: NextRequest) {
  const session = await auth.getSession(request);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!generateRateLimiter.check(session.userId).success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const body = await request.json();
  const parsed = generateAnalyzeSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

  const { spotifyTrackId, styleBriefId } = parsed.data;

  // Verify ownership
  const artist = await db.query.artists.findFirst({
    where: eq(artists.userId, session.userId),
  });
  if (!artist) return NextResponse.json({ error: "Artist not found" }, { status: 404 });

  const brief = await db.query.styleBriefs.findFirst({
    where: eq(styleBriefs.id, styleBriefId),
    with: { song: true },
  });
  if (!brief || brief.artistId !== artist.id) {
    return NextResponse.json({ error: "Style brief not found" }, { status: 404 });
  }

  try {
    // 1. Get or create song record
    let song = await db.query.songs.findFirst({
      where: eq(songs.spotifyTrackId, spotifyTrackId),
    });

    if (!song) {
      // We need track metadata — get it from Spotify features call (includes name via search results)
      // For now create a minimal record; title/artist should be passed from the client
      const trackTitle = body.trackTitle as string;
      const artistName = body.artistName as string;

      const [created] = await db.insert(songs).values({
        spotifyTrackId,
        title: trackTitle,
        artistName,
      }).returning();
      song = created;
    }

    // 2. Fetch lyrics
    const { geniusId, lyrics } = await fetchLyrics(song.title, song.artistName);
    if (geniusId && !song.geniusId) {
      await db.update(songs).set({ geniusId: String(geniusId) }).where(eq(songs.id, song.id));
    }

    if (!lyrics) {
      return NextResponse.json({ error: "Could not fetch lyrics for this track" }, { status: 422 });
    }

    // 3. Spotify audio features
    const audioFeatures = await getAudioFeatures(spotifyTrackId);

    // 4. Claude lyric analysis
    const narrativeMap = await analyzeLyrics({
      lyrics,
      trackTitle: song.title,
      artistName: song.artistName,
      artStyle: brief.artStyle as { descriptors: string[]; freeText: string },
      palette: brief.palette as Array<{ hex: string; label: string }>,
    });

    // 5. Claude mood analysis
    const moodProfile = await analyzeMood({
      audioFeatures,
      lyricsSentimentHint: narrativeMap.dominantThemes.join(", "),
    });

    // 6. Store results
    const [updatedSong] = await db
      .update(songs)
      .set({
        lyricsCache: lyrics,
        narrativeMap,
        moodProfile,
        analyzedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(songs.id, song.id))
      .returning();

    // 7. Link song to style brief
    await db.update(styleBriefs).set({ songId: song.id }).where(eq(styleBriefs.id, styleBriefId));

    return NextResponse.json({ song: updatedSong, narrativeMap, moodProfile });
  } catch (error) {
    console.error("[generate/analyze]", error);
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}
```

- **VALIDATE**: `npm run lint`

### TASK 27: CREATE src/app/api/generate/frames/route.ts

Triggers Replicate frame generation. Updates style brief status to 'generating' → 'ready'.

```typescript
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { generateFrames } from "@/lib/replicate";
import { generateRateLimiter } from "@/lib/rate-limit";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { artists, generatedFrames, songs, styleBriefs } from "@/lib/db/schema";
import { generateFramesSchema } from "@/lib/validations";
import type { ArtStyle, LayerWeights, MoodProfile, NarrativeMap, PaletteColor } from "@/types";

export async function POST(request: NextRequest) {
  const session = await auth.getSession(request);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!generateRateLimiter.check(session.userId).success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const body = await request.json();
  const parsed = generateFramesSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

  const { songId, styleBriefId, frameCount } = parsed.data;

  const artist = await db.query.artists.findFirst({
    where: eq(artists.userId, session.userId),
  });
  if (!artist) return NextResponse.json({ error: "Artist not found" }, { status: 404 });

  const [brief, song] = await Promise.all([
    db.query.styleBriefs.findFirst({ where: eq(styleBriefs.id, styleBriefId) }),
    db.query.songs.findFirst({ where: eq(songs.id, songId) }),
  ]);

  if (!brief || brief.artistId !== artist.id) {
    return NextResponse.json({ error: "Style brief not found" }, { status: 404 });
  }
  if (!song?.narrativeMap || !song.moodProfile) {
    return NextResponse.json({ error: "Song must be analyzed first — call /api/generate/analyze" }, { status: 422 });
  }

  // Mark as generating
  await db.update(styleBriefs).set({ status: "generating" }).where(eq(styleBriefs.id, styleBriefId));

  try {
    const narrativeMap = song.narrativeMap as NarrativeMap;
    const moodProfile = song.moodProfile as MoodProfile;

    const frames = await generateFrames({
      segments: narrativeMap.segments,
      mood: moodProfile,
      artStyle: brief.artStyle as ArtStyle,
      palette: brief.palette as PaletteColor[],
      frameCount,
    });

    // Store frames
    if (frames.length > 0) {
      await db.insert(generatedFrames).values(
        frames.map((f) => ({
          styleBriefId,
          songId,
          frameUrl: f.frameUrl,
          timestampSeconds: f.timestampSeconds,
          sortOrder: f.sortOrder,
          prompt: f.prompt,
        })),
      );
    }

    await db.update(styleBriefs).set({ status: "ready" }).where(eq(styleBriefs.id, styleBriefId));

    return NextResponse.json({ frames, count: frames.length });
  } catch (error) {
    console.error("[generate/frames]", error);
    await db.update(styleBriefs).set({ status: "draft" }).where(eq(styleBriefs.id, styleBriefId));
    return NextResponse.json({ error: "Frame generation failed" }, { status: 500 });
  }
}
```

- **VALIDATE**: `npm run lint`

### TASK 28: CREATE src/app/api/generate/frames/[songId]/route.ts

```typescript
import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { generatedFrames } from "@/lib/db/schema";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ songId: string }> },
) {
  const session = await auth.getSession(request);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { songId } = await params;
  const { searchParams } = new URL(request.url);
  const styleBriefId = searchParams.get("styleBriefId");

  const whereClause = styleBriefId
    ? and(eq(generatedFrames.songId, songId), eq(generatedFrames.styleBriefId, styleBriefId))
    : eq(generatedFrames.songId, songId);

  const frames = await db.query.generatedFrames.findMany({
    where: whereClause,
    orderBy: [asc(generatedFrames.sortOrder)],
  });

  return NextResponse.json({ frames });
}
```

- **VALIDATE**: `npm run lint`

### TASK 29: CREATE src/app/(studio)/layout.tsx

Artist-only nav. Redirects to `/onboarding` if user has no role yet.

```typescript
"use client";

import { LogOut } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data: session } = authClient.useSession();

  useEffect(() => {
    // Verify artist role
    fetch("/api/users/me")
      .then((r) => r.json())
      .then((data) => {
        if (!data.user?.onboardingComplete) router.push("/onboarding");
        if (data.user?.role !== "artist") router.push("/dashboard");
      });
  }, [router]);

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b bg-card">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <Link href="/studio" className="text-lg font-semibold">
            Aura Studio
          </Link>
          <div className="flex items-center gap-4">
            {session?.user && (
              <span className="text-sm text-muted-foreground">{session.user.name}</span>
            )}
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
    </div>
  );
}
```

- **VALIDATE**: `npm run lint`

### TASK 30: CREATE src/components/studio/spotify-track-search.tsx

Debounced search input → calls `GET /api/spotify/search?q=` → displays result list with album art.

- Prop: `onSelect: (track: SpotifyTrack) => void`
- Shows loading spinner during fetch
- Shows "No results" if empty
- Each result: album art thumbnail + track name + artist + duration
- **VALIDATE**: `npm run lint`

### TASK 31: CREATE src/components/studio/palette-picker.tsx

Up to 8 HEX color swatches. Add new color with a native `<input type="color">` + label text input. Remove button on each swatch.

- Props: `value: PaletteColor[], onChange: (colors: PaletteColor[]) => void`
- Enforces max 8
- **VALIDATE**: `npm run lint`

### TASK 32: CREATE src/components/studio/art-style-selector.tsx

Two-part UI:
1. Taxonomy grid of 20 preset style descriptors (clickable chips, multi-select): `Dark Surrealism`, `Afrofuturism`, `Lo-fi Nostalgia`, `Abstract Geometry`, `Impressionist Landscapes`, `Cyberpunk Neon`, `Oil Painting`, `Watercolor`, `Photorealism`, `Anime`, `Ukiyo-e`, `Art Nouveau`, `Bauhaus`, `Brutalist`, `Minimalist`, `Expressionism`, `Pop Art`, `Grunge`, `Dreamcore`, `Vaporwave`
2. Free text textarea (max 500 chars) for additional style description

- Props: `value: ArtStyle, onChange: (style: ArtStyle) => void`
- **VALIDATE**: `npm run lint`

### TASK 33: CREATE src/components/studio/layer-weight-sliders.tsx

Three sliders (Mood, Audio, Lyrics). Weights must sum to 100. When one slider moves, automatically adjust the others proportionally to maintain sum = 100.

- Props: `value: LayerWeights, onChange: (weights: LayerWeights) => void`
- Uses `Slider` from `@/components/ui/slider`
- Shows current weight value next to each label
- Shows warning if sum ≠ 100 (should not happen with auto-adjustment but guard against it)
- **VALIDATE**: `npm run lint`

### TASK 34: CREATE src/components/studio/reference-image-upload.tsx

Drag-and-drop + click to upload. Calls `POST /api/upload/reference-image`. Displays uploaded image thumbnails (3-10). Remove button on each.

- Props: `value: string[], onChange: (urls: string[]) => void`
- Enforces min 0, max 10
- Shows upload progress
- Accepts JPEG, PNG, WebP, max 5MB
- **VALIDATE**: `npm run lint`

### TASK 35: CREATE src/components/studio/preview-player.tsx

Given an array of frame URLs, cycles through them with CSS transitions (cross-fade, 4-second interval). Play/pause control. Frame counter. Jump-to-frame thumbnails strip at bottom.

```typescript
"use client";

import { Pause, Play } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface PreviewPlayerProps {
  frames: Array<{ frameUrl: string; timestampSeconds: number; sortOrder: number }>;
  intervalMs?: number;
}

export function PreviewPlayer({ frames, intervalMs = 4000 }: PreviewPlayerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const advance = useCallback(() => {
    setCurrentIndex((i) => (i + 1) % frames.length);
  }, [frames.length]);

  useEffect(() => {
    if (playing && frames.length > 1) {
      intervalRef.current = setInterval(advance, intervalMs);
    }
    return () => clearInterval(intervalRef.current);
  }, [playing, frames.length, advance, intervalMs]);

  if (!frames.length) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-lg bg-muted text-muted-foreground">
        No frames generated yet
      </div>
    );
  }

  const current = frames[currentIndex];

  return (
    <div className="space-y-3">
      <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
        {frames.map((frame, i) => (
          <img
            key={frame.frameUrl}
            src={frame.frameUrl}
            alt={`Frame ${i + 1}`}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${
              i === currentIndex ? "opacity-100" : "opacity-0"
            }`}
          />
        ))}
        <div className="absolute bottom-3 left-3 flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setPlaying((p) => !p)}
            className="h-8 w-8 p-0"
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <span className="text-xs text-white/80 tabular-nums">
            {currentIndex + 1} / {frames.length} · {current.timestampSeconds}s
          </span>
        </div>
      </div>
      <div className="flex gap-1 overflow-x-auto pb-1">
        {frames.map((frame, i) => (
          <button
            key={frame.frameUrl}
            type="button"
            onClick={() => { setCurrentIndex(i); setPlaying(false); }}
            className={`h-12 w-20 flex-shrink-0 overflow-hidden rounded border-2 transition-colors ${
              i === currentIndex ? "border-primary" : "border-transparent"
            }`}
          >
            <img src={frame.frameUrl} alt="" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}
```

- **VALIDATE**: `npm run lint`

### TASK 36: CREATE src/components/studio/style-brief-form.tsx

Main form container composing all studio sub-components. Manages form state, calls the API routes in sequence (save → analyze → generate), shows status feedback with toasts.

Steps in order:
1. Fill out form (palette, art style, layer weights, reference images, Spotify track search)
2. Save style brief (POST /api/style-briefs)
3. Analyze song (POST /api/generate/analyze) — shows spinner, may take 30-60s
4. Generate frames (POST /api/generate/frames) — shows spinner, may take 2-5 min
5. Preview player appears with generated frames

- **VALIDATE**: `npm run lint`

### TASK 37: CREATE src/app/(studio)/studio/page.tsx

List of artist's style briefs. Each card shows: title, linked song name, status badge (draft/generating/ready), frame count, created date, links to edit.

```typescript
// Server component — fetches style briefs from DB directly
import { eq } from "drizzle-orm";
import Link from "next/link";
import { headers } from "next/headers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { artists, styleBriefs } from "@/lib/db/schema";
```

- **GOTCHA**: Server components in Next.js 15 App Router pass `Request` as the first arg to layouts/pages differently. Use `import { headers } from "next/headers"` + create a synthetic request for `auth.getSession`. Alternatively, fetch from the client. For simplicity in Phase 1, make this a client component that calls `GET /api/style-briefs`.
- **VALIDATE**: `npm run lint`

### TASK 38: CREATE src/app/(studio)/studio/new/page.tsx

Simple wrapper that renders `<StyleBriefForm />` in create mode (no initial values). On save, redirects to `/studio/[id]`.

- **VALIDATE**: `npm run lint`

### TASK 39: CREATE src/app/(studio)/studio/[id]/page.tsx

Client component. Fetches `GET /api/style-briefs/[id]` on load. Renders `<StyleBriefForm />` in edit mode with existing values. Below the form, renders `<PreviewPlayer />` if frames exist.

- **VALIDATE**: `npm run lint`

### TASK 40: CREATE src/app/(listener)/layout.tsx + src/app/(listener)/dashboard/page.tsx

Simple listener shell layout (same nav pattern as studio layout) and a placeholder dashboard page.

Dashboard content: "Welcome to Aura. Artist content is coming soon. Connect your Spotify account to get started." (Spotify OAuth is Phase 2.)

- **VALIDATE**: `npm run lint`

### TASK 41: UPDATE src/app/(dashboard)/layout.tsx

Remove the old `editor` and `analytics` nav links. Replace with a generic dashboard that redirects based on role (calling `GET /api/users/me`). In Phase 1 this layout is essentially superseded by the role-specific layouts, but keep it for the Neon Auth redirect flow.

- **VALIDATE**: `npm run lint`

### TASK 42: UPDATE src/app/page.tsx (home page)

Add a role-aware redirect for logged-in users: if session exists and role known, redirect to studio or dashboard. Keep the current "Get Started" / "Sign In" buttons for logged-out users.

- **VALIDATE**: `npm run lint`

### TASK 43: CREATE src/lib/__tests__/spotify.test.ts

```typescript
import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("Spotify client", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.SPOTIFY_CLIENT_ID = "test-client-id";
    process.env.SPOTIFY_CLIENT_SECRET = "test-client-secret";
  });

  it("fetches a token using client credentials", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "test-token", expires_in: 3600 }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tracks: { items: [] } }),
      } as Response);

    const { searchTracks } = await import("../spotify");
    const results = await searchTracks("test query");
    expect(results).toEqual([]);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
```

- **VALIDATE**: `npm run test:run`

### TASK 44: CREATE src/lib/__tests__/claude.test.ts

Mock the Anthropic client. Test that `analyzeMood` returns a valid `MoodProfile` shape.

```typescript
import { describe, expect, it, vi } from "vitest";

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              valence: 0.7,
              energy: 0.8,
              quadrant: "high-valence-high-energy",
              tone: "triumphant",
              paletteHint: "warm-saturated",
              textureChar: "sharp",
            }),
          },
        ],
      }),
    },
  })),
}));

describe("analyzeMood", () => {
  it("returns a valid MoodProfile", async () => {
    const { analyzeMood } = await import("../claude");
    const result = await analyzeMood({
      audioFeatures: { valence: 0.7, energy: 0.8, danceability: 0.6, acousticness: 0.1, instrumentalness: 0, tempo: 128 },
      lyricsSentimentHint: "triumph, victory, power",
    });
    expect(result.tone).toBe("triumphant");
    expect(result.quadrant).toBe("high-valence-high-energy");
    expect(result.textureChar).toBe("sharp");
  });
});
```

- **VALIDATE**: `npm run test:run`

### TASK 45: UPDATE src/lib/__tests__/rate-limit.test.ts

- **REMOVE** any reference to `slugCheckRateLimiter` (deleted in Task 9)
- **ADD** import check for `generateRateLimiter`
- **VALIDATE**: `npm run test:run`

### TASK 46: RUN full validation suite

```bash
npm run lint:fix        # auto-fix formatting
npm run lint           # zero errors
npm run test:run       # all tests pass
npm run db:push        # schema pushed to Neon (requires .env.local)
npm run build          # production build succeeds
```

---

## TESTING STRATEGY

### Unit Tests

| Test File | What It Tests |
|---|---|
| `src/lib/__tests__/rate-limit.test.ts` | `createRateLimiter` (existing, update imports) |
| `src/lib/__tests__/spotify.test.ts` | Token fetch, `searchTracks` response parsing |
| `src/lib/__tests__/claude.test.ts` | `analyzeMood` output shape |
| `src/lib/__tests__/validations.test.ts` (new) | `styleBriefSchema`, `layerWeightsSchema` (sum constraint), `paletteColorSchema` |

### Edge Cases to Test

- `layerWeightsSchema` rejects weights that don't sum to 100
- `paletteColorSchema` rejects invalid hex strings (`#GGG`, `FF0000` without `#`)
- `styleBriefSchema` allows empty palette and reference arrays
- Spotify token is reused within the 1-hour window (module cache)
- `generateAnalyzeSchema` requires both `spotifyTrackId` and `styleBriefId`

### Manual Validation Flow

1. Sign up as Artist → redirected to `/onboarding`
2. Select "Artist" role → redirected to `/studio`
3. Click "New Style Brief" → `/studio/new`
4. Search Spotify for a song, select it
5. Set palette (3+ colors), select 2+ art style descriptors
6. Adjust layer weights (confirm sum = 100)
7. Upload 1 reference image
8. Click Save → style brief created
9. Click Analyze → watch spinner (30-60s), confirm narrative map stored
10. Click Generate Frames → watch spinner (2-5 min), confirm frames appear in preview player
11. Interact with preview player: play/pause, jump to frame

---

## VALIDATION COMMANDS

### Level 1: Lint + Format
```bash
npm run lint:fix && npm run lint
```

### Level 2: Type Check
```bash
npx tsc --noEmit
```

### Level 3: Unit Tests
```bash
npm run test:run
```

### Level 4: Schema Push
```bash
npm run db:push
```

### Level 5: Build
```bash
npm run build
```

---

## ACCEPTANCE CRITERIA

- [ ] Signup no longer references slug; redirects to `/onboarding` after account creation
- [ ] Role selection at `/onboarding` creates `usersMeta` record and (for artist) `artists` record
- [ ] Login redirects to `/studio` for artists, `/dashboard` for listeners, `/onboarding` if no role
- [ ] `GET /api/spotify/search?q=` returns track results with name, artist, album, duration
- [ ] `POST /api/upload/reference-image` stores file in Vercel Blob and returns URL
- [ ] `POST /api/style-briefs` creates a style brief linked to the artist
- [ ] `POST /api/generate/analyze` stores `narrativeMap` and `moodProfile` on the `songs` record
- [ ] `POST /api/generate/frames` stores generated frame URLs in `generatedFrames` table
- [ ] `GET /api/generate/frames/[songId]` returns frames in sort order
- [ ] `/studio` lists all style briefs for the logged-in artist
- [ ] `/studio/[id]` shows the edit form and preview player when frames exist
- [ ] Preview player cycles through frames with cross-fade transition
- [ ] Layer weight sliders always sum to 100
- [ ] All `npm run lint`, `npm run test:run`, `npm run build` pass with zero errors

---

## NOTES

**Audio source decision**: Phase 1 uses Spotify's pre-computed `audio-analysis` endpoint (beat grids, section markers). Real-time audio tap from the OS/device is deferred to Phase 2. This sidesteps the biggest open question in the PRD.

**Generation time**: Replicate SDXL takes ~10-30s per frame. Generating 10 frames = 2-5 minutes. The API route runs synchronously for Phase 1. Phase 2 should move this to a background job (Celery or Vercel background functions) with polling.

**Spotify API limits**: Client Credentials gives 600 requests/minute. The token cache in `spotify.ts` prevents re-fetching within the 1-hour window.

**Neon Auth session in server components**: Use `auth.getSession(request)` in API Route handlers. In React Server Components (pages/layouts), use `import { headers } from "next/headers"` to build a synthetic request or switch to client components that call API routes. Phase 1 favors client components for data fetching to avoid the RSC/server-action complexity.

**Replicate model version**: The SDXL model ID may update. Check https://replicate.com/stability-ai/sdxl for the latest version hash before implementation.

**genius-lyrics CJS**: The `genius-lyrics` package is CommonJS. Use `require()` with the eslint disable comment as shown in `src/lib/genius.ts`. Configure tsconfig `esModuleInterop: true` (already enabled).

**`@vercel/blob` in local dev**: Requires a `BLOB_READ_WRITE_TOKEN` from Vercel. In local dev without a Vercel project, use `vercel env pull` or mock the upload. The package works locally if the token is present.

**Confidence Score**: 7/10 — The architecture is well-defined and the codebase scaffold is clean. The main execution risks are: (1) Neon Auth `getSession` API shape may differ slightly from the pattern assumed — verify against the beta package's actual export; (2) `genius-lyrics` scraping may break if Genius changes its page structure; (3) Replicate output type for SDXL may need `.toString()` coercion. Each is a one-line fix when encountered.
