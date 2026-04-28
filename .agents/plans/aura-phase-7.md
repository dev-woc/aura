# Feature: Aura Phase 7 — User-Uploaded Music

Validate all patterns before implementing. The most critical decisions: (1) `spotifyTrackId` becomes nullable — Drizzle `db:push` handles the column alteration, but the existing `uniqueIndex` still works because Postgres allows multiple NULLs in a unique index. (2) The new analyze-upload route runs Whisper synchronously — it needs `export const maxDuration = 120` or lyrics must be provided manually. (3) The `StyleBriefForm` gains a source toggle that conditionally renders either the existing Spotify flow or the new upload flow — both share the same Save → Analyze → Generate button sequence.

---

## Feature Description

Artists can upload their own audio files (MP3/WAV/AAC/OGG) instead of searching Spotify. The platform transcribes lyrics via OpenAI Whisper on Replicate (or accepts manual lyrics), generates a synthetic beat grid from user-provided BPM, and infers mood from genre/vibe tags via Claude. Everything downstream — narrative analysis, frame generation, beat-sync playback, publish/discover — works unchanged.

## User Stories

**Artist (independent):** As an artist with unreleased or non-Spotify music, I want to upload my own audio file so I can create visual experiences for music that isn't in any streaming catalog.

**Artist (all):** As an artist, I want the platform to transcribe my lyrics automatically so I don't have to type them out for every song.

## Problem Statement

The current pipeline is gated on Spotify catalog membership. Independent artists, producers with unreleased tracks, and artists in markets underserved by Spotify have no path to using Aura.

## Solution Statement

Replace the three Spotify data sources (beat grid from Audio Analysis, audio features for mood, lyrics from Genius) with: (1) Vercel Blob for audio storage, (2) synthetic beat grid from user-provided BPM, (3) OpenAI Whisper on Replicate for transcription, (4) Claude mood inference from genre/vibe tags. The existing `songs` table is extended to support both Spotify and uploaded tracks. All downstream systems are unchanged.

## Feature Metadata

**Feature Type**: New Capability  
**Estimated Complexity**: High  
**Primary Systems Affected**: DB schema, upload API, new analyze-upload API, `src/lib/claude.ts`, `StyleBriefForm`, two new studio components  
**Dependencies**: `openai/whisper` on Replicate (already installed via `replicate` package), Vercel Blob (already configured)

---

## CONTEXT REFERENCES

### Relevant Codebase Files — READ BEFORE IMPLEMENTING

- `src/lib/db/schema.ts` (full) — `songs` table (lines 53–72); must make `spotifyTrackId` nullable and add `audioFileUrl`
- `src/app/api/generate/analyze/route.ts` (full) — existing Spotify analyze flow; `analyze-upload` route mirrors this structure
- `src/app/api/upload/reference-image/route.ts` (full) — exact Vercel Blob upload pattern to mirror for audio route
- `src/lib/replicate.ts` (full) — existing `replicate.run()` pattern; Whisper call follows same shape
- `src/lib/claude.ts` (full) — existing `analyzeMood()` at lines 70–109; new `analyzeMoodFromTags()` mirrors signature
- `src/components/studio/style-brief-form.tsx` (full) — 3-step form; add source toggle + conditional rendering
- `src/components/studio/spotify-track-search.tsx` (full) — pattern for a self-contained song-picker component to mirror for `AudioUpload`
- `src/lib/validations.ts` (full) — `generateAnalyzeSchema` pattern to mirror for `generateAnalyzeUploadSchema`
- `src/app/api/generate/frames/worker/route.ts` — `export const maxDuration = 300` pattern; use `= 120` on analyze-upload

### New Files to Create

```
src/app/api/upload/audio/route.ts                  — POST: audio file → Vercel Blob
src/app/api/generate/analyze-upload/route.ts       — POST: uploaded song analysis pipeline
src/components/studio/audio-upload.tsx             — upload UI + duration detection
src/components/studio/mood-tag-selector.tsx        — genre + vibe tag multi-select chips
```

### Files to Modify

```
src/lib/db/schema.ts                               — spotifyTrackId nullable; add audioFileUrl
src/lib/validations.ts                             — add generateAnalyzeUploadSchema
src/lib/claude.ts                                  — add analyzeMoodFromTags()
src/components/studio/style-brief-form.tsx         — source toggle + upload flow
```

