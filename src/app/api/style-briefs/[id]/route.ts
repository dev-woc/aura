import { and, desc, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { artists, generationJobs, styleBriefs } from "@/lib/db/schema";
import { styleBriefSchema } from "@/lib/validations";

async function getArtistForSession(userId: string) {
	return db.query.artists.findFirst({ where: eq(artists.userId, userId) });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const { data: session } = await auth.getSession();
	if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id } = await params;
	const artist = await getArtistForSession(session!.user!.id);
	if (!artist) return NextResponse.json({ error: "Artist not found" }, { status: 404 });

	const brief = await db.query.styleBriefs.findFirst({
		where: and(eq(styleBriefs.id, id), eq(styleBriefs.artistId, artist.id)),
		with: { song: true, generatedFrames: { orderBy: (t, { asc }) => [asc(t.sortOrder)] } },
	});
	if (!brief) return NextResponse.json({ error: "Not found" }, { status: 404 });

	const latestJob = await db.query.generationJobs.findFirst({
		where: eq(generationJobs.styleBriefId, id),
		orderBy: [desc(generationJobs.createdAt)],
	});

	return NextResponse.json({ styleBrief: brief, latestJob: latestJob ?? null });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const { data: session } = await auth.getSession();
	if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id } = await params;
	const artist = await getArtistForSession(session!.user!.id);
	if (!artist) return NextResponse.json({ error: "Artist not found" }, { status: 404 });

	const body = await request.json();
	const parsed = styleBriefSchema.partial().safeParse(body);
	if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

	const [updated] = await db
		.update(styleBriefs)
		.set({ ...parsed.data, updatedAt: new Date() })
		.where(and(eq(styleBriefs.id, id), eq(styleBriefs.artistId, artist.id)))
		.returning();

	if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
	return NextResponse.json({ styleBrief: updated });
}

export async function DELETE(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { data: session } = await auth.getSession();
	if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id } = await params;
	const artist = await getArtistForSession(session!.user!.id);
	if (!artist) return NextResponse.json({ error: "Artist not found" }, { status: 404 });

	await db
		.delete(styleBriefs)
		.where(and(eq(styleBriefs.id, id), eq(styleBriefs.artistId, artist.id)));

	return NextResponse.json({ success: true });
}
