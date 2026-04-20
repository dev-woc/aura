# Feature: Aura Phase 3 — Artist Profiles + Public Artist Pages + Generation Recovery

The following plan should be complete. Validate codebase patterns before implementing. Pay special attention to the auth pattern (`const { data: session } = await auth.getSession()`), Drizzle `db.query.*` patterns, and the existing `(listener)` layout's redirect behavior.

---

## Feature Description

Phase 3 adds artist identity, public discoverability, and resilience. Artists can set a bio, avatar, and display name. Public `/artist/[artistId]` pages let listeners browse an artist's portfolio. The generation recovery feature auto-resumes polling when an artist returns to a brief that is still generating. The listener layout redirect is fixed by moving public pages to a new `(public)` route group.

## User Stories

**Artist:** As an artist, I want a profile settings page where I can set my display name, write a short bio, and upload an avatar so my public page looks complete.

**Listener:** As a listener, I want to browse a public artist page and see all their published style briefs so I can explore their work.

**Artist:** As an artist, if I close the tab while frames are being generated and come back to the brief, I want generation to resume polling automatically.

## Problem Statement

1. `artists` table has no `bio` or `avatarUrl` — artist pages are identity-less.
2. No artist settings page in the studio, no artist profile API, no avatar upload.
3. No public artist page at `/artist/[artistId]`.
4. `(listener)` layout redirects to `/onboarding` if `onboardingComplete` is false — artists visiting `/discover` get redirect-looped.
5. Middleware doesn't cover `/discover`, `/play/:path*`, `/artist/:path*` — unauthenticated users get API errors.
6. `GET /api/style-briefs/[id]` doesn't return the latest generation job — studio can't auto-resume polling.
7. Artist names in `/discover` and `/play/[briefId]` are plain text — should link to `/artist/[artistId]`.

## Feature Metadata

**Feature Type**: Enhancement + New Capability
**Estimated Complexity**: Medium
**Primary Systems Affected**: DB schema, API routes, Studio UI, public routing
**Dependencies**: All existing (no new packages)

---

## CONTEXT REFERENCES

### Relevant Codebase Files — READ BEFORE IMPLEMENTING

- `src/lib/db/schema.ts` — `artists` table (lines 30–45); `generationJobs` table; relations block
- `src/app/api/upload/reference-image/route.ts` — mirror for avatar upload
- `src/app/api/style-briefs/[id]/route.ts` — GET to update with `latestJob`
- `src/app/(listener)/layout.tsx` — has the onboarding redirect `useEffect`
- `src/middleware.ts` — extend matcher
- `src/app/(studio)/layout.tsx` — add Settings link
- `src/lib/validations.ts` — add `artistProfileSchema`
- `src/app/(listener)/discover/page.tsx` — to be moved to `(public)`
- `src/app/(listener)/play/[briefId]/page.tsx` — to be moved to `(public)`

### New Files to Create

```
src/app/api/artists/me/route.ts
src/app/api/artists/[artistId]/route.ts
src/app/api/upload/avatar/route.ts
src/app/(studio)/studio/settings/page.tsx
src/app/(public)/layout.tsx
src/app/(public)/discover/page.tsx       ← moved from (listener)
src/app/(public)/play/[briefId]/page.tsx ← moved from (listener)
src/app/(public)/artist/[artistId]/page.tsx
```

### Patterns to Follow

**Auth (all protected routes):**
```typescript
const { data: session } = await auth.getSession();
if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
```

**Drizzle update + returning:**
```typescript
const [updated] = await db
  .update(artists)
  .set({ ...parsed.data, updatedAt: new Date() })
  .where(eq(artists.userId, session!.user!.id))
  .returning();
```

**BeatGrid mapped to latestJob query:**
```typescript
const latestJob = await db.query.generationJobs.findFirst({
  where: eq(generationJobs.styleBriefId, id),
  orderBy: [desc(generationJobs.createdAt)],
});
```

**Next.js 15 dynamic params (always await params):**
```typescript
export async function GET(_req: Request, { params }: { params: Promise<{ artistId: string }> }) {
  const { artistId } = await params;
```

---

## STEP-BY-STEP TASKS

### TASK 1: UPDATE `src/lib/db/schema.ts` — add `bio` and `avatarUrl` to `artists`

- **ADD** two nullable columns after `displayName` (line 37):
```typescript
bio: text("bio"),
avatarUrl: text("avatar_url"),
```
- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 2: RUN DB migration

- **VALIDATE**: `npm run db:push`

---

### TASK 3: ADD `artistProfileSchema` to `src/lib/validations.ts`

