import { and, asc, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { generatedFrames } from "@/lib/db/schema";

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ songId: string }> },
) {
	const session = await auth.getSession(request);
	if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { songId } = await params;
	const { searchParams } = new URL(request.url);
	const styleBriefId = searchParams.get("styleBriefId");

	const whereClause = styleBriefId
		? and(eq(generatedFrames.songId, songId), eq(generatedFrames.styleBriefId, styleBriefId))
		: eq(generatedFrames.songId, songId);

	const frames = await db.query.generatedFrames.findMany({
		where: whereClause,
		orderBy: [asc(generatedFrames.sortOrder)],
	});

	return NextResponse.json({ frames });
}
