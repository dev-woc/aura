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
