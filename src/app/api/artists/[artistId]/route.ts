import { and, desc, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { artistFollows, artists, styleBriefs } from "@/lib/db/schema";

export async function GET(
	_request: NextRequest,
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
}
