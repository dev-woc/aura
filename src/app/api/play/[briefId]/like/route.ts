import { and, eq, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { briefLikes, styleBriefs } from "@/lib/db/schema";

export async function POST(
	_request: NextRequest,
	{ params }: { params: Promise<{ briefId: string }> },
) {
	const { data: session } = await auth.getSession();
	if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { briefId } = await params;
	const userId = session.user.id;

	const brief = await db.query.styleBriefs.findFirst({
		where: and(eq(styleBriefs.id, briefId), eq(styleBriefs.published, true)),
	});
	if (!brief) return NextResponse.json({ error: "Not found" }, { status: 404 });

	const liked = await db.transaction(async (tx) => {
		const existing = await tx.query.briefLikes.findFirst({
			where: and(eq(briefLikes.userId, userId), eq(briefLikes.styleBriefId, briefId)),
		});
		if (existing) {
			await tx.delete(briefLikes).where(eq(briefLikes.id, existing.id));
			await tx
				.update(styleBriefs)
				.set({ likeCount: sql`GREATEST(${styleBriefs.likeCount} - 1, 0)` })
				.where(eq(styleBriefs.id, briefId));
			return false;
		}
		await tx.insert(briefLikes).values({ userId, styleBriefId: briefId });
		await tx
			.update(styleBriefs)
			.set({ likeCount: sql`${styleBriefs.likeCount} + 1` })
			.where(eq(styleBriefs.id, briefId));
		return true;
	});

	const updated = await db.query.styleBriefs.findFirst({
		where: eq(styleBriefs.id, briefId),
	});

	return NextResponse.json({ liked, likeCount: updated?.likeCount ?? 0 });
}
