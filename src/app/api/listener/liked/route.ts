import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { briefLikes } from "@/lib/db/schema";

export async function GET() {
	const { data: session } = await auth.getSession();
	if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const likes = await db.query.briefLikes.findMany({
		where: eq(briefLikes.userId, session.user.id),
		with: {
			styleBrief: {
				with: {
					song: true,
					artist: true,
					generatedFrames: {
						limit: 1,
						orderBy: (t, { asc }) => [asc(t.sortOrder)],
					},
				},
			},
		},
		orderBy: [desc(briefLikes.createdAt)],
	});

	const briefs = likes.map((l) => l.styleBrief).filter((b) => b.published && b.status === "ready");

	return NextResponse.json({ briefs });
}
