# Feature: Aura Phase 6 — Artist Follows + Following Feed + Discover Trending

Validate codebase patterns before implementing. Pay close attention to the `inArray` Drizzle import (not yet used in the codebase — it ships with `drizzle-orm`), the atomic follow-toggle transaction (mirrors Phase 5 like-toggle), and the optional auth pattern in a public API route (mirrors `GET /api/play/[briefId]` Phase 5 update).

---

## Feature Description

Phase 6 completes the social graph. Listeners can follow artists they love, building a personalised feed of new releases on their dashboard. A "Trending" toggle on the discover page surfaces the most-engaged experiences (weighted by plays + likes). Artist pages show follower counts, making social proof visible.

## User Stories

**Listener:** As a listener, I want to follow artists so I can easily find their new releases without searching every time.

**Listener:** As a listener, I want a "Following" feed on my dashboard showing the latest from artists I follow so my dashboard is actually useful beyond just liked experiences.

**Listener/Anyone:** As someone browsing discover, I want a "Trending" view sorted by engagement so I can find what's resonating right now, not just what's newest.

**Artist:** As an artist, I want to see my follower count on my public page so I understand my audience size.

## Feature Metadata

**Feature Type**: New Capability  
**Estimated Complexity**: Medium  
**Primary Systems Affected**: DB schema, artist API, listener API, discover API, artist page UI, listener dashboard UI, discover UI  
**Dependencies**: `inArray` from `drizzle-orm` (already installed, not yet used in project)

---

## CONTEXT REFERENCES

### Relevant Codebase Files — READ BEFORE IMPLEMENTING

- `src/lib/db/schema.ts` (full) — Schema to extend; note existing table/index/relations patterns, especially `briefLikes` added in Phase 5 (exact mirror for `artistFollows`)
- `src/types/index.ts` (full) — Add `ArtistFollow` type; `Artist` will auto-gain `followCount` via `InferSelectModel`
- `src/app/api/artists/[artistId]/route.ts` (lines 1–26) — Public GET; add optional session check + `following` state (mirror Phase 5 pattern from `GET /api/play/[briefId]`)
- `src/app/api/play/[briefId]/route.ts` — Pattern for optional auth in public route (`session?.user?.id ? checkDB : false`)
- `src/app/api/play/[briefId]/like/route.ts` — Exact transaction pattern to mirror for follow toggle
- `src/app/(public)/artist/[artistId]/page-client.tsx` (full) — Add follow button + follower count below artist name
- `src/app/(listener)/dashboard/page.tsx` (full) — Add "Following" section alongside existing "Liked" section
- `src/app/(public)/discover/page.tsx` (full) — Add Recent/Trending toggle; extend fetch URL with `sort` param
- `src/app/api/discover/route.ts` — Add `sort` query param; JS-sort by weighted score for trending
- `src/lib/rate-limit.ts` — Pattern for creating rate limiters (not needed for follow, but reference)

### New Files to Create

```
src/app/api/artists/[artistId]/follow/route.ts   — POST: toggle follow (auth required)
src/app/api/listener/following/route.ts          — GET: briefs feed from followed artists
```

### Files to Modify

```
src/lib/db/schema.ts                              — Add followCount to artists; add artistFollows table + relations
src/types/index.ts                                — Add ArtistFollow type
src/app/api/artists/[artistId]/route.ts           — Add following state + followerCount to GET response
src/app/api/discover/route.ts                     — Add sort=trending support
src/app/(public)/artist/[artistId]/page-client.tsx — Follow button + follower count
src/app/(listener)/dashboard/page.tsx             — Add "Following" feed section
src/app/(public)/discover/page.tsx                — Add Recent/Trending toggle
```

### Patterns to Follow

**Atomic follow toggle (mirror `src/app/api/play/[briefId]/like/route.ts`):**
```typescript
const following = await db.transaction(async (tx) => {
  const existing = await tx.query.artistFollows.findFirst({
    where: and(eq(artistFollows.followerId, followerId), eq(artistFollows.artistId, artistId)),
  });
  if (existing) {
    await tx.delete(artistFollows).where(eq(artistFollows.id, existing.id));
    await tx
      .update(artists)
      .set({ followCount: sql`GREATEST(${artists.followCount} - 1, 0)` })
      .where(eq(artists.id, artistId));
    return false;
  }
  await tx.insert(artistFollows).values({ followerId, artistId });
  await tx
    .update(artists)
    .set({ followCount: sql`${artists.followCount} + 1` })
    .where(eq(artists.id, artistId));
  return true;
});
```

