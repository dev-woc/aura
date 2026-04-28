# Feature: Aura Phase 4 — Discovery UX + Shareability + Studio Management

The following plan should be complete. Validate codebase patterns before implementing. Pay special attention to the `generateMetadata` server/client split pattern (most nuanced task), the Dialog component API, and the Drizzle `with` + `limit` syntax.

---

## Feature Description

Phase 4 improves discoverability, shareability, and studio workflow. Listeners can search the discover page. Published briefs and artist pages carry full Open Graph meta tags so share links render rich previews. Artists can delete briefs from both the list and edit pages with a confirmation dialog. Artists can regenerate frames for a ready brief without creating a new style brief. Studio list cards show a thumbnail of the first generated frame.

## User Stories

**Listener:** As a listener, I want to search for experiences by title, artist, or song so I can find content I care about without scrolling an undifferentiated grid.

**Artist/Listener:** As anyone sharing a link to a play page or artist page, I want the link to unfurl with a rich preview (image, title, description) in social apps and messaging so it's more compelling to click.

**Artist:** As an artist, I want to delete old or unwanted style briefs so my studio stays organised.

**Artist:** As an artist, I want to regenerate frames after tweaking my style settings without creating a new brief from scratch.

**Artist:** As an artist, I want to see a thumbnail on my brief cards so I can tell at a glance which briefs have generated frames.

## Feature Metadata

**Feature Type**: Enhancement  
**Estimated Complexity**: Medium  
**Primary Systems Affected**: API routes, public pages (OG meta), studio pages, next.config.ts  
**Dependencies**: All existing (no new packages needed)

---

## CONTEXT REFERENCES

### Relevant Codebase Files — READ BEFORE IMPLEMENTING

- `src/app/(public)/play/[briefId]/page.tsx` (lines 1–72) — full `"use client"` component; needs server/client split for `generateMetadata`
- `src/app/(public)/artist/[artistId]/page.tsx` (lines 1–106) — same pattern; full `"use client"` component
- `src/app/(public)/discover/page.tsx` (lines 1–66) — client component; `fetch("/api/discover")` with no params; add search here
- `src/app/(studio)/studio/page.tsx` (lines 1–106) — client card grid; no `generatedFrames` in response yet
- `src/app/(studio)/studio/[id]/page.tsx` (lines 1–140) — has `handlePublish`, job polling, `StyleBriefForm` + `PreviewPlayer`; add delete + regenerate
- `src/app/api/style-briefs/route.ts` (lines 19–26) — `findMany` with `with: { song: true }`; add `generatedFrames: { limit: 1 }`
- `src/app/api/style-briefs/[id]/route.ts` (lines 52–68) — `DELETE` handler already exists; ownership check via `getArtistForSession`
- `src/app/api/discover/route.ts` (lines 1–15) — `GET()` no params; needs `request: NextRequest` + `q` filtering
- `next.config.ts` (lines 5–9) — `remotePatterns` has `replicate.delivery` but NOT `pbxt.replicate.delivery` (subdomain used by Replicate for output images)
- `src/components/ui/dialog.tsx` — `Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogFooter`, `DialogTitle`, `DialogDescription`, `DialogClose` all available; `DialogFooter` has `showCloseButton` prop
- `src/lib/db/schema.ts` (lines 30–45) — `artists` table; (lines 77–98) — `styleBriefs`; (lines 100–122) — `generatedFrames`; (lines 138–173) — relations

### New Files to Create

```
src/app/(public)/play/[briefId]/page-client.tsx       — extract existing client logic here
src/app/(public)/artist/[artistId]/page-client.tsx    — extract existing client logic here
src/app/api/style-briefs/[id]/frames/route.ts         — DELETE: clear frames + reset status to "draft"
```

### Files to Modify

```
src/app/(public)/play/[briefId]/page.tsx              — convert to server component + generateMetadata
src/app/(public)/artist/[artistId]/page.tsx           — convert to server component + generateMetadata
src/app/(public)/discover/page.tsx                    — debounced search input + q param
src/app/(studio)/studio/page.tsx                      — delete button + thumbnail + import Image
src/app/(studio)/studio/[id]/page.tsx                 — delete button + regenerate button
src/app/api/style-briefs/route.ts                     — first-frame include in GET
src/app/api/discover/route.ts                         — search filter on q param
next.config.ts                                        — add pbxt.replicate.delivery remotePattern
```

