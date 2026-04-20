import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { artists, styleBriefs } from "@/lib/db/schema";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
	const { data: session } = await auth.getSession();
	if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id } = await params;

	const artist = await db.query.artists.findFirst({
		where: eq(artists.userId, session!.user!.id),
	});
	if (!artist) return NextResponse.json({ error: "Artist not found" }, { status: 404 });

	const brief = await db.query.styleBriefs.findFirst({ where: eq(styleBriefs.id, id) });
	if (!brief || brief.artistId !== artist.id) {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}
	if (brief.status !== "ready") {
		return NextResponse.json({ error: "Brief must be ready before publishing" }, { status: 422 });
	}

	const nowPublished = !brief.published;
	const [updated] = await db
		.update(styleBriefs)
		.set({
			published: nowPublished,
			publishedAt: nowPublished ? new Date() : null,
			updatedAt: new Date(),
		})
		.where(eq(styleBriefs.id, id))
		.returning();

	return NextResponse.json({ styleBrief: updated });
}
