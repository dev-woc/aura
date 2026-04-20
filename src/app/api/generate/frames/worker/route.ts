import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generatedFrames, generationJobs, songs, styleBriefs } from "@/lib/db/schema";
import { generateFrames } from "@/lib/replicate";
import type { ArtStyle, MoodProfile, NarrativeMap, PaletteColor } from "@/types";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
	const secret = request.headers.get("x-worker-secret");
	if (secret !== process.env.WORKER_SECRET) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const { jobId } = await request.json();

	const job = await db.query.generationJobs.findFirst({ where: eq(generationJobs.id, jobId) });
	if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

	await db
		.update(generationJobs)
		.set({ status: "running", startedAt: new Date() })
		.where(eq(generationJobs.id, jobId));

	try {
		const brief = await db.query.styleBriefs.findFirst({
			where: eq(styleBriefs.id, job.styleBriefId),
		});
		const song = brief?.songId
			? await db.query.songs.findFirst({ where: eq(songs.id, brief.songId) })
			: null;

		if (!brief || !song?.narrativeMap || !song.moodProfile) {
			await db
				.update(generationJobs)
				.set({ status: "failed", error: "Missing brief or song analysis", completedAt: new Date() })
				.where(eq(generationJobs.id, jobId));
			return NextResponse.json({ error: "Missing data" }, { status: 422 });
		}

		const frames = await generateFrames({
			segments: (song.narrativeMap as NarrativeMap).segments,
			mood: song.moodProfile as MoodProfile,
			artStyle: brief.artStyle as ArtStyle,
			palette: brief.palette as PaletteColor[],
		});

		if (frames.length > 0) {
			await db.insert(generatedFrames).values(
				frames.map((f) => ({
					styleBriefId: brief.id,
					songId: song.id,
					frameUrl: f.frameUrl,
					timestampSeconds: f.timestampSeconds,
					sortOrder: f.sortOrder,
					prompt: f.prompt,
				})),
			);
		}

		await db
			.update(styleBriefs)
			.set({ status: "ready" })
			.where(eq(styleBriefs.id, brief.id));
		await db
			.update(generationJobs)
			.set({ status: "done", completedAt: new Date() })
			.where(eq(generationJobs.id, jobId));

		return NextResponse.json({ ok: true, frameCount: frames.length });
	} catch (error) {
		console.error("[generate/frames/worker]", error);
		await db
			.update(generationJobs)
			.set({ status: "failed", error: String(error), completedAt: new Date() })
			.where(eq(generationJobs.id, jobId));
		await db
			.update(styleBriefs)
			.set({ status: "draft" })
			.where(eq(styleBriefs.id, job.styleBriefId));
		return NextResponse.json({ error: "Generation failed" }, { status: 500 });
	}
}