### Patterns to Follow

**Auth (protected routes):**
```typescript
const { data: session } = await auth.getSession();
if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
```

**Drizzle `with` + limit (first-frame):**
```typescript
with: {
  song: true,
  generatedFrames: {
    limit: 1,
    orderBy: (t, { asc }) => [asc(t.sortOrder)],
  },
},
```

**generateMetadata — direct DB query (not fetch):**
```typescript
import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { styleBriefs } from "@/lib/db/schema";

export async function generateMetadata(
  { params }: { params: Promise<{ briefId: string }> }
): Promise<Metadata> {
  const { briefId } = await params;
  const brief = await db.query.styleBriefs.findFirst({
    where: eq(styleBriefs.id, briefId),
    with: { song: true, generatedFrames: { limit: 1, orderBy: (t, { asc }) => [asc(t.sortOrder)] } },
  });
  if (!brief) return { title: "Aura" };
  // build og tags...
}
```

**Delete confirmation Dialog:**
```typescript
<Dialog>
  <DialogTrigger asChild>
    <Button variant="destructive" size="sm">Delete</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Delete Style Brief</DialogTitle>
      <DialogDescription>
        This permanently deletes &ldquo;{brief.title || "Untitled"}&rdquo; and all frames.
      </DialogDescription>
    </DialogHeader>
    <DialogFooter showCloseButton>
      <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
        {deleting ? "Deleting..." : "Delete"}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Debounce pattern (no external lib):**
```typescript
const [query, setQuery] = useState("");
const [debouncedQuery, setDebouncedQuery] = useState("");

useEffect(() => {
  const timer = setTimeout(() => setDebouncedQuery(query), 300);
  return () => clearTimeout(timer);
}, [query]);

useEffect(() => {
  // fetch using debouncedQuery
}, [debouncedQuery]);
```

---

## STEP-BY-STEP TASKS

---

### TASK 1: UPDATE `next.config.ts` — add `pbxt.replicate.delivery` remote pattern

`hostname: "replicate.delivery"` in `remotePatterns` matches only that exact hostname. Replicate serves output images from `pbxt.replicate.delivery` (a subdomain), which is not covered. This causes `next/image` errors in production.

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i.scdn.co" },
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
      { protocol: "https", hostname: "replicate.delivery" },
      { protocol: "https", hostname: "pbxt.replicate.delivery" },
    ],
  },
};

export default nextConfig;
```

- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 2: CREATE `src/app/api/style-briefs/[id]/frames/route.ts` — delete frames + reset status

```typescript
import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { artists, generatedFrames, styleBriefs } from "@/lib/db/schema";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { data: session } = await auth.getSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const artist = await db.query.artists.findFirst({
    where: eq(artists.userId, session!.user!.id),
  });
  if (!artist) return NextResponse.json({ error: "Artist not found" }, { status: 404 });

  const brief = await db.query.styleBriefs.findFirst({
    where: and(eq(styleBriefs.id, id), eq(styleBriefs.artistId, artist.id)),
  });
  if (!brief) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.delete(generatedFrames).where(eq(generatedFrames.styleBriefId, id));
  await db
    .update(styleBriefs)
    .set({ status: "draft", published: false, updatedAt: new Date() })
    .where(eq(styleBriefs.id, id));

  return NextResponse.json({ success: true });
}
```

- **NOTE**: Also set `published: false` when clearing frames — a brief can't remain published without frames
- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 3: UPDATE `src/app/api/style-briefs/route.ts` — include first frame in GET

- **LOCATION**: `db.query.styleBriefs.findMany` in GET handler (lines 19–26)
- **UPDATE** `with` clause:

```typescript
with: {
  song: true,
  generatedFrames: {
    limit: 1,
    orderBy: (t, { asc }) => [asc(t.sortOrder)],
  },
},
```

- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 4: UPDATE `src/app/api/discover/route.ts` — add `q` search param

