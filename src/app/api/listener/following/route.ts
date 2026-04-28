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
