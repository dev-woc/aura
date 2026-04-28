import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { artists, styleBriefs } from "@/lib/db/schema";
import { apiRateLimiter } from "@/lib/rate-limit";
import { styleBriefSchema } from "@/lib/validations";

export async function GET(request: NextRequest) {
	const { data: session } = await auth.getSession();
	if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const artist = await db.query.artists.findFirst({
		where: eq(artists.userId, session!.user!.id),
	});
	if (!artist) return NextResponse.json({ error: "Artist profile not found" }, { status: 404 });

	const briefs = await db.query.styleBriefs.findMany({
		where: eq(styleBriefs.artistId, artist.id),
		with: {
			song: true,
			generatedFrames: {
				limit: 1,
				orderBy: (t, { asc }) => [asc(t.sortOrder)],
			},
		},
		orderBy: (t, { desc }) => [desc(t.createdAt)],
	});

	return NextResponse.json({ styleBriefs: briefs });
}

export async function POST(request: NextRequest) {
	const { data: session } = await auth.getSession();
	if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const ip = request.headers.get("x-forwarded-for") ?? "unknown";
	if (!apiRateLimiter.check(ip).success) {
		return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
	}

	const artist = await db.query.artists.findFirst({
		where: eq(artists.userId, session!.user!.id),
	});
	if (!artist) return NextResponse.json({ error: "Artist profile not found" }, { status: 404 });

	const body = await request.json();
	const parsed = styleBriefSchema.safeParse(body);
	if (!parsed.success) {
		return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
	}

	const [brief] = await db
		.insert(styleBriefs)
		.values({ artistId: artist.id, ...parsed.data })
		.returning();

	return NextResponse.json({ styleBrief: brief }, { status: 201 });
}
