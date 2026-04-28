import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import Replicate from "replicate";
import { auth } from "@/lib/auth/server";
import { analyzeLyrics, analyzeMoodFromTags } from "@/lib/claude";
import { db } from "@/lib/db";
import { artists, songs, styleBriefs } from "@/lib/db/schema";
import { generateRateLimiter } from "@/lib/rate-limit";
import { generateAnalyzeUploadSchema } from "@/lib/validations";
import type { BeatGrid } from "@/types";

export const maxDuration = 120;

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

function generateSyntheticBeatGrid(bpm: number, durationMs: number): BeatGrid {
	const beatIntervalMs = (60 / bpm) * 1000;
	const beats: BeatGrid["beats"] = [];
	for (let t = 0; t < durationMs; t += beatIntervalMs) {
		beats.push({ startMs: Math.round(t), confidence: 1.0 });
	}
	return {
		bpm,
		beats,
		sections: [{ startMs: 0, endMs: durationMs, label: "Main" }],
	};
}

export async function POST(request: NextRequest) {
	const { data: session } = await auth.getSession();
	if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	if (!generateRateLimiter.check(session.user.id).success) {
		return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
	}

	const body = await request.json();
	const parsed = generateAnalyzeUploadSchema.safeParse(body);
	if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

	const { styleBriefId, audioFileUrl, title, artistName, durationMs, bpm, genreTags, vibeTags } =
		parsed.data;
	let { lyrics } = parsed.data;

	const artist = await db.query.artists.findFirst({
		where: eq(artists.userId, session.user.id),
	});
	if (!artist) return NextResponse.json({ error: "Artist not found" }, { status: 404 });

	const brief = await db.query.styleBriefs.findFirst({
		where: eq(styleBriefs.id, styleBriefId),
	});
	if (!brief || brief.artistId !== artist.id) {
		return NextResponse.json({ error: "Style brief not found" }, { status: 404 });
	}

	try {
		if (!lyrics) {
			const result = (await replicate.run("openai/whisper", {
				input: { audio: audioFileUrl, model: "small" },
			})) as { text: string };
			lyrics = result.text;
		}

		if (!lyrics?.trim()) {
			return NextResponse.json(
				{ error: "Could not transcribe audio — please provide lyrics manually" },
				{ status: 422 },
			);
		}

		const beatGrid = generateSyntheticBeatGrid(bpm ?? 120, durationMs);

		const narrativeMap = await analyzeLyrics({
			lyrics,
			trackTitle: title,
			artistName,
			artStyle: brief.artStyle as { descriptors: string[]; freeText: string },
			palette: brief.palette as Array<{ hex: string; label: string }>,
		});

		const moodProfile = await analyzeMoodFromTags({
			genreTags,
			vibeTags,
			lyricsSentimentHint: narrativeMap.dominantThemes.join(", "),
		});

		const existingSong = brief.songId
			? await db.query.songs.findFirst({ where: eq(songs.id, brief.songId) })
			: null;

		let song: typeof existingSong;
		if (existingSong && !existingSong.spotifyTrackId) {
			const [updated] = await db
				.update(songs)
				.set({
					title,
					artistName,
					audioFileUrl,
					durationMs,
					lyricsCache: lyrics,
					narrativeMap,
					moodProfile,
					beatGrid,
					analyzedAt: new Date(),
					updatedAt: new Date(),
				})
				.where(eq(songs.id, existingSong.id))
				.returning();
			song = updated;
		} else {
			const [created] = await db
				.insert(songs)
				.values({
					title,
					artistName,
					audioFileUrl,
					durationMs,
					lyricsCache: lyrics,
					narrativeMap,
					moodProfile,
					beatGrid,
					analyzedAt: new Date(),
				})
				.returning();
			song = created;
		}

		await db.update(styleBriefs).set({ songId: song.id }).where(eq(styleBriefs.id, styleBriefId));

		return NextResponse.json({ song, narrativeMap, moodProfile });
	} catch (error) {
		console.error("[generate/analyze-upload]", error);
		return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
	}
}
