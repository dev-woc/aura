import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { styleBriefs } from "@/lib/db/schema";

export async function GET() {
	const published = await db.query.styleBriefs.findMany({
		where: and(eq(styleBriefs.published, true), eq(styleBriefs.status, "ready")),
		with: { song: true, artist: true },
		orderBy: [desc(styleBriefs.publishedAt)],
		limit: 50,
	});

	return NextResponse.json({ briefs: published });
}