### Relevant Documentation — READ BEFORE IMPLEMENTING

- Replicate `openai/whisper` — Input: `{ audio: string (URL), model: "small" | "medium" }`, Output: `{ text: string, segments: [{ start, end, text }] }`. The `audio` field accepts a public HTTPS URL — Vercel Blob URLs are public.
- Vercel Blob `put()` — `import { put } from "@vercel/blob"` — already used in `reference-image` and `avatar` routes. Handles multipart files up to 500MB. Returns `{ url }`.
- Postgres `NULL` in unique indexes — `CREATE UNIQUE INDEX` allows multiple `NULL` rows (NULL ≠ NULL). Making `spotifyTrackId` nullable does NOT break the existing unique constraint.

### Patterns to Follow

**Vercel Blob upload (mirror `src/app/api/upload/reference-image/route.ts`):**
```typescript
const formData = await request.formData();
const file = formData.get("file") as File | null;
if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
if (!ALLOWED_TYPES.includes(file.type)) return NextResponse.json({ error: "..." }, { status: 400 });
if (file.size > MAX_SIZE_BYTES) return NextResponse.json({ error: "..." }, { status: 400 });
const blob = await put(`aura/audio/${session!.user!.id}/${Date.now()}-${file.name}`, file, { access: "public" });
return NextResponse.json({ url: blob.url });
```

**Replicate Whisper call (mirrors `replicate.run()` in `src/lib/replicate.ts`):**
```typescript
const result = await replicate.run("openai/whisper", {
  input: { audio: audioFileUrl, model: "small" },
}) as { text: string; segments: Array<{ start: number; end: number; text: string }> };
const lyrics = result.text;
```

**Synthetic beat grid from BPM:**
```typescript
function generateSyntheticBeatGrid(bpm: number, durationMs: number): BeatGrid {
  const beatIntervalMs = (60 / bpm) * 1000;
  const beats: BeatGrid["beats"] = [];
  for (let t = 0; t < durationMs; t += beatIntervalMs) {
    beats.push({ startMs: Math.round(t), confidence: 1.0 });
  }
  return {
    bpm,
    beats,
    sections: [{ startMs: 0, endMs: durationMs, label: "Main" }],
  };
}
```

**New Claude mood function from tags (add to `src/lib/claude.ts`):**
```typescript
export async function analyzeMoodFromTags(params: {
  genreTags: string[];
  vibeTags: string[];
  lyricsSentimentHint: string;
}): Promise<MoodProfile> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    messages: [{
      role: "user",
      content: `Given these music characteristics, return a JSON mood profile.
Genre: ${params.genreTags.join(", ")}
Vibe: ${params.vibeTags.join(", ")}
Lyric themes: ${params.lyricsSentimentHint}

Return ONLY valid JSON:
{
  "valence": <0.0–1.0, estimated>,
  "energy": <0.0–1.0, estimated>,
  "quadrant": "<high/low-valence-high/low-energy>",
  "tone": "one of: triumphant, melancholic, anxious, euphoric, aggressive, peaceful, nostalgic, playful",
  "paletteHint": "one of: warm-saturated, warm-muted, cool-saturated, cool-muted, high-contrast, monochromatic",
  "textureChar": "one of: sharp, soft, fluid, fractured"
}`,
    }],
  });
  const text = response.content[0].type === "text" ? response.content[0].text : "";
  return JSON.parse(text) as MoodProfile;
}
```

**Source toggle in `StyleBriefForm` (new state):**
```typescript
const [songSource, setSongSource] = useState<"spotify" | "upload">("spotify");
const [uploadedAudio, setUploadedAudio] = useState<{ url: string; durationMs: number } | null>(null);
const [uploadTitle, setUploadTitle] = useState("");
const [uploadArtistName, setUploadArtistName] = useState("");
const [uploadLyrics, setUploadLyrics] = useState("");
const [uploadBpm, setUploadBpm] = useState<number>(120);
const [genreTags, setGenreTags] = useState<string[]>([]);
const [vibeTags, setVibeTags] = useState<string[]>([]);
```

