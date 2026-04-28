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

	if (artist.userId === followerId) {
		return NextResponse.json({ error: "Cannot follow yourself" }, { status: 400 });
	}

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

	const updated = await db.query.artists.findFirst({ where: eq(artists.id, artistId) });

	return NextResponse.json({ following, followerCount: updated?.followCount ?? 0 });
}
