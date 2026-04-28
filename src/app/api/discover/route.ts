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