**`handleAnalyze` branching (in `StyleBriefForm`):**
```typescript
const handleAnalyze = async () => {
  if (songSource === "upload") {
    // call /api/generate/analyze-upload
    const res = await fetch("/api/generate/analyze-upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        styleBriefId: savedBriefId,
        audioFileUrl: uploadedAudio!.url,
        title: uploadTitle,
        artistName: uploadArtistName,
        durationMs: uploadedAudio!.durationMs,
        bpm: uploadBpm,
        lyrics: uploadLyrics || undefined,
        genreTags,
        vibeTags,
      }),
    });
    // ...
  } else {
    // existing Spotify flow
  }
};
```

**`canAnalyze` for upload mode:**
```typescript
const canAnalyze =
  saveStatus === "done" &&
  (songSource === "spotify"
    ? !!selectedTrack
    : !!uploadedAudio && !!uploadTitle && !!uploadArtistName && genreTags.length > 0);
```

---

## STEP-BY-STEP TASKS

---

### TASK 1: UPDATE `src/lib/db/schema.ts` — make spotifyTrackId nullable, add audioFileUrl

**CHANGE** in `songs` table:
```typescript
// BEFORE:
spotifyTrackId: text("spotify_track_id").notNull().unique(),

// AFTER:
spotifyTrackId: text("spotify_track_id").unique(),
audioFileUrl: text("audio_file_url"),
```

- **GOTCHA**: `spotifyTrackId` still has `.unique()` — Postgres allows multiple NULLs in a unique index. Existing Spotify songs are unaffected.
- **GOTCHA**: After `db:push`, the column is altered from `NOT NULL` to nullable. Run `npm run db:push` after this task.
- **VALIDATE**: `npx tsc --noEmit` then `npm run db:push`

---

### TASK 2: UPDATE `src/lib/validations.ts` — add generateAnalyzeUploadSchema

**ADD** after `generateAnalyzeSchema`:
```typescript
export const generateAnalyzeUploadSchema = z.object({
  styleBriefId: z.string().uuid(),
  audioFileUrl: z.string().url(),
  title: z.string().min(1).max(200),
  artistName: z.string().min(1).max(200),
  durationMs: z.number().int().min(1000),
  bpm: z.number().min(40).max(300).default(120),
  lyrics: z.string().optional(),
  genreTags: z.array(z.string().min(1)).min(1).max(5),
  vibeTags: z.array(z.string().min(1)).min(1).max(5),
});
```

- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 3: UPDATE `src/lib/claude.ts` — add analyzeMoodFromTags()

**ADD** after the `analyzeMood` function:
```typescript
export async function analyzeMoodFromTags(params: {
  genreTags: string[];
  vibeTags: string[];
  lyricsSentimentHint: string;
}): Promise<MoodProfile> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: `Given these music characteristics, return a JSON mood profile.
Genre: ${params.genreTags.join(", ")}
Vibe: ${params.vibeTags.join(", ")}
Lyric themes: ${params.lyricsSentimentHint}

