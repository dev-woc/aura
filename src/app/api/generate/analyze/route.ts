import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { analyzeLyrics, analyzeMood } from "@/lib/claude";
import { db } from "@/lib/db";
import { artists, songs, styleBriefs } from "@/lib/db/schema";
import { fetchLyrics } from "@/lib/genius";
import { generateRateLimiter } from "@/lib/rate-limit";
import { getAudioFeatures } from "@/lib/spotify";
import { generateAnalyzeSchema } from "@/lib/validations";

export async function POST(request: NextRequest) {
	const { data: session } = await auth.getSession();
	if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	if (!generateRateLimiter.check(session!.user!.id).success) {
		return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
	}

	const body = await request.json();
	const parsed = generateAnalyzeSchema.safeParse(body);
	if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

	const { spotifyTrackId, styleBriefId } = parsed.data;

	// Verify ownership
	const artist = await db.query.artists.findFirst({
		where: eq(artists.userId, session!.user!.id),
	});
	if (!artist) return NextResponse.json({ error: "Artist not found" }, { status: 404 });

	const brief = await db.query.styleBriefs.findFirst({
		where: eq(styleBriefs.id, styleBriefId),
		with: { song: true },
	});
	if (!brief || brief.artistId !== artist.id) {
		return NextResponse.json({ error: "Style brief not found" }, { status: 404 });
	}

	try {
		// 1. Get or create song record
		let song = await db.query.songs.findFirst({
			where: eq(songs.spotifyTrackId, spotifyTrackId),
		});

		if (!song) {
			// We need track metadata — get it from Spotify features call (includes name via search results)
			// For now create a minimal record; title/artist should be passed from the client
			const trackTitle = body.trackTitle as string;
			const artistName = body.artistName as string;

			const [created] = await db
				.insert(songs)
				.values({
					spotifyTrackId,
					title: trackTitle,
					artistName,
				})
				.returning();
			song = created;
		}

		// 2. Fetch lyrics
		const { geniusId, lyrics } = await fetchLyrics(song.title, song.artistName);
		if (geniusId && !song.geniusId) {
			await db
				.update(songs)
				.set({ geniusId: String(geniusId) })
				.where(eq(songs.id, song.id));
		}

		if (!lyrics) {
			return NextResponse.json({ error: "Could not fetch lyrics for this track" }, { status: 422 });
		}

		// 3. Spotify audio features
		const audioFeatures = await getAudioFeatures(spotifyTrackId);

		// 4. Claude lyric analysis
		const narrativeMap = await analyzeLyrics({
			lyrics,
			trackTitle: song.title,
			artistName: song.artistName,
			artStyle: brief.artStyle as { descriptors: string[]; freeText: string },
			palette: brief.palette as Array<{ hex: string; label: string }>,
		});

		// 5. Claude mood analysis
		const moodProfile = await analyzeMood({
			audioFeatures,
			lyricsSentimentHint: narrativeMap.dominantThemes.join(", "),
		});

		// 6. Store results
		const [updatedSong] = await db
			.update(songs)
			.set({
				lyricsCache: lyrics,
				narrativeMap,
				moodProfile,
				analyzedAt: new Date(),
				updatedAt: new Date(),
			})
			.where(eq(songs.id, song.id))
			.returning();

		// 7. Link song to style brief
		await db.update(styleBriefs).set({ songId: song.id }).where(eq(styleBriefs.id, styleBriefId));

		return NextResponse.json({ song: updatedSong, narrativeMap, moodProfile });
	} catch (error) {
		console.error("[generate/analyze]", error);
		return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
	}
}
