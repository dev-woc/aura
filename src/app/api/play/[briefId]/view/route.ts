import { and, eq, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { styleBriefs } from "@/lib/db/schema";
import { viewRateLimiter } from "@/lib/rate-limit";

export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ briefId: string }> },
) {
	const ip = request.headers.get("x-forwarded-for") ?? "unknown";
	if (!viewRateLimiter.check(ip).success) {
		return NextResponse.json({ ok: false }, { status: 429 });
	}

	const { briefId } = await params;

	const brief = await db.query.styleBriefs.findFirst({
		where: and(eq(styleBriefs.id, briefId), eq(styleBriefs.published, true)),
	});
	if (!brief) return NextResponse.json({ error: "Not found" }, { status: 404 });

	await db
		.update(styleBriefs)
		.set({ playCount: sql`${styleBriefs.playCount} + 1` })
		.where(eq(styleBriefs.id, briefId));

	return NextResponse.json({ ok: true });
}