Return ONLY valid JSON:
{
  "valence": <0.0-1.0 estimated>,
  "energy": <0.0-1.0 estimated>,
  "quadrant": "<high|low>-valence-<high|low>-energy",
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

- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 4: CREATE `src/app/api/upload/audio/route.ts`

```typescript
import { put } from "@vercel/blob";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { uploadRateLimiter } from "@/lib/rate-limit";

const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50MB
const ALLOWED_TYPES = ["audio/mpeg", "audio/wav", "audio/ogg", "audio/aac", "audio/mp4", "audio/x-m4a"];

export async function POST(request: NextRequest) {
  const { data: session } = await auth.getSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!uploadRateLimiter.check(session!.user!.id).success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "File must be MP3, WAV, OGG, or AAC" }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "File must be under 50MB" }, { status: 400 });
  }

  try {
    const filename = `aura/audio/${session!.user!.id}/${Date.now()}-${file.name}`;
    const blob = await put(filename, file, { access: "public" });
    return NextResponse.json({ url: blob.url });
  } catch (error) {
    console.error("[upload/audio]", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
```

- **GOTCHA**: `audio/x-m4a` covers `.m4a` files; browser `File.type` may report `audio/mp4` for AAC — include both
- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 5: CREATE `src/app/api/generate/analyze-upload/route.ts`

```typescript
import Replicate from "replicate";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { analyzeLyrics, analyzeMoodFromTags } from "@/lib/claude";
import { db } from "@/lib/db";
import { artists, songs, styleBriefs } from "@/lib/db/schema";
import { generateRateLimiter } from "@/lib/rate-limit";
import { generateAnalyzeUploadSchema } from "@/lib/validations";
import type { BeatGrid } from "@/types";

export const maxDuration = 120;

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

function generateSyntheticBeatGrid(bpm: number, durationMs: number): BeatGrid {
  const beatIntervalMs = (60 / bpm) * 1000;
  const beats: BeatGrid["beats"] = [];
  for (let t = 0; t < durationMs; t += beatIntervalMs) {
    beats.push({ startMs: Math.round(t), confidence: 1.0 });
  }
  return {
    bpm,
    beats,
    sections: [{ startMs: 0, endMs: durationMs, label: "Main" }],
  };
}

export async function POST(request: NextRequest) {
  const { data: session } = await auth.getSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!generateRateLimiter.check(session!.user!.id).success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const body = await request.json();
  const parsed = generateAnalyzeUploadSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

  const { styleBriefId, audioFileUrl, title, artistName, durationMs, bpm, genreTags, vibeTags } = parsed.data;
  let { lyrics } = parsed.data;

  // Verify ownership
  const artist = await db.query.artists.findFirst({
    where: eq(artists.userId, session!.user!.id),
  });
  if (!artist) return NextResponse.json({ error: "Artist not found" }, { status: 404 });

  const brief = await db.query.styleBriefs.findFirst({
    where: eq(styleBriefs.id, styleBriefId),
  });
  if (!brief || brief.artistId !== artist.id) {
    return NextResponse.json({ error: "Style brief not found" }, { status: 404 });
  }

  try {
    // 1. Transcribe via Whisper if lyrics not provided
    if (!lyrics) {
      const result = await replicate.run("openai/whisper", {
        input: { audio: audioFileUrl, model: "small" },
      }) as { text: string };
      lyrics = result.text;
    }

    if (!lyrics?.trim()) {
      return NextResponse.json({ error: "Could not transcribe audio — please provide lyrics manually" }, { status: 422 });
    }

    // 2. Generate synthetic beat grid
    const beatGrid = generateSyntheticBeatGrid(bpm ?? 120, durationMs);

    // 3. Claude lyric analysis
    const narrativeMap = await analyzeLyrics({
      lyrics,
      trackTitle: title,
      artistName,
      artStyle: brief.artStyle as { descriptors: string[]; freeText: string },
      palette: brief.palette as Array<{ hex: string; label: string }>,
    });

    // 4. Claude mood analysis from tags
    const moodProfile = await analyzeMoodFromTags({
      genreTags,
      vibeTags,
      lyricsSentimentHint: narrativeMap.dominantThemes.join(", "),
    });

    // 5. Create or update song record
    const existingSong = brief.songId
      ? await db.query.songs.findFirst({ where: eq(songs.id, brief.songId) })
      : null;

    let song;
    if (existingSong && !existingSong.spotifyTrackId) {
      // Update existing uploaded song
      const [updated] = await db
        .update(songs)
        .set({ title, artistName, audioFileUrl, durationMs, lyricsCache: lyrics, narrativeMap, moodProfile, beatGrid, analyzedAt: new Date(), updatedAt: new Date() })
        .where(eq(songs.id, existingSong.id))
        .returning();
      song = updated;
    } else {
      // Create new uploaded song
      const [created] = await db
        .insert(songs)
        .values({ title, artistName, audioFileUrl, durationMs, lyricsCache: lyrics, narrativeMap, moodProfile, beatGrid, analyzedAt: new Date() })
        .returning();
      song = created;
    }

    // 6. Link song to brief
    await db.update(styleBriefs).set({ songId: song.id }).where(eq(styleBriefs.id, styleBriefId));

    return NextResponse.json({ song, narrativeMap, moodProfile });
  } catch (error) {
    console.error("[generate/analyze-upload]", error);
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}
```

- **GOTCHA**: `Replicate` is imported directly here (not from `src/lib/replicate.ts`) because the frame generation helper isn't needed
- **GOTCHA**: When updating an existing uploaded song, check `!existingSong.spotifyTrackId` to avoid overwriting a Spotify-linked song with audio file data
- **GOTCHA**: `lyrics` is `let` not `const` because it may be assigned from Whisper
- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 6: CREATE `src/components/studio/audio-upload.tsx`

```typescript
"use client";

import { Loader2, Music, X } from "lucide-react";
import { useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

interface UploadedAudioData {
  url: string;
  durationMs: number;
}

interface AudioUploadProps {
  onUploaded: (data: UploadedAudioData) => void;
  onClear: () => void;
  uploaded: UploadedAudioData | null;
  lyrics: string;
  onLyricsChange: (lyrics: string) => void;
  bpm: number;
  onBpmChange: (bpm: number) => void;
  title: string;
  onTitleChange: (title: string) => void;
  artistName: string;
  onArtistNameChange: (name: string) => void;
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function AudioUpload({
  onUploaded, onClear, uploaded,
  lyrics, onLyricsChange,
  bpm, onBpmChange,
  title, onTitleChange,
  artistName, onArtistNameChange,
}: AudioUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const handleFile = async (file: File) => {
    setError("");
    setUploading(true);

    // Get duration via browser Audio API
    const durationMs = await new Promise<number>((resolve) => {
      const audio = new Audio(URL.createObjectURL(file));
      audio.onloadedmetadata = () => resolve(Math.round(audio.duration * 1000));
      audio.onerror = () => resolve(0);
    });

    // Upload to Vercel Blob
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch("/api/upload/audio", { method: "POST", body: form });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Upload failed");
      }
      const data = await res.json();
      onUploaded({ url: data.url, durationMs });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* File picker */}
      {!uploaded ? (
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="audio/mpeg,audio/wav,audio/ogg,audio/aac,audio/mp4,.mp3,.wav,.ogg,.aac,.m4a"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/30 py-8 text-sm text-muted-foreground transition-colors hover:border-muted-foreground/60 hover:text-foreground disabled:opacity-50"
          >
            {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Music className="h-5 w-5" />}
            {uploading ? "Uploading..." : "Click to upload MP3, WAV, OGG, or AAC (max 50MB)"}
          </button>
          {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-sm">
          <span className="flex items-center gap-2">
            <Music className="h-4 w-4 text-muted-foreground" />
            <span>Audio uploaded · {formatDuration(uploaded.durationMs)}</span>
          </span>
          <button type="button" onClick={onClear} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Track metadata */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="upload-title">Song Title</Label>
          <Input id="upload-title" placeholder="Title" value={title} onChange={(e) => onTitleChange(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="upload-artist">Artist Name</Label>
          <Input id="upload-artist" placeholder="Artist" value={artistName} onChange={(e) => onArtistNameChange(e.target.value)} />
        </div>
      </div>

      {/* BPM */}
      <div className="space-y-1">
        <Label htmlFor="upload-bpm">BPM <span className="text-muted-foreground">(optional — used for beat-sync visuals)</span></Label>
        <Input
          id="upload-bpm"
          type="number"
          min={40}
          max={300}
          placeholder="120"
          value={bpm}
          onChange={(e) => onBpmChange(Number(e.target.value) || 120)}
          className="max-w-[120px]"
        />
      </div>

      {/* Lyrics */}
      <div className="space-y-1">
        <Label htmlFor="upload-lyrics">
          Lyrics <span className="text-muted-foreground">(optional — leave blank to auto-transcribe)</span>
        </Label>
        <Textarea
          id="upload-lyrics"
          placeholder="Paste lyrics here, or leave blank and we'll transcribe them automatically..."
          value={lyrics}
          onChange={(e) => onLyricsChange(e.target.value)}
          rows={6}
          className="resize-y font-mono text-xs"
        />
      </div>
    </div>
  );
}
```

- **GOTCHA**: `new Audio()` is browser-only — this is fine because the file is in `"use client"`
- **GOTCHA**: `URL.createObjectURL(file)` for duration detection doesn't upload anything; the actual upload is the `fetch("/api/upload/audio")` call after
- **GOTCHA**: Textarea needs to be imported from `@/components/ui/textarea` — check it exists. If not, run `npx shadcn add textarea` first, or use a plain `<textarea>` with class `cn("flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm...")`
- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 7: CREATE `src/components/studio/mood-tag-selector.tsx`

Mirror the `ArtStyleSelector` multi-select chip pattern.

```typescript
"use client";

const GENRE_TAGS = [
  "Rock", "Pop", "Hip-Hop", "R&B", "Jazz", "Electronic",
  "Classical", "Country", "Indie", "Metal", "Folk", "Soul",
  "Reggae", "Latin", "Ambient",
];

const VIBE_TAGS = [
  "Energetic", "Melancholic", "Peaceful", "Aggressive",
  "Euphoric", "Nostalgic", "Playful", "Anxious",
  "Romantic", "Mysterious", "Uplifting", "Dark",
];

interface MoodTagSelectorProps {
  value: { genreTags: string[]; vibeTags: string[] };
  onChange: (value: { genreTags: string[]; vibeTags: string[] }) => void;
}

export function MoodTagSelector({ value, onChange }: MoodTagSelectorProps) {
  const toggleGenre = (tag: string) => {
    const next = value.genreTags.includes(tag)
      ? value.genreTags.filter((t) => t !== tag)
      : value.genreTags.length < 3 ? [...value.genreTags, tag] : value.genreTags;
    onChange({ ...value, genreTags: next });
  };
  const toggleVibe = (tag: string) => {
    const next = value.vibeTags.includes(tag)
      ? value.vibeTags.filter((t) => t !== tag)
      : value.vibeTags.length < 3 ? [...value.vibeTags, tag] : value.vibeTags;
    onChange({ ...value, vibeTags: next });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-sm font-medium">Genre <span className="text-muted-foreground">(pick up to 3)</span></p>
        <div className="flex flex-wrap gap-2">
          {GENRE_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleGenre(tag)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                value.genreTags.includes(tag)
                  ? "border-foreground bg-foreground text-background"
                  : "border-muted text-muted-foreground hover:border-foreground hover:text-foreground"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">Vibe <span className="text-muted-foreground">(pick up to 3)</span></p>
        <div className="flex flex-wrap gap-2">
          {VIBE_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleVibe(tag)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                value.vibeTags.includes(tag)
                  ? "border-foreground bg-foreground text-background"
                  : "border-muted text-muted-foreground hover:border-foreground hover:text-foreground"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 8: UPDATE `src/components/studio/style-brief-form.tsx` — source toggle + upload flow

**ADD** imports:
```typescript
import { AudioUpload } from "@/components/studio/audio-upload";
import { MoodTagSelector } from "@/components/studio/mood-tag-selector";
```

**ADD** new state after `const [analyzedSongId, ...]`:
```typescript
const [songSource, setSongSource] = useState<"spotify" | "upload">("spotify");
const [uploadedAudio, setUploadedAudio] = useState<{ url: string; durationMs: number } | null>(null);
const [uploadTitle, setUploadTitle] = useState("");
const [uploadArtistName, setUploadArtistName] = useState("");
const [uploadLyrics, setUploadLyrics] = useState("");
const [uploadBpm, setUploadBpm] = useState(120);
const [moodTags, setMoodTags] = useState<{ genreTags: string[]; vibeTags: string[] }>({
  genreTags: [],
  vibeTags: [],
});
```

**REPLACE** `handleAnalyze` function:
```typescript
const handleAnalyze = async () => {
  if (!savedBriefId) return;
  setAnalyzeStatus("loading");

  try {
    if (songSource === "upload") {
      if (!uploadedAudio) throw new Error("No audio file uploaded");
      const res = await fetch("/api/generate/analyze-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          styleBriefId: savedBriefId,
          audioFileUrl: uploadedAudio.url,
          title: uploadTitle,
          artistName: uploadArtistName,
          durationMs: uploadedAudio.durationMs,
          bpm: uploadBpm,
          lyrics: uploadLyrics || undefined,
          genreTags: moodTags.genreTags,
          vibeTags: moodTags.vibeTags,
        }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error ?? "Analyze failed"); }
      const data = await res.json();
      setAnalyzedSongId(data.song.id);
    } else {
      if (!selectedTrack) throw new Error("No track selected");
      const res = await fetch("/api/generate/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spotifyTrackId: selectedTrack.id,
          styleBriefId: savedBriefId,
          trackTitle: selectedTrack.name,
          artistName: selectedTrack.artistName,
        }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error ?? "Analyze failed"); }
      const data = await res.json();
      setAnalyzedSongId(data.song.id);
    }

    setAnalyzeStatus("done");
    toast.success("Song analyzed successfully!");
  } catch (error) {
    setAnalyzeStatus("error");
    toast.error(error instanceof Error ? error.message : "Failed to analyze song");
  }
};
```

**REPLACE** `canAnalyze`:
```typescript
const canAnalyze =
  saveStatus === "done" &&
  (songSource === "spotify"
    ? !!selectedTrack
    : !!uploadedAudio && !!uploadTitle.trim() && !!uploadArtistName.trim() && moodTags.genreTags.length > 0);
