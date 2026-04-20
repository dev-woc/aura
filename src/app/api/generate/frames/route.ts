import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { artists, generatedFrames, songs, styleBriefs } from "@/lib/db/schema";
import { generateRateLimiter } from "@/lib/rate-limit";
import { generateFrames } from "@/lib/replicate";
import { generateFramesSchema } from "@/lib/validations";
import type { ArtStyle, MoodProfile, NarrativeMap, PaletteColor } from "@/types";

export async function POST(request: NextRequest) {
	const { data: session } = await auth.getSession();
	if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	if (!generateRateLimiter.check(session!.user!.id).success) {
		return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
	}

	const body = await request.json();
	const parsed = generateFramesSchema.safeParse(body);
	if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

	const { songId, styleBriefId, frameCount } = parsed.data;

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

	// Mark as generating
	await db
		.update(styleBriefs)
		.set({ status: "generating" })
		.where(eq(styleBriefs.id, styleBriefId));

	try {
		const narrativeMap = song.narrativeMap as NarrativeMap;
		const moodProfile = song.moodProfile as MoodProfile;

		const frames = await generateFrames({
			segments: narrativeMap.segments,
			mood: moodProfile,
			artStyle: brief.artStyle as ArtStyle,
			palette: brief.palette as PaletteColor[],
			frameCount,
		});

		// Store frames
		if (frames.length > 0) {
			await db.insert(generatedFrames).values(
				frames.map((f) => ({
					styleBriefId,
					songId,
					frameUrl: f.frameUrl,
					timestampSeconds: f.timestampSeconds,
					sortOrder: f.sortOrder,
					prompt: f.prompt,
				})),
			);
		}

		await db.update(styleBriefs).set({ status: "ready" }).where(eq(styleBriefs.id, styleBriefId));

		return NextResponse.json({ frames, count: frames.length });
	} catch (error) {
		console.error("[generate/frames]", error);
		await db.update(styleBriefs).set({ status: "draft" }).where(eq(styleBriefs.id, styleBriefId));
		return NextResponse.json({ error: "Frame generation failed" }, { status: 500 });
	}
}