**Optional auth in public route (mirror `src/app/api/play/[briefId]/route.ts` Phase 5 pattern):**
```typescript
const { data: session } = await auth.getSession();
const following = session?.user?.id
  ? !!(await db.query.artistFollows.findFirst({
      where: and(eq(artistFollows.followerId, session.user.id), eq(artistFollows.artistId, artistId)),
    }))
  : false;
```

**`inArray` for feed query (Drizzle, not yet used in project):**
```typescript
import { and, desc, eq, inArray } from "drizzle-orm";

const artistIds = follows.map((f) => f.artistId);
const briefs = await db.query.styleBriefs.findMany({
  where: and(
    inArray(styleBriefs.artistId, artistIds),
    eq(styleBriefs.published, true),
    eq(styleBriefs.status, "ready"),
  ),
  with: { song: true, artist: true },
  orderBy: [desc(styleBriefs.publishedAt)],
  limit: 30,
});
```

**Trending sort (in-JS, weighted score):**
```typescript
const trending = [...published].sort(
  (a, b) => (b.playCount + b.likeCount * 2) - (a.playCount + a.likeCount * 2),
);
```

**Follow button state pattern (mirrors like button in `page-client.tsx`):**
```typescript
const [following, setFollowing] = useState(false);
const [followerCount, setFollowerCount] = useState(0);

// In data fetch effect:
setFollowing(res.following ?? false);
setFollowerCount(res.artist.followCount ?? 0);

// Handler:
const handleFollow = async () => {
  const res = await fetch(`/api/artists/${artistId}/follow`, { method: "POST" });
  if (!res.ok) return;
  const data = await res.json();
  setFollowing(data.following);
  setFollowerCount(data.followerCount);
};
```

---

## STEP-BY-STEP TASKS

---

### TASK 1: UPDATE `src/lib/db/schema.ts` — add followCount + artistFollows table

**ADD** to `artists` table (after `verified`):
```typescript
followCount: integer("follow_count").notNull().default(0),
```

**CREATE** new table after `briefLikes`:
```typescript
export const artistFollows = pgTable(
  "artist_follows",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    followerId: text("follower_id").notNull(),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_artist_follows_follower_artist").on(table.followerId, table.artistId),
    index("idx_artist_follows_artist_id").on(table.artistId),
  ],
);
```

**UPDATE** `artistsRelations` — add `artistFollows: many(artistFollows)`:
```typescript
export const artistsRelations = relations(artists, ({ many }) => ({
  styleBriefs: many(styleBriefs),
  artistFollows: many(artistFollows),
}));
```

**ADD** new relations export after `briefLikesRelations`:
```typescript
export const artistFollowsRelations = relations(artistFollows, ({ one }) => ({
  artist: one(artists, {
    fields: [artistFollows.artistId],
    references: [artists.id],
  }),
}));
```

- **GOTCHA**: `integer` and `uniqueIndex` are already imported — no new imports needed in schema.ts
- **GOTCHA**: `artistFollows` table export must appear before `artistFollowsRelations`
- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 2: UPDATE `src/types/index.ts` — add ArtistFollow type

**ADD** `artistFollows` to the import:
```typescript
import type {
  artistFollows,
  artists,
  briefLikes,
  generatedFrames,
  generationJobs,
  songs,
  styleBriefs,
  usersMeta,
} from "@/lib/db/schema";
```

**ADD** after `BriefLike`:
```typescript
export type ArtistFollow = InferSelectModel<typeof artistFollows>;
```

- **GOTCHA**: `Artist` type auto-gains `followCount` via `InferSelectModel` — no manual change needed
- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 3: CREATE `src/app/api/artists/[artistId]/follow/route.ts`