```

**REPLACE** the "Spotify Track" section JSX (the `<div className="space-y-2">` containing `<Label>Spotify Track</Label>`) with:
```tsx
{/* Song source toggle */}
<div className="space-y-2">
  <Label>Music Source</Label>
  <div className="flex rounded-md border w-fit">
    {(["spotify", "upload"] as const).map((src) => (
      <button
        key={src}
        type="button"
        onClick={() => setSongSource(src)}
        className={`px-4 py-1.5 text-sm capitalize transition-colors first:rounded-l-md last:rounded-r-md ${
          songSource === src
            ? "bg-foreground text-background"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        {src === "spotify" ? "Spotify" : "Upload"}
      </button>
    ))}
  </div>
</div>

{/* Spotify path */}
{songSource === "spotify" && (
  <div className="space-y-2">
    <Label>Spotify Track</Label>
    <SpotifyTrackSearch onSelect={setSelectedTrack} />
    {selectedTrack && (
      <div className="rounded-md border bg-muted/40 p-3 text-sm">
        <span className="font-medium">{selectedTrack.name}</span>
        <span className="text-muted-foreground"> — {selectedTrack.artistName}</span>
      </div>
    )}
    {initialBrief?.song && !selectedTrack && (
      <div className="rounded-md border bg-muted/40 p-3 text-sm">
        <span className="font-medium">{initialBrief.song.title}</span>
        <span className="text-muted-foreground"> — {initialBrief.song.artistName}</span>
      </div>
    )}
  </div>
)}

{/* Upload path */}
{songSource === "upload" && (
  <div className="space-y-4">
    <AudioUpload
      uploaded={uploadedAudio}
      onUploaded={setUploadedAudio}
      onClear={() => setUploadedAudio(null)}
      title={uploadTitle}
      onTitleChange={setUploadTitle}
      artistName={uploadArtistName}
      onArtistNameChange={setUploadArtistName}
      lyrics={uploadLyrics}
      onLyricsChange={setUploadLyrics}
      bpm={uploadBpm}
      onBpmChange={setUploadBpm}
    />
    <div className="space-y-2">
      <Label>Genre & Vibe <span className="text-muted-foreground text-xs">(used to infer mood for visuals)</span></Label>
      <MoodTagSelector value={moodTags} onChange={setMoodTags} />
    </div>
  </div>
)}
```

**UPDATE** the analyze button label for upload mode:
```tsx
{analyzeStatus === "loading"
  ? (songSource === "upload" && !uploadLyrics ? "Transcribing + Analyzing... (60–90s)" : "Analyzing... (30–60s)")
  : ...}
```

- **GOTCHA**: `Textarea` import — if not already imported, add `import { Textarea } from "@/components/ui/textarea"` to `audio-upload.tsx`. Check if `src/components/ui/textarea.tsx` exists first.
- **GOTCHA**: The existing `initialBrief?.song` display block is kept for Spotify mode — it shows when editing an existing brief that already has a Spotify song linked
- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 9: CHECK `src/components/ui/textarea.tsx` exists

```bash
ls src/components/ui/textarea.tsx 2>/dev/null || npx shadcn add textarea
```

- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 10: FINAL BUILD VALIDATION

```bash
npm run db:push
npm run lint:fix
npm run lint
npx tsc --noEmit
npm run build
```

---

## TESTING STRATEGY

### Manual Validation

| Scenario | Expected |
|---|---|
| Upload an MP3 → audio-upload component | File uploads, duration shown (e.g. "3:42") |
| Leave lyrics blank, click Analyze | Whisper transcribes, analysis completes (~60-90s) |
| Provide lyrics manually, click Analyze | Analysis skips Whisper (~30-45s) |
| Click Generate after analyze | Frame generation queues normally |
| Published play page with uploaded song | Beat-sync player works with synthetic beats |
| Existing Spotify briefs | Unaffected — source toggle defaults to "spotify" |
| Upload mode with empty genreTags | Analyze button stays disabled |
| Upload mode without audio file | Analyze button stays disabled |
| Song title/artist in published experience | Shows user-provided title/artist name |

### Edge Cases

- Whisper returns empty string → 422 "please provide lyrics manually"
- Audio file has no loadedmetadata event (corrupt file) → `durationMs = 0` fallback; synthetic beat grid degrades gracefully (0 beats)
- `bpm = 0` or NaN → Zod validation rejects (`z.number().min(40)`)
- Re-analyzing same uploaded brief → `existingSong && !existingSong.spotifyTrackId` guard updates in-place instead of creating duplicate song
- Spotify brief with `spotifyTrackId` shown in upload mode → user toggles to upload, creates a separate song record (brief's `songId` is replaced)

---

## VALIDATION COMMANDS

```bash
npm run db:push                     # apply spotifyTrackId nullable migration
npm run lint:fix && npm run lint    # zero errors
npx tsc --noEmit                    # zero type errors
npm run build                       # production build succeeds
```

---

## ACCEPTANCE CRITERIA

- [ ] `songs.spotifyTrackId` is nullable; `songs.audioFileUrl` column exists
- [ ] `POST /api/upload/audio` accepts MP3/WAV/OGG/AAC up to 50MB, returns Blob URL
- [ ] `POST /api/generate/analyze-upload` runs Whisper if no lyrics provided
- [ ] `POST /api/generate/analyze-upload` generates synthetic beat grid from BPM
- [ ] `POST /api/generate/analyze-upload` calls `analyzeLyrics` + `analyzeMoodFromTags` → stores NarrativeMap + MoodProfile + BeatGrid
- [ ] Studio form shows "Spotify / Upload" toggle
- [ ] Upload mode renders AudioUpload + MoodTagSelector
- [ ] Analyze button disabled until: audio uploaded + title + artist + ≥1 genre tag
- [ ] Full pipeline completes: upload → analyze → generate → play with beat-sync visuals
- [ ] Spotify flow still works unchanged when "Spotify" source selected
- [ ] `npm run build` exits 0

---

## NOTES

**`spotifyTrackId` nullable**: The only query that relied on it being `NOT NULL` was `db.query.songs.findFirst({ where: eq(songs.spotifyTrackId, id) })` in the existing analyze route. That route still only runs for Spotify songs, so this is safe.

**Whisper model**: `openai/whisper` on Replicate is well-tested and supports all major audio formats. The `"small"` model is a good balance of speed (~30s for a 3-min song) and accuracy. Swap for `"medium"` if accuracy is insufficient. Whisper runs on the audio URL directly from Vercel Blob — no re-upload needed.

**Synthetic beat grid quality**: Evenly-spaced beats at constant BPM work well for electronic/dance music. For complex jazz or classical, the frame transitions may feel mechanical. A future phase could replace this with `essentia-models` or `basic-pitch` on Replicate for true beat detection.

**`maxDuration = 120`**: Whisper for a 4-minute song takes ~30-60s. Narrative analysis + mood analysis adds ~15s. 120s total budget is comfortable. Requires Vercel Pro for the analyze-upload route; on hobby plans, the function may timeout if lyrics are not pre-provided. Document this as a known limitation.

**Why not browser-side Whisper?**: Whisper.js runs in the browser via WASM, but it's 75-150MB to load and runs in 1–5 minutes on CPU. Server-side via Replicate is faster and doesn't require the user to keep the tab open.

**Confidence Score: 8/10** (slight uncertainty around Whisper output format consistency across Replicate versions — always validate the output shape before parsing)