- **APPEND** after last export:
```typescript
export const artistProfileSchema = z.object({
  displayName: z.string().min(1).max(100),
  bio: z.string().max(500).optional(),
  avatarUrl: z.string().url().optional().or(z.literal("")),
});
```
- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 4: CREATE `src/app/api/artists/me/route.ts`

GET returns current artist. PATCH updates displayName/bio/avatarUrl using `artistProfileSchema.partial()`.

```typescript
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { artists } from "@/lib/db/schema";
import { artistProfileSchema } from "@/lib/validations";

export async function GET(_request: NextRequest) {
  const { data: session } = await auth.getSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const artist = await db.query.artists.findFirst({
    where: eq(artists.userId, session!.user!.id),
  });
  if (!artist) return NextResponse.json({ error: "Artist profile not found" }, { status: 404 });

  return NextResponse.json({ artist });
}

export async function PATCH(request: NextRequest) {
  const { data: session } = await auth.getSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = artistProfileSchema.partial().safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

  const [updated] = await db
    .update(artists)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(artists.userId, session!.user!.id))
    .returning();

  if (!updated) return NextResponse.json({ error: "Artist profile not found" }, { status: 404 });

  return NextResponse.json({ artist: updated });
}
```

- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 5: CREATE `src/app/api/upload/avatar/route.ts`

Mirror `src/app/api/upload/reference-image/route.ts`. Single file only, blob path `aura/avatars/`.

- **PATTERN**: Copy reference-image route; change blob path to `aura/avatars/${session!.user!.id}/${Date.now()}-${file.name}`; remove multi-file logic (single `file` field only)
- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 6: CREATE `src/app/api/artists/[artistId]/route.ts` — public route, no auth

```typescript
import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { artists, styleBriefs } from "@/lib/db/schema";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ artistId: string }> },
) {
  const { artistId } = await params;

  const artist = await db.query.artists.findFirst({ where: eq(artists.id, artistId) });
  if (!artist) return NextResponse.json({ error: "Artist not found" }, { status: 404 });

  const briefs = await db.query.styleBriefs.findMany({
    where: and(
      eq(styleBriefs.artistId, artistId),
      eq(styleBriefs.published, true),
      eq(styleBriefs.status, "ready"),
    ),
    with: { song: true },
    orderBy: [desc(styleBriefs.publishedAt)],
  });

  return NextResponse.json({ artist, briefs });
}
```

- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 7: UPDATE `src/app/api/style-briefs/[id]/route.ts` — include `latestJob` in GET

- **UPDATE** import line 1: add `desc` → `import { and, desc, eq } from "drizzle-orm";`
- **UPDATE** import line 6: add `generationJobs` → `import { artists, generationJobs, songs, styleBriefs } from "@/lib/db/schema";`
- **UPDATE** GET handler return: after fetching `brief`, also fetch `latestJob`:
```typescript
const latestJob = await db.query.generationJobs.findFirst({
  where: eq(generationJobs.styleBriefId, id),
  orderBy: [desc(generationJobs.createdAt)],
});
return NextResponse.json({ styleBrief: brief, latestJob: latestJob ?? null });
```
- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 8: UPDATE `src/app/(studio)/studio/[id]/page.tsx` — generation recovery on load

- **ADD** `GenerationJob` to imports from `@/types`
- **UPDATE** the initial fetch `useEffect` to read `data.latestJob` and auto-start polling if brief is generating:
```typescript
if (data.styleBrief.status === "generating" && data.latestJob?.id) {
  setJobId(data.latestJob.id);
  setJobStatus(data.latestJob.status);
}
```
- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 9: CREATE `src/app/(studio)/studio/settings/page.tsx`

Client component. Fetches `GET /api/artists/me` on load to pre-fill form. Avatar upload via hidden file input → `POST /api/upload/avatar` → updates `avatarUrl` state. Form submit → `PATCH /api/artists/me`.

Fields: avatar preview + upload button, displayName input, bio textarea (500 char limit with counter), Save button.

- **IMPORTS**: `Image` from `next/image`, `toast` from `sonner`, `Button`, `Input`, `Label`, `Textarea` from `@/components/ui/*`, `Artist` from `@/types`
- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 10: UPDATE `src/app/(studio)/layout.tsx` — add Settings nav link

- **ADD** inside `<div className="flex items-center gap-4">`, before the user name span:
```typescript
<Link href="/studio/settings" className="text-sm text-muted-foreground hover:text-foreground">
  Settings
</Link>
```
- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 11: CREATE `src/app/(public)/layout.tsx` — public layout without auth guard

Minimal nav with "Aura" logo, "Discover" link, and Sign In / My Dashboard link based on session. No `useEffect` redirect. No onboarding check.