```typescript
import { and, desc, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { styleBriefs } from "@/lib/db/schema";

export async function GET(request: NextRequest) {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";

  const published = await db.query.styleBriefs.findMany({
    where: and(eq(styleBriefs.published, true), eq(styleBriefs.status, "ready")),
    with: { song: true, artist: true },
    orderBy: [desc(styleBriefs.publishedAt)],
    limit: 50,
  });

  const results = q
    ? published.filter((b) => {
        const lower = q.toLowerCase();
        return (
          b.title?.toLowerCase().includes(lower) ||
          b.song?.title?.toLowerCase().includes(lower) ||
          b.song?.artistName?.toLowerCase().includes(lower) ||
          b.artist?.displayName?.toLowerCase().includes(lower)
        );
      })
    : published;

  return NextResponse.json({ briefs: results });
}
```

- **GOTCHA**: Function signature changes from `GET()` to `GET(request: NextRequest)` — add `NextRequest` import
- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 5: CREATE `src/app/(public)/play/[briefId]/page-client.tsx`

Extract the full existing `page.tsx` client logic into a named export component that accepts `briefId` as a prop instead of calling `useParams()`. Copy the entire existing file content, change to a named export, replace `useParams()` with the prop.

```typescript
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AuraPlayer } from "@/components/player/aura-player";
import type { Artist, BeatGrid, GeneratedFrame, Song, StyleBrief } from "@/types";

type PlayBrief = StyleBrief & { song: Song | null; artist: Artist };

export function PlayPageClient({ briefId }: { briefId: string }) {
  const [brief, setBrief] = useState<PlayBrief | null>(null);
  const [frames, setFrames] = useState<GeneratedFrame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/play/${briefId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.brief) { setBrief(data.brief); setFrames(data.frames ?? []); }
        else setError("Not found");
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }, [briefId]);

  if (loading) return <div className="flex justify-center py-16"><p className="text-muted-foreground">Loading...</p></div>;
  if (error || !brief) return <div className="flex justify-center py-16"><p className="text-destructive">{error || "Not found"}</p></div>;

  const beatGrid = (brief.song?.beatGrid as BeatGrid | null) ?? null;
  const durationMs = brief.song?.durationMs ?? 240_000;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{brief.title || "Untitled"}</h1>
        <Link href={`/artist/${brief.artist.id}`} className="text-muted-foreground hover:underline">
          {brief.artist.displayName}
        </Link>
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

---

### TASK 6: REWRITE `src/app/(public)/play/[briefId]/page.tsx` — server component with generateMetadata

Replace the entire file. No `"use client"` directive. Queries DB directly for meta tags.

```typescript
import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { styleBriefs } from "@/lib/db/schema";
import { PlayPageClient } from "./page-client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ briefId: string }>;
}): Promise<Metadata> {
  const { briefId } = await params;
  const brief = await db.query.styleBriefs.findFirst({
    where: eq(styleBriefs.id, briefId),
    with: {
      song: true,
      generatedFrames: { limit: 1, orderBy: (t, { asc }) => [asc(t.sortOrder)] },
    },
  });
  if (!brief) return { title: "Aura" };

  const title = brief.title || "Untitled";
  const description = brief.song
    ? `${brief.song.title} — ${brief.song.artistName}`
    : "A visual music experience on Aura";
  const imageUrl = brief.generatedFrames?.[0]?.frameUrl ?? null;

  return {
    title: `${title} — Aura`,
    description,
    openGraph: {
      title,
      description,
      ...(imageUrl ? { images: [{ url: imageUrl }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(imageUrl ? { images: [imageUrl] } : {}),
    },
  };
}

export default async function PlayPage({
  params,
}: {
  params: Promise<{ briefId: string }>;
}) {
  const { briefId } = await params;
  return <PlayPageClient briefId={briefId} />;
}
```

- **GOTCHA 1**: No `"use client"` — this is a Server Component. `generateMetadata` and async default export are server-only APIs
- **GOTCHA 2**: `generatedFrames` is always an array even with `limit: 1` — use `[0]` to get first frame
- **GOTCHA 3**: `PlayPageClient` is a **named** export from `./page-client` — not a default export
- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 7: CREATE `src/app/(public)/artist/[artistId]/page-client.tsx`

Same pattern as Task 5. Extract full existing `page.tsx` (lines 1–106) into a named-export client component accepting `artistId` prop. Remove `useParams()` call.

```typescript
"use client";
// ... copy all imports from existing page.tsx
// Change: remove useParams import, add artistId prop

export function ArtistPageClient({ artistId }: { artistId: string }) {
  // ... identical to existing page.tsx body but using `artistId` prop instead of useParams()
}
```

- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 8: REWRITE `src/app/(public)/artist/[artistId]/page.tsx` — server component with generateMetadata

```typescript
import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { artists } from "@/lib/db/schema";
import { ArtistPageClient } from "./page-client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ artistId: string }>;
}): Promise<Metadata> {
  const { artistId } = await params;
  const artist = await db.query.artists.findFirst({
    where: eq(artists.id, artistId),
  });
  if (!artist) return { title: "Artist — Aura" };

  const title = artist.displayName || "Unknown Artist";
  const description = artist.bio || `Visual experiences by ${title} on Aura`;

  return {
    title: `${title} — Aura`,
    description,
    openGraph: {
      title,
      description,
      ...(artist.avatarUrl ? { images: [{ url: artist.avatarUrl }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(artist.avatarUrl ? { images: [artist.avatarUrl] } : {}),
    },
  };
}

export default async function ArtistPage({
  params,
}: {
  params: Promise<{ artistId: string }>;
}) {
  const { artistId } = await params;
  return <ArtistPageClient artistId={artistId} />;
}
```

- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 9: UPDATE `src/app/(studio)/studio/[id]/page.tsx` — delete + regenerate

**Add imports:**
```typescript
import { useRouter } from "next/navigation";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
```

**Add state + router:**
```typescript
const router = useRouter();
const [deleting, setDeleting] = useState(false);
```

**Add handlers:**
```typescript
const handleDelete = async () => {
  if (!brief) return;
  setDeleting(true);
  try {
    const res = await fetch(`/api/style-briefs/${brief.id}`, { method: "DELETE" });
    if (res.ok) router.push("/studio");
  } finally {
    setDeleting(false);
  }
};

const handleRegenerate = async () => {
  if (!brief?.songId) return;
  await fetch(`/api/style-briefs/${brief.id}/frames`, { method: "DELETE" });
  setFrames([]);
  setBrief((prev) => (prev ? { ...prev, status: "draft", published: false } : null));
  const res = await fetch("/api/generate/frames", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ songId: brief.songId, styleBriefId: brief.id, frameCount: 10 }),
  });
  const data = await res.json();
  if (data.jobId) handleGenerationStarted(data.jobId);
};
```

**Update page header JSX** (replace the existing header `<div className="flex items-center justify-between gap-4">`):
```typescript
<div className="flex items-center justify-between gap-4">
  <h1 className="text-2xl font-bold">{brief.title || "Untitled Brief"}</h1>
  <div className="flex items-center gap-2">
    {brief.status === "ready" && frames.length > 0 && (
      <Button variant="outline" size="sm" onClick={handleRegenerate} disabled={!!isGenerating}>
        Regenerate
      </Button>
    )}
    {brief.status === "ready" && (
      <Button
        variant={brief.published ? "outline" : "default"}
        size="sm"
        onClick={handlePublish}
        disabled={publishing}
      >
        {publishing ? "..." : brief.published ? "Unpublish" : "Publish"}
      </Button>
    )}
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm" disabled={deleting}>Delete</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Style Brief</DialogTitle>
          <DialogDescription>
            This permanently deletes &ldquo;{brief.title || "Untitled"}&rdquo; and all generated
            frames. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter showCloseButton>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</div>
```

- **GOTCHA**: `brief.songId` is nullable in schema — guard before using it in `handleRegenerate`
- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 10: UPDATE `src/app/(studio)/studio/page.tsx` — delete button + thumbnail

**Add imports:**
```typescript
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import type { GeneratedFrame, Song, StyleBrief } from "@/types";
```

**Update type** (now includes `generatedFrames`):
```typescript
type BriefWithSong = StyleBrief & {
  song?: Song | null;
  generatedFrames?: GeneratedFrame[];
};
```

**Add state + router:**
```typescript
const router = useRouter();
const [deletingId, setDeletingId] = useState<string | null>(null);
```

**Add delete handler:**
```typescript
const handleDelete = async (briefId: string, e: React.MouseEvent) => {
  e.stopPropagation();
  setDeletingId(briefId);
  try {
    const res = await fetch(`/api/style-briefs/${briefId}`, { method: "DELETE" });
    if (res.ok) setBriefs((prev) => prev.filter((b) => b.id !== briefId));
  } finally {
    setDeletingId(null);
  }
};
```

**Convert card from `<Link>` wrapper to click handler** (avoids anchor-in-anchor with Dialog):
```typescript
// Replace <Link key={brief.id} href={`/studio/${brief.id}`}> with:
<div
  key={brief.id}
  onClick={() => router.push(`/studio/${brief.id}`)}
  className="cursor-pointer"
>
  <Card className="h-full transition-shadow hover:shadow-md">
    {/* thumbnail if frames exist */}
    {brief.generatedFrames?.[0]?.frameUrl && (
      <div className="relative aspect-video w-full overflow-hidden rounded-t-lg bg-muted">
        <Image
          src={brief.generatedFrames[0].frameUrl}
          alt={brief.title || "Brief thumbnail"}
          fill
          className="object-cover"
        />
      </div>
    )}
    <CardHeader>
      <CardTitle className="line-clamp-1 text-base">{brief.title || "Untitled"}</CardTitle>
    </CardHeader>
    <CardContent className="space-y-2">
      <p className="text-sm text-muted-foreground">
        {brief.song?.title ? `${brief.song.title} — ${brief.song.artistName}` : "No song linked"}
      </p>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[brief.status] ?? statusColors.draft}`}>
            {brief.status}
          </span>
          {brief.published && (
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${publishedBadge}`}>
              published
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{new Date(brief.createdAt).toLocaleDateString()}</span>
          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                onClick={(e) => e.stopPropagation()}
                disabled={deletingId === brief.id}
              >
                ×
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Style Brief</DialogTitle>
                <DialogDescription>
                  This permanently deletes &ldquo;{brief.title || "Untitled"}&rdquo;. Cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter showCloseButton>
                <Button
                  variant="destructive"
                  onClick={(e) => handleDelete(brief.id, e)}
                  disabled={deletingId === brief.id}
                >
                  {deletingId === brief.id ? "Deleting..." : "Delete"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </CardContent>
  </Card>
</div>
```

- **GOTCHA**: The `"×"` button's `onClick` uses `e.stopPropagation()` to prevent the card navigation from firing when the trigger is clicked
- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 11: UPDATE `src/app/(public)/discover/page.tsx` — debounced search

Replace the existing `useEffect` + state with the two-hook debounce pattern. Add search `<Input>`.

```typescript
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Artist, Song, StyleBrief } from "@/types";