```typescript
import { and, eq, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { artistFollows, artists } from "@/lib/db/schema";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ artistId: string }> },
) {
  const { data: session } = await auth.getSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { artistId } = await params;
  const followerId = session.user.id;

  const artist = await db.query.artists.findFirst({
    where: eq(artists.id, artistId),
  });
  if (!artist) return NextResponse.json({ error: "Artist not found" }, { status: 404 });

  // Prevent self-follow
  if (artist.userId === followerId) {
    return NextResponse.json({ error: "Cannot follow yourself" }, { status: 400 });
  }

  const following = await db.transaction(async (tx) => {
    const existing = await tx.query.artistFollows.findFirst({
      where: and(
        eq(artistFollows.followerId, followerId),
        eq(artistFollows.artistId, artistId),
      ),
    });
    if (existing) {
      await tx.delete(artistFollows).where(eq(artistFollows.id, existing.id));
      await tx
        .update(artists)
        .set({ followCount: sql`GREATEST(${artists.followCount} - 1, 0)` })
        .where(eq(artists.id, artistId));
      return false;
    }
    await tx.insert(artistFollows).values({ followerId, artistId });
    await tx
      .update(artists)
      .set({ followCount: sql`${artists.followCount} + 1` })
      .where(eq(artists.id, artistId));
    return true;
  });

  const updated = await db.query.artists.findFirst({ where: eq(artists.id, artistId) });

  return NextResponse.json({ following, followerCount: updated?.followCount ?? 0 });
}
```

- **GOTCHA**: Self-follow guard checks `artist.userId` (Neon Auth userId text) against `session.user.id` — these are the same type (text)
- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 4: UPDATE `src/app/api/artists/[artistId]/route.ts` — add following state

**ADD** imports: `NextRequest` type, `auth`, `artistFollows`:
```typescript
import { and, desc, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { artistFollows, artists, styleBriefs } from "@/lib/db/schema";
```

**CHANGE** function signature from `_request: Request` to `request: NextRequest`:
```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ artistId: string }> },
) {
```

**ADD** optional session check before the return statement:
```typescript
const { data: session } = await auth.getSession();
const following = session?.user?.id
  ? !!(await db.query.artistFollows.findFirst({
      where: and(
        eq(artistFollows.followerId, session.user.id),
        eq(artistFollows.artistId, artistId),
      ),
    }))
  : false;

return NextResponse.json({ artist, briefs, following });
```

- **GOTCHA**: `artist.followCount` is already on the row — no extra query needed for the count
- **GOTCHA**: The `request` param is named `request` (not `_request`) because it's now used implicitly via `auth.getSession()` (which reads cookies from the request context)
- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 5: CREATE `src/app/api/listener/following/route.ts`

```typescript
import { and, desc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { artistFollows, styleBriefs } from "@/lib/db/schema";

export async function GET() {
  const { data: session } = await auth.getSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const follows = await db.query.artistFollows.findMany({
    where: eq(artistFollows.followerId, session.user.id),
  });

  if (follows.length === 0) return NextResponse.json({ briefs: [] });

  const artistIds = follows.map((f) => f.artistId);

  const briefs = await db.query.styleBriefs.findMany({
    where: and(
      inArray(styleBriefs.artistId, artistIds),
      eq(styleBriefs.published, true),
      eq(styleBriefs.status, "ready"),
    ),
    with: { song: true, artist: true },
    orderBy: [desc(styleBriefs.publishedAt)],
    limit: 30,
  });

  return NextResponse.json({ briefs });
}
```

- **GOTCHA**: `inArray` from `drizzle-orm` — not yet used elsewhere in the project but it's available; just import it
- **GOTCHA**: Early return with empty array when user follows nobody avoids an `inArray` call with an empty list (which would throw in some DB drivers)
- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 6: UPDATE `src/app/api/discover/route.ts` — add sort=trending

**REPLACE** full file content:
```typescript
import { and, desc, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { styleBriefs } from "@/lib/db/schema";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const sort = url.searchParams.get("sort") ?? "recent";

  const published = await db.query.styleBriefs.findMany({
    where: and(eq(styleBriefs.published, true), eq(styleBriefs.status, "ready")),
    with: { song: true, artist: true },
    orderBy: [desc(styleBriefs.publishedAt)],
    limit: 50,
  });

  const searched = q
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

  const results =
    sort === "trending"
      ? [...searched].sort(
          (a, b) => b.playCount + b.likeCount * 2 - (a.playCount + a.likeCount * 2),
        )
      : searched;

  return NextResponse.json({ briefs: results });
}
```

- **GOTCHA**: Always fetch sorted by `publishedAt` first, then re-sort in JS for trending — keeps the code simple and consistent with the existing in-JS search filter pattern
- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 7: UPDATE `src/app/(public)/artist/[artistId]/page-client.tsx` — follow button + follower count

