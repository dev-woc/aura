# Feature: Aura Phase 5 — Listener Engagement (Likes, Play Counts, Liked Library)

Validate codebase patterns before implementing. Pay close attention to Drizzle SQL increment syntax, the `sql` tagged template import, transaction patterns, and the `briefLikes` unique-constraint name when doing `uniqueIndex`.

---

## Feature Description

Phase 5 closes the feedback loop between artists and listeners. Listeners can like published experiences, which artists can see as social proof. Play counts are tracked automatically when a listener views a brief. A "Liked Experiences" section on the listener dashboard gives listeners a personal library. Like and play counts appear on discovery cards and studio management cards.

## User Stories

**Listener:** As a listener, I want to like a visual experience so I can express appreciation and save it to my personal library.

**Listener:** As a listener, I want to see my liked experiences in my dashboard so I can revisit them without searching.

**Artist:** As an artist, I want to see how many plays and likes each of my briefs has received so I know what resonates.

**Any user:** As anyone browsing discover, I want to see like counts on cards so I can gauge popularity at a glance.

## Feature Metadata

**Feature Type**: New Capability  
**Estimated Complexity**: Medium  
**Primary Systems Affected**: DB schema, play API, discover API, play page UI, discover UI, studio UI, listener dashboard  
**Dependencies**: All existing (no new packages needed — `lucide-react` is already available as a shadcn/ui transitive dep)

---

## CONTEXT REFERENCES

### Relevant Codebase Files — READ BEFORE IMPLEMENTING

- `src/lib/db/schema.ts` (full) — Schema to extend; note existing table exports and relations pattern
- `src/types/index.ts` (full) — Types are `InferSelectModel` from schema; `BriefLike` must be added
- `src/app/api/play/[briefId]/route.ts` — Extend GET to return `liked` + counts are already on row
- `src/app/(public)/play/[briefId]/page-client.tsx` — Add like button + view tracking here
- `src/app/(public)/discover/page.tsx` — Add like count badge to cards
- `src/app/(studio)/studio/page.tsx` — Add play/like stat badges to cards
- `src/app/(listener)/dashboard/page.tsx` (lines 1–16) — Simple page; add liked section below welcome
- `src/lib/rate-limit.ts` — `createRateLimiter` factory + existing limiters for reference
- `src/app/api/style-briefs/route.ts` — Pattern for auth + artist ownership check

### New Files to Create

```
src/app/api/play/[briefId]/like/route.ts      — POST: toggle like (auth required)
src/app/api/play/[briefId]/view/route.ts      — POST: increment play count (no auth)
src/app/api/listener/liked/route.ts           — GET: liked briefs for current user
```

### Files to Modify

```
src/lib/db/schema.ts                          — Add likeCount/playCount to styleBriefs; add briefLikes table + relations
src/types/index.ts                            — Add BriefLike type
src/app/api/play/[briefId]/route.ts           — Return liked boolean in GET
src/app/(public)/play/[briefId]/page-client.tsx — Like button + counts + view tracking
src/app/(public)/discover/page.tsx            — Like count badge on cards
src/app/(studio)/studio/page.tsx              — Play/like count badges on cards
src/app/(listener)/dashboard/page.tsx         — Liked experiences section
```

### Patterns to Follow

**Drizzle SQL increment (atomic counter update):**
```typescript
import { sql } from "drizzle-orm";

await db
  .update(styleBriefs)
  .set({ playCount: sql`${styleBriefs.playCount} + 1` })
  .where(eq(styleBriefs.id, briefId));
```

**Drizzle transaction (like toggle — atomic check+insert+increment):**
```typescript
const liked = await db.transaction(async (tx) => {
  const existing = await tx.query.briefLikes.findFirst({
    where: and(eq(briefLikes.userId, userId), eq(briefLikes.styleBriefId, briefId)),
  });
  if (existing) {
    await tx.delete(briefLikes).where(eq(briefLikes.id, existing.id));
    await tx.update(styleBriefs)
      .set({ likeCount: sql`${styleBriefs.likeCount} - 1` })
      .where(and(eq(styleBriefs.id, briefId), sql`${styleBriefs.likeCount} > 0`));
    return false;
  }
  await tx.insert(briefLikes).values({ userId, styleBriefId: briefId });
  await tx.update(styleBriefs)
    .set({ likeCount: sql`${styleBriefs.likeCount} + 1` })
    .where(eq(styleBriefs.id, briefId));
  return true;
});
```