type DiscoverBrief = StyleBrief & { song: Song | null; artist: Artist };

export default function DiscoverPage() {
  const [briefs, setBriefs] = useState<DiscoverBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    setLoading(true);
    const url = debouncedQuery
      ? `/api/discover?q=${encodeURIComponent(debouncedQuery)}`
      : "/api/discover";
    fetch(url)
      .then((r) => r.json())
      .then((data) => setBriefs(data.briefs ?? []))
      .finally(() => setLoading(false));
  }, [debouncedQuery]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Discover</h1>
        <Input
          type="search"
          placeholder="Search by title, artist, or song..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {loading && (
        <div className="flex justify-center py-8">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      )}

      {!loading && briefs.length === 0 && (
        <p className="py-16 text-center text-muted-foreground">
          {debouncedQuery ? `No results for "${debouncedQuery}"` : "No experiences published yet."}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {briefs.map((brief) => (
          <Link key={brief.id} href={`/play/${brief.id}`}>
            <Card className="cursor-pointer transition-shadow hover:shadow-md">
              <CardHeader>
                <CardTitle className="line-clamp-1 text-base">{brief.title || "Untitled"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <Link
                  href={`/artist/${brief.artist.id}`}
                  className="text-sm text-muted-foreground hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {brief.artist.displayName}
                </Link>
                {brief.song && (
                  <p className="text-xs text-muted-foreground">
                    {brief.song.title} — {brief.song.artistName}
                  </p>
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

---

### TASK 12: FINAL BUILD VALIDATION

```bash
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
| `GET /api/discover?q=jazz` | Filters by title/song/artist (case-insensitive) |
| `GET /api/discover` | Full list unchanged |
| `GET /api/style-briefs` | Each brief has `generatedFrames: []` or `[firstFrame]` |
| `DELETE /api/style-briefs/[id]/frames` | Clears frames, sets status "draft", published false |
| `/play/[briefId]` view-source | `og:title`, `og:description`, `og:image` present |
| `/artist/[artistId]` view-source | `og:title`, `og:description`, `og:image` (if avatar) |
| Studio `/studio/[id]` Delete | Confirmation dialog → redirects to `/studio` |
| Studio `/studio` card delete | Removes card from list without page reload |
| Regenerate button | Only visible when `status === "ready"` + frames exist; clears frames + re-queues generation |
| Studio cards | Show thumbnail image when frames exist |
| Discover search | Filters with 300ms debounce; empty query shows all |
| Unauthenticated `/discover` | Redirects to `/login` (middleware) |

### Edge Cases

- `generateMetadata` with unknown `briefId` → `{ title: "Aura" }` (no throw)
- Brief with no frames → no `og:image` in metadata
- Regenerate on brief with `songId: null` → button hidden (status can't be "ready" without a song)
- Delete while generating → API succeeds; generation job continues but brief is gone from DB
- Search query with `%` or `_` → `encodeURIComponent` in client; in-JS filter doesn't use SQL, so no injection risk

---

## VALIDATION COMMANDS

```bash
npm run lint:fix && npm run lint    # zero errors
npx tsc --noEmit                    # zero type errors
npm run build                       # production build succeeds
```

---

## ACCEPTANCE CRITERIA

- [ ] `GET /api/discover?q=<term>` filters on brief title, song title, song artist, artist display name
- [ ] `GET /api/style-briefs` returns `generatedFrames: [firstFrame]` (or `[]`) on each brief
- [ ] `DELETE /api/style-briefs/[id]/frames` deletes all frames, resets status to "draft", sets published to false
- [ ] `/play/[briefId]` `<head>` contains `og:title`, `og:description`, `og:image` (when frames exist)
- [ ] `/artist/[artistId]` `<head>` contains `og:title`, `og:description`, `og:image` (when avatar exists)
- [ ] Play and artist pages continue to function identically for users
- [ ] Studio edit page has Delete button with confirmation dialog → redirects to `/studio`
- [ ] Studio list page has Delete button on each card → removes card on confirm
- [ ] Studio edit page has Regenerate button visible only when `status === "ready"` and frames exist
- [ ] Regenerate: clears frames, shows generating banner, dispatches new job
- [ ] Studio list cards show thumbnail of first generated frame
- [ ] Discover page has debounced search input; empty query shows full list
- [ ] `next.config.ts` includes `pbxt.replicate.delivery`
- [ ] `npm run build` exits 0

---

## NOTES

**`generateMetadata` server/client split:** The page file (no `"use client"`) exports `generateMetadata` and a default async server component that renders `<PageClient id={id} />`. The client file (`page-client.tsx`) has `"use client"` and contains all hooks/state/fetch. Data is fetched twice on load (once server-side for meta, once client-side for render) — acceptable for Phase 4. A future optimization is to pass server-fetched data as props to the client component.

**Why direct DB in `generateMetadata`:** `generateMetadata` runs server-side including at build time. There is no HTTP server to call at build time. Direct `db` import is always correct; `fetch(localhost)` is not.

**Discover search uses in-JS filter:** Published+ready set is capped at 50. In-JS filtering over 50 items is ~0ms. If the dataset grows, replace with a Drizzle `ilike` SQL filter joining across three tables, or adopt a dedicated search index.

**`pbxt.replicate.delivery`:** Replicate routes image outputs through this subdomain. Without the explicit `remotePatterns` entry, any `next/image` rendering a Replicate frame URL from this subdomain throws a configuration error. This is an existing latent bug that only manifests when Replicate uses this subdomain.

**Brief deletion sets `published: false`:** A brief with no frames must not remain published — the play page would show an empty `AuraPlayer`. The `DELETE /api/style-briefs/[id]/frames` route sets both `status: "draft"` and `published: false` atomically.

**Confidence Score: 9/10**
