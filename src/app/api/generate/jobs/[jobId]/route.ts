import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { artists, generatedFrames, generationJobs, styleBriefs } from "@/lib/db/schema";

export async function GET(_req: Request, { params }: { params: Promise<{ jobId: string }> }) {
	const { data: session } = await auth.getSession();
	if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { jobId } = await params;

	const job = await db.query.generationJobs.findFirst({ where: eq(generationJobs.id, jobId) });
	if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

	const [brief, artist] = await Promise.all([
		db.query.styleBriefs.findFirst({ where: eq(styleBriefs.id, job.styleBriefId) }),
		db.query.artists.findFirst({ where: eq(artists.userId, session!.user!.id) }),
	]);

	if (!brief || !artist || brief.artistId !== artist.id) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	if (job.status === "done") {
		const frames = await db.query.generatedFrames.findMany({
			where: eq(generatedFrames.styleBriefId, job.styleBriefId),
			orderBy: (f, { asc }) => [asc(f.sortOrder)],
		});
		return NextResponse.json({ job, frames });
	}

	return NextResponse.json({ job, frames: [] });
}
