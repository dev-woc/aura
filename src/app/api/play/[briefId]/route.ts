import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { briefLikes, generatedFrames, styleBriefs } from "@/lib/db/schema";

export async function GET(
	_request: NextRequest,
	{ params }: { params: Promise<{ briefId: string }> },
) {
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

	const { data: session } = await auth.getSession();
	const liked = session?.user?.id
		? !!(await db.query.briefLikes.findFirst({
				where: and(eq(briefLikes.userId, session.user.id), eq(briefLikes.styleBriefId, briefId)),
			}))
		: false;

	return NextResponse.json({ brief, frames, liked });
}