```typescript
"use client";

import Link from "next/link";
import { authClient } from "@/lib/auth/client";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = authClient.useSession();

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b bg-card">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <Link href="/discover" className="text-lg font-semibold">
            Aura
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/discover" className="text-sm text-muted-foreground hover:text-foreground">
              Discover
            </Link>
            {session?.user ? (
              <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
                My Dashboard
              </Link>
            ) : (
              <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">
                Sign In
              </Link>
            )}
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
    </div>
  );
}
```

- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 12: MOVE discover + play pages into `(public)` route group

- **CREATE** `src/app/(public)/discover/page.tsx` — copy content of `src/app/(listener)/discover/page.tsx`
- **CREATE** `src/app/(public)/play/[briefId]/page.tsx` — copy content of `src/app/(listener)/play/[briefId]/page.tsx`
- **DELETE** `src/app/(listener)/discover/page.tsx`
- **DELETE** `src/app/(listener)/play/[briefId]/page.tsx`
- **DELETE** empty directories `src/app/(listener)/discover/` and `src/app/(listener)/play/`
- **VALIDATE**: `npm run build` — confirm `/discover` and `/play/[briefId]` still compile

---

### TASK 13: CREATE `src/app/(public)/artist/[artistId]/page.tsx`

Fetches `GET /api/artists/[artistId]`. Shows avatar (fallback: initial letter), display name, bio, and brief grid linking to `/play/[briefId]`.

- **IMPORTS**: `Image`, `Link`, `useParams`, `useEffect`, `useState`, `Card*` from `@/components/ui/card`, `Artist`, `Song`, `StyleBrief` from `@/types`
- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 14: UPDATE `src/middleware.ts` — extend matcher

```typescript
export const config = {
  matcher: [
    "/onboarding",
    "/studio",
    "/studio/:path*",
    "/dashboard",
    "/dashboard/:path*",
    "/discover",
    "/play/:path*",
    "/artist/:path*",
  ],
};
```

- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 15: UPDATE `src/app/(public)/discover/page.tsx` — artist name link

- **UPDATE** artist display name (plain text) to:
```typescript
<Link
  href={`/artist/${brief.artist.id}`}
  className="text-sm text-muted-foreground hover:underline"
  onClick={(e) => e.stopPropagation()}
>
  {brief.artist.displayName}
</Link>
```
- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 16: UPDATE `src/app/(public)/play/[briefId]/page.tsx` — artist name link

- **ADD** `import Link from "next/link";`
- **UPDATE** artist display (plain text) to:
```typescript
<Link href={`/artist/${brief.artist.id}`} className="text-muted-foreground hover:underline">
  {brief.artist.displayName}
</Link>
```
- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 17: FINAL BUILD VALIDATION

- **VALIDATE**: `npx tsc --noEmit && npm run build`

---

## VALIDATION COMMANDS

```bash
npm run db:push          # Task 2
npx tsc --noEmit         # After each task
npm run build            # Final
```

---

## ACCEPTANCE CRITERIA

- [ ] `artists` table has `bio` and `avatar_url` columns in Neon
- [ ] `GET /api/artists/me` returns artist profile; 401 without session
- [ ] `PATCH /api/artists/me` updates fields and returns updated artist
- [ ] `POST /api/upload/avatar` uploads to Vercel Blob, returns `{ url }`
- [ ] `GET /api/artists/[artistId]` returns artist + published briefs, no auth needed
- [ ] `GET /api/style-briefs/[id]` includes `latestJob` in response
- [ ] `/studio/settings` loads, pre-fills, avatar upload works, save works
- [ ] Studio nav has Settings link
- [ ] `/artist/[artistId]` renders avatar, name, bio, briefs grid
- [ ] `/discover` and `/play/[briefId]` served from `(public)` route group — listener onboarding redirect does NOT apply
- [ ] Unauthenticated users hitting `/discover` redirect to `/login` (middleware)
- [ ] Studio edit page auto-starts polling when brief is `"generating"` on load
- [ ] Artist names in `/discover` and `/play/[briefId]` link to `/artist/[artistId]`
- [ ] `npm run build` passes with zero errors

---

## NOTES

**Route group resolution**: Moving pages from `(listener)` to `(public)` changes which layout wraps them, not the URL. `/discover` resolves identically from either group.

**`(listener)` layout unchanged**: After the move, `(listener)` only wraps `/dashboard`. Its onboarding redirect is correct for that path.

**`avatarUrl` stored as Vercel Blob URL**: Avatar upload returns a URL; client includes it in the PATCH body. Same pattern as reference images.

**Confidence Score: 9/10**