**ADD** `Button` import:
```typescript
import { Button } from "@/components/ui/button";
```

**UPDATE** `ArtistPageData` type to include `following`:
```typescript
type ArtistPageData = {
  artist: Artist;
  briefs: Array<StyleBrief & { song: Song | null }>;
  following: boolean;
};
```

**ADD** state after `const [data, setData]`:
```typescript
const [following, setFollowing] = useState(false);
const [followerCount, setFollowerCount] = useState(0);
```

**UPDATE** the fetch `.then` to populate follow state:
```typescript
.then((res) => {
  if (res.artist) {
    setData({ artist: res.artist, briefs: res.briefs ?? [], following: res.following ?? false });
    setFollowing(res.following ?? false);
    setFollowerCount(res.artist.followCount ?? 0);
  } else {
    setError("Artist not found");
  }
})
```

**ADD** follow handler before the return:
```typescript
const handleFollow = async () => {
  const res = await fetch(`/api/artists/${artistId}/follow`, { method: "POST" });
  if (!res.ok) return;
  const d = await res.json();
  setFollowing(d.following);
  setFollowerCount(d.followerCount);
};
```

**UPDATE** artist header JSX — replace `<div className="space-y-1">` block:
```tsx
<div className="space-y-2">
  <h1 className="text-3xl font-bold">{artist.displayName || "Unknown Artist"}</h1>
  {artist.bio && <p className="text-muted-foreground">{artist.bio}</p>}
  <div className="flex items-center gap-3">
    <Button
      variant={following ? "outline" : "default"}
      size="sm"
      onClick={handleFollow}
    >
      {following ? "Following" : "Follow"}
    </Button>
    {followerCount > 0 && (
      <span className="text-sm text-muted-foreground">
        {followerCount} {followerCount === 1 ? "follower" : "followers"}
      </span>
    )}
  </div>
</div>
```

- **GOTCHA**: `useState` needs to be imported — it's already imported in the existing file
- **GOTCHA**: `Button` is not in the existing artist page client — must add it to imports
- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 8: UPDATE `src/app/(listener)/dashboard/page.tsx` — add Following section

**ADD** `following` feed state alongside existing `liked` state:
```typescript
const [following, setFollowing] = useState<LikedBrief[]>([]);
const [loadingFollowing, setLoadingFollowing] = useState(true);
```

**ADD** fetch effect for following feed (after the liked effect):
```typescript
useEffect(() => {
  fetch("/api/listener/following")
    .then((r) => r.json())
    .then((data) => setFollowing(data.briefs ?? []))
    .finally(() => setLoadingFollowing(false));
}, []);
```

**ADD** "Following" section to JSX, between the welcome block and the "Liked Experiences" block:
```tsx
<div className="space-y-4">
  <h2 className="text-xl font-semibold">Following</h2>

  {loadingFollowing && <p className="text-sm text-muted-foreground">Loading...</p>}

  {!loadingFollowing && following.length === 0 && (
    <p className="text-sm text-muted-foreground">
      Follow artists on their profile pages to see their latest releases here.
    </p>
  )}

  {following.length > 0 && (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {following.map((brief) => (
        <Link key={brief.id} href={`/play/${brief.id}`}>
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle className="line-clamp-1 text-base">
                {brief.title || "Untitled"}
              </CardTitle>
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
  )}
</div>
```

- **GOTCHA**: `LikedBrief` type (already defined in this file as `StyleBrief & { song: Song | null; artist: Artist; generatedFrames?: GeneratedFrame[] }`) is reused for following feed — fine since `/api/listener/following` returns the same shape
- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 9: UPDATE `src/app/(public)/discover/page.tsx` — Recent/Trending toggle

**ADD** sort state after existing state declarations:
```typescript
const [sort, setSort] = useState<"recent" | "trending">("recent");
```

**UPDATE** the fetch `useEffect` dependency array and URL to include `sort`:
```typescript
useEffect(() => {
  setLoading(true);
  const params = new URLSearchParams();
  if (debouncedQuery) params.set("q", debouncedQuery);
  if (sort === "trending") params.set("sort", "trending");
  const url = params.size > 0 ? `/api/discover?${params}` : "/api/discover";
  fetch(url)
    .then((r) => r.json())
    .then((data) => setBriefs(data.briefs ?? []))
    .finally(() => setLoading(false));
}, [debouncedQuery, sort]);
```