**Rate limiter creation (mirror existing pattern in `src/lib/rate-limit.ts`):**
```typescript
export const viewRateLimiter = createRateLimiter(10, 60_000); // 10 view pings/min per IP
```

**Auth pattern:**
```typescript
const { data: session } = await auth.getSession();
if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
```

**Lucide icon import (available via shadcn/ui):**
```typescript
import { Heart } from "lucide-react";
```

---

## STEP-BY-STEP TASKS

---

### TASK 1: UPDATE `src/lib/db/schema.ts` — add likeCount/playCount + briefLikes table

**ADD** to `styleBriefs` table (after `publishedAt`):
```typescript
likeCount: integer("like_count").notNull().default(0),
playCount: integer("play_count").notNull().default(0),
```

**CREATE** new table after `generationJobs`:
```typescript
export const briefLikes = pgTable(
  "brief_likes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    styleBriefId: uuid("style_brief_id")
      .notNull()
      .references(() => styleBriefs.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_brief_likes_user_brief").on(table.userId, table.styleBriefId),
    index("idx_brief_likes_brief_id").on(table.styleBriefId),
  ],
);
```

**UPDATE** `styleBriefsRelations` — add `briefLikes: many(briefLikes)` to the `many` destructure.

**ADD** new relations export after `generatedFramesRelations`:
```typescript
export const briefLikesRelations = relations(briefLikes, ({ one }) => ({
  styleBrief: one(styleBriefs, {
    fields: [briefLikes.styleBriefId],
    references: [styleBriefs.id],
  }),
}));
```

- **GOTCHA**: `integer` is already imported. `uniqueIndex` is already imported.
- **GOTCHA**: The `briefLikes` table export must come before `briefLikesRelations` in the file.
- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 2: UPDATE `src/types/index.ts` — add BriefLike type

**ADD** `briefLikes` to the import list:
```typescript
import type {
  artists,
  briefLikes,
  generatedFrames,
  generationJobs,
  songs,
  styleBriefs,
  usersMeta,
} from "@/lib/db/schema";
```

**ADD** after `GenerationJob`:
```typescript
export type BriefLike = InferSelectModel<typeof briefLikes>;
```

