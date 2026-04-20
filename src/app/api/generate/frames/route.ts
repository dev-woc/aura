import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { artists, generationJobs, songs, styleBriefs } from "@/lib/db/schema";
import { generateRateLimiter } from "@/lib/rate-limit";
import { generateFramesSchema } from "@/lib/validations";

export async function POST(request: NextRequest) {
	const { data: session } = await auth.getSession();
	if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	if (!generateRateLimiter.check(session!.user!.id).success) {
		return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
	}

	const body = await request.json();
	const parsed = generateFramesSchema.safeParse(body);
	if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

	const { songId, styleBriefId } = parsed.data;

	const artist = await db.query.artists.findFirst({
		where: eq(artists.userId, session!.user!.id),
	});
	if (!artist) return NextResponse.json({ error: "Artist not found" }, { status: 404 });

	const [brief, song] = await Promise.all([
		db.query.styleBriefs.findFirst({ where: eq(styleBriefs.id, styleBriefId) }),
		db.query.songs.findFirst({ where: eq(songs.id, songId) }),
	]);

	if (!brief || brief.artistId !== artist.id) {
		return NextResponse.json({ error: "Style brief not found" }, { status: 404 });
	}
	if (!song?.narrativeMap || !song.moodProfile) {
		return NextResponse.json(
			{ error: "Song must be analyzed first — call /api/generate/analyze" },
			{ status: 422 },
		);
	}

	const [job] = await db.insert(generationJobs).values({ styleBriefId }).returning();

	await db
		.update(styleBriefs)
		.set({ status: "generating" })
		.where(eq(styleBriefs.id, styleBriefId));

	const baseUrl =
		process.env.NEXT_PUBLIC_APP_URL ??
		(process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
	const workerUrl = `${baseUrl}/api/generate/frames/worker`;

	fetch(workerUrl, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"x-worker-secret": process.env.WORKER_SECRET ?? "",
		},
		body: JSON.stringify({ jobId: job.id }),
	}).catch((err) => console.error("[generate/frames] worker dispatch failed:", err));

	return NextResponse.json({ jobId: job.id, status: "pending" });
}
