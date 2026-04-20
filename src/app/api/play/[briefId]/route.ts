import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generatedFrames, styleBriefs } from "@/lib/db/schema";

export async function GET(_req: Request, { params }: { params: Promise<{ briefId: string }> }) {
	const { briefId } = await params;

	const brief = await db.query.styleBriefs.findFirst({
		where: eq(styleBriefs.id, briefId),
		with: { song: true, artist: true },
	});

	if (!brief?.published) return NextResponse.json({ error: "Not found" }, { status: 404 });

	const frames = await db.query.generatedFrames.findMany({
		where: eq(generatedFrames.styleBriefId, briefId),
		orderBy: (f, { asc }) => [asc(f.sortOrder)],
	});

	return NextResponse.json({ brief, frames });
}