- **GOTCHA**: `StyleBrief` type will automatically include `likeCount` and `playCount` after Task 1 (it's `InferSelectModel`) — no manual change needed.
- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 3: UPDATE `src/lib/rate-limit.ts` — add viewRateLimiter

**ADD** to the shared rate limiters at the bottom:
```typescript
export const viewRateLimiter = createRateLimiter(10, 60_000); // 10 view pings/min per IP
```

- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 4: CREATE `src/app/api/play/[briefId]/like/route.ts`

```typescript
import { and, eq, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { briefLikes, styleBriefs } from "@/lib/db/schema";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ briefId: string }> },
) {
  const { data: session } = await auth.getSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { briefId } = await params;
  const userId = session.user.id;

  const brief = await db.query.styleBriefs.findFirst({
    where: and(eq(styleBriefs.id, briefId), eq(styleBriefs.published, true)),
  });
  if (!brief) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const liked = await db.transaction(async (tx) => {
    const existing = await tx.query.briefLikes.findFirst({
      where: and(eq(briefLikes.userId, userId), eq(briefLikes.styleBriefId, briefId)),
    });
    if (existing) {
      await tx.delete(briefLikes).where(eq(briefLikes.id, existing.id));
      await tx
        .update(styleBriefs)
        .set({ likeCount: sql`GREATEST(${styleBriefs.likeCount} - 1, 0)` })
        .where(eq(styleBriefs.id, briefId));
      return false;
    }
    await tx.insert(briefLikes).values({ userId, styleBriefId: briefId });
    await tx
      .update(styleBriefs)
      .set({ likeCount: sql`${styleBriefs.likeCount} + 1` })
      .where(eq(styleBriefs.id, briefId));
    return true;
  });

  const updated = await db.query.styleBriefs.findFirst({
    where: eq(styleBriefs.id, briefId),
  });

  return NextResponse.json({ liked, likeCount: updated?.likeCount ?? 0 });
}
```

- **GOTCHA**: Use `GREATEST(likeCount - 1, 0)` guard to prevent negative counts from data races.
- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 5: CREATE `src/app/api/play/[briefId]/view/route.ts`

```typescript
import { and, eq, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { styleBriefs } from "@/lib/db/schema";
import { viewRateLimiter } from "@/lib/rate-limit";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ briefId: string }> },
) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!viewRateLimiter.check(ip).success) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  const { briefId } = await params;

  const brief = await db.query.styleBriefs.findFirst({
    where: and(eq(styleBriefs.id, briefId), eq(styleBriefs.published, true)),
  });
  if (!brief) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db
    .update(styleBriefs)
    .set({ playCount: sql`${styleBriefs.playCount} + 1` })
    .where(eq(styleBriefs.id, briefId));

  return NextResponse.json({ ok: true });
}
```

- **GOTCHA**: No auth required — fire-and-forget from client, rate limited by IP.
- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 6: UPDATE `src/app/api/play/[briefId]/route.ts` — add `liked` to GET response

**ADD** import for `auth`, `briefLikes`:
```typescript
import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { briefLikes, generatedFrames, styleBriefs } from "@/lib/db/schema";
```

**REPLACE** the GET function signature from `_req: Request` to `request: NextRequest`.

**ADD** liked check before return:
```typescript
const { data: session } = await auth.getSession();
const liked = session?.user?.id
  ? !!(await db.query.briefLikes.findFirst({
      where: and(
        eq(briefLikes.userId, session.user.id),
        eq(briefLikes.styleBriefId, briefId),
      ),
    }))
  : false;

return NextResponse.json({ brief, frames, liked });
```

- **GOTCHA**: `brief.likeCount` and `brief.playCount` are already on the `brief` row — no extra query needed for counts.
- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 7: CREATE `src/app/api/listener/liked/route.ts`

```typescript
import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { briefLikes } from "@/lib/db/schema";

export async function GET() {
  const { data: session } = await auth.getSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const likes = await db.query.briefLikes.findMany({
    where: eq(briefLikes.userId, session.user.id),
    with: {
      styleBrief: {
        with: { song: true, artist: true },
      },
    },
    orderBy: [desc(briefLikes.createdAt)],
  });

  const briefs = likes
    .map((l) => l.styleBrief)
    .filter((b) => b.published && b.status === "ready");

  return NextResponse.json({ briefs });
}
```

- **GOTCHA**: Filter to only published+ready briefs — a brief may have been unpublished after the user liked it.
- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 8: UPDATE `src/app/(public)/play/[briefId]/page-client.tsx` — like button + counts + view tracking

**UPDATE** the type:
```typescript
type PlayBrief = StyleBrief & { song: Song | null; artist: Artist };
```
(already correct — `StyleBrief` now has `likeCount`/`playCount`)

**ADD** state after existing state declarations:
```typescript
const [liked, setLiked] = useState(false);
const [likeCount, setLikeCount] = useState(0);
```

**UPDATE** the fetch `.then` to also set like state:
```typescript
.then((data) => {
  if (data.brief) {
    setBrief(data.brief);
    setFrames(data.frames ?? []);
    setLiked(data.liked ?? false);
    setLikeCount(data.brief.likeCount ?? 0);
  } else {
    setError("Not found");
  }
})
```

**ADD** view tracking effect after the data-fetch effect:
```typescript
useEffect(() => {
  if (!briefId) return;
  fetch(`/api/play/${briefId}/view`, { method: "POST" }).catch(() => {});
}, [briefId]);
```

**ADD** like handler:
```typescript
const handleLike = async () => {
  const res = await fetch(`/api/play/${briefId}/like`, { method: "POST" });
  if (!res.ok) return;
  const data = await res.json();
  setLiked(data.liked);
  setLikeCount(data.likeCount);
};
```

**ADD** `Heart` import:
```typescript
import { Heart } from "lucide-react";
```

**UPDATE** the return JSX header section to include like button and stats. After the song info `<p>`, add:
```tsx
<div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
  <button
    type="button"
    onClick={handleLike}
    className="flex items-center gap-1.5 hover:text-foreground"
  >
    <Heart
      className={`h-4 w-4 ${liked ? "fill-red-500 text-red-500" : ""}`}
    />
    <span>{likeCount}</span>
  </button>
  <span>{brief.playCount} plays</span>
</div>
```

- **GOTCHA**: View tracking uses fire-and-forget (`catch(() => {})`); don't await or block render.
- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 9: UPDATE `src/app/(public)/discover/page.tsx` — like count badge on cards

The `DiscoverBrief` type already has `likeCount` via `StyleBrief`. Just add the count display inside `CardContent`:

**ADD** after the existing song `<p>` in the card:
```tsx
{brief.likeCount > 0 && (
  <p className="flex items-center gap-1 text-xs text-muted-foreground">
    <Heart className="h-3 w-3" />
    {brief.likeCount}
  </p>
)}
```

**ADD** import:
```typescript
import { Heart } from "lucide-react";
```

- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 10: UPDATE `src/app/(studio)/studio/page.tsx` — play/like stats on cards

The `BriefWithSong` type already extends `StyleBrief` which now has `likeCount`/`playCount`.

**ADD** `Heart` import:
```typescript
import { Heart } from "lucide-react";
```

**ADD** stats line inside `CardContent`, after the status/published badges `<div>`:
```tsx
{(brief.playCount > 0 || brief.likeCount > 0) && (
  <div className="flex items-center gap-3 text-xs text-muted-foreground">
    {brief.playCount > 0 && <span>{brief.playCount} plays</span>}
    {brief.likeCount > 0 && (
      <span className="flex items-center gap-1">
        <Heart className="h-3 w-3" />
        {brief.likeCount}
      </span>
    )}
  </div>
)}
```

- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 11: UPDATE `src/app/(listener)/dashboard/page.tsx` — liked experiences section

Convert to `"use client"` component that fetches liked briefs.

```typescript
"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Artist, Song, StyleBrief } from "@/types";

type LikedBrief = StyleBrief & { song: Song | null; artist: Artist };

export default function DashboardPage() {
  const [liked, setLiked] = useState<LikedBrief[]>([]);
  const [loadingLiked, setLoadingLiked] = useState(true);

  useEffect(() => {
    fetch("/api/listener/liked")
      .then((r) => r.json())
      .then((data) => setLiked(data.briefs ?? []))
      .finally(() => setLoadingLiked(false));
  }, []);

  return (
    <div className="space-y-10">
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <h1 className="text-2xl font-semibold">Welcome to Aura</h1>
        <p className="text-muted-foreground">
          Discover generative visual experiences from your favourite artists.
        </p>
        <Button asChild>
          <Link href="/discover">Browse Experiences</Link>
        </Button>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Liked Experiences</h2>

        {loadingLiked && (
          <p className="text-sm text-muted-foreground">Loading...</p>
        )}

        {!loadingLiked && liked.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No liked experiences yet. Head to{" "}
            <Link href="/discover" className="underline hover:no-underline">
              Discover
            </Link>{" "}
            to find something you love.
          </p>
        )}

        {liked.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {liked.map((brief) => (
              <Link key={brief.id} href={`/play/${brief.id}`}>
                <Card className="cursor-pointer transition-shadow hover:shadow-md">
                  {brief.generatedFrames?.[0]?.frameUrl && (
                    <div className="relative aspect-video w-full overflow-hidden rounded-t-lg bg-muted">
                      <Image
                        src={brief.generatedFrames[0].frameUrl}
                        alt={brief.title || "Experience thumbnail"}
                        fill
                        className="object-cover"
                      />
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle className="line-clamp-1 text-base">
                      {brief.title || "Untitled"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    <p className="text-sm text-muted-foreground">
                      {brief.artist.displayName}
                    </p>
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
        )}
      </div>
    </div>
  );
}
```

- **GOTCHA**: `brief.generatedFrames` won't be present since `GET /api/listener/liked` doesn't include frames. Either remove thumbnail or extend the query to include `generatedFrames: { limit: 1 }`. For simplicity, remove thumbnail reference (or wrap with optional check as shown — it won't render if undefined).
- **GOTCHA**: `(listener)/layout.tsx` may or may not be a client component. Adding `"use client"` to this page is independent and fine.
- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 12: EXTEND `GET /api/listener/liked` — include first frame for thumbnails

In `src/app/api/listener/liked/route.ts`, update the nested `with` to include first frame:

```typescript
with: {
  styleBrief: {
    with: {
      song: true,
      artist: true,
      generatedFrames: {
        limit: 1,
        orderBy: (t, { asc }) => [asc(t.sortOrder)],
      },
    },
  },
},
```

- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 13: FINAL BUILD VALIDATION

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
| Visit `/play/[briefId]` | Play count increments by 1 on page load |
| Click heart on play page | Toggles liked, count updates immediately |
| Re-visit play page | Heart shows filled state for previously liked brief |
| Refresh play page after liking | `liked: true` from server, heart still filled |
| `/api/play/[briefId]/view` called > 10/min from same IP | 429 returned |
| Discover page | Like count badge appears on briefs with likes |
| Studio list | Play/like stats shown on cards with activity |
| Listener dashboard | Liked section shows previously liked briefs |
| Dashboard liked section | Card navigates to `/play/[briefId]` on click |
| Unlike a brief | Count decrements, removed from liked library on next load |

### Edge Cases

- Unlike when `likeCount` is already 0 → `GREATEST(likeCount - 1, 0)` guards floor at 0
- Like a brief then artist unpublishes it → still in liked list (API filters on published, so it won't appear)
- No frames on liked brief → thumbnail absent, card still renders cleanly

---

## VALIDATION COMMANDS

```bash
npm run lint:fix && npm run lint    # zero errors
npx tsc --noEmit                    # zero type errors
npm run build                       # production build succeeds
```

---

## ACCEPTANCE CRITERIA

- [ ] `GET /api/play/[briefId]` response includes `liked: boolean`
- [ ] `POST /api/play/[briefId]/like` toggles like and returns `{ liked, likeCount }`
- [ ] `POST /api/play/[briefId]/view` increments `playCount` on the brief row
- [ ] `GET /api/listener/liked` returns published+ready briefs the user has liked
- [ ] Play page shows heart button, like count, and play count
- [ ] Heart is filled/red when `liked: true`; toggling updates count optimistically
- [ ] View tracking fires once on play page mount (fire-and-forget)
- [ ] Discover cards show like count when `likeCount > 0`
- [ ] Studio list cards show play count + like count when > 0
- [ ] Listener dashboard shows liked experiences grid below welcome
- [ ] `npm run build` exits 0

---

## NOTES

**Denormalized counts**: `likeCount` and `playCount` on `styleBriefs` are denormalized for performance — avoids COUNT joins on every list query. The `briefLikes` table is the source of truth for "did this user like this brief"; the denormalized count is maintained atomically via transactions. Drift is possible only from direct DB manipulation.

**`GREATEST` guard**: When unliking, `GREATEST(likeCount - 1, 0)` prevents the counter going negative from any concurrent race condition.

**View tracking is approximate**: IP-rate-limited to 10/min. Reloads and browser back-navigation may add multiple counts. Suitable for Phase 5; a proper session-deduped approach can come later.

**Confidence Score: 9/10**