**UPDATE** the header JSX — add sort toggle buttons next to the search input:
```tsx
<div className="flex items-center justify-between gap-4">
  <h1 className="text-3xl font-bold">Discover</h1>
  <div className="flex items-center gap-2">
    <div className="flex rounded-md border">
      <button
        type="button"
        onClick={() => setSort("recent")}
        className={`px-3 py-1.5 text-sm rounded-l-md transition-colors ${
          sort === "recent"
            ? "bg-foreground text-background"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Recent
      </button>
      <button
        type="button"
        onClick={() => setSort("trending")}
        className={`px-3 py-1.5 text-sm rounded-r-md transition-colors ${
          sort === "trending"
            ? "bg-foreground text-background"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Trending
      </button>
    </div>
    <Input
      type="search"
      placeholder="Search by title, artist, or song..."
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      className="max-w-xs"
    />
  </div>
</div>
```

- **GOTCHA**: When `sort` changes, `debouncedQuery` doesn't change, so the dependency array `[debouncedQuery, sort]` correctly triggers a re-fetch when either changes
- **GOTCHA**: Both `q` and `sort` can be combined — the API handles both params independently
- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 10: FINAL BUILD VALIDATION

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
| Visit `/artist/[id]` page | Follow button shows; follower count visible if > 0 |
| Click Follow | Button text toggles "Follow" ↔ "Following"; count updates |
| Re-visit artist page | Button still shows "Following" (state loaded from API) |
| Follow artist then go to dashboard | Artist's briefs appear in "Following" section |
| Unfollow artist | Their briefs disappear from feed on next dashboard load |
| Dashboard with no followed artists | "Follow artists..." empty state message |
| Discover → Trending | Cards re-ordered by `playCount + likeCount * 2` |
| Discover → search + Trending | Both filters apply simultaneously |
| `POST /api/artists/[id]/follow` as artist visiting own page | 400 "Cannot follow yourself" |
| `GET /api/listener/following` with 0 follows | `{ briefs: [] }` (no DB error) |

### Edge Cases

- `inArray` with empty `artistIds` → guarded by early return `if (follows.length === 0)` before the query
- Artist with `followCount = 0` tries to unfollow → `GREATEST(followCount - 1, 0)` guards at 0
- Trending sort when all briefs have 0 plays/likes → stable sort, same order as recent
- Artist is deleted → `ON DELETE CASCADE` removes `artistFollows` rows automatically

---

## VALIDATION COMMANDS

```bash
npm run lint:fix && npm run lint    # zero errors
npx tsc --noEmit                    # zero type errors
npm run build                       # production build succeeds
```

---

## ACCEPTANCE CRITERIA

- [ ] `artistFollows` table exists in schema with unique constraint on (followerId, artistId)
- [ ] `artists.followCount` column exists and is maintained atomically
- [ ] `POST /api/artists/[artistId]/follow` toggles follow and returns `{ following, followerCount }`
- [ ] Self-follow returns 400
- [ ] `GET /api/artists/[artistId]` returns `following: boolean` in response
- [ ] `GET /api/listener/following` returns published+ready briefs from followed artists
- [ ] Artist page shows Follow/Following button + follower count
- [ ] Listener dashboard shows "Following" section with feed from followed artists
- [ ] Discover page has Recent/Trending toggle; Trending sorts by engagement score
- [ ] Search and sort params combine correctly in discover API
- [ ] `npm run build` exits 0

---

## NOTES

**Denormalized followCount**: Same pattern as `likeCount`/`playCount` from Phase 5 — `artistFollows` is source of truth, `artists.followCount` is maintained atomically via transactions. `GREATEST()` guard prevents negative counts.

**`inArray` early-return guard**: Drizzle's `inArray` with an empty array generates `WHERE artist_id IN ()` which is invalid SQL in Postgres (and other drivers). The early return `if (follows.length === 0) return NextResponse.json({ briefs: [] })` prevents this.

**Trending is approximate**: Weighted score `playCount + likeCount * 2` is computed in JS over the 50-item published set. No time window — an old viral brief stays at the top indefinitely. Acceptable for Phase 6; a time-windowed decay function can be added later.

**Self-follow prevention**: Only guards at API level. The follow button is shown to all authenticated users including the artist themselves. The 400 response from the API is silently ignored by the client (`if (!res.ok) return`). A future polish item: hide the button when `session.user.id === artist.userId`.

**Confidence Score: 9/10**
