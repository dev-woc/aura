import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { artists, generatedFrames, styleBriefs } from "@/lib/db/schema";

export async function DELETE(
	_request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { data: session } = await auth.getSession();
	if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id } = await params;

	const artist = await db.query.artists.findFirst({
		where: eq(artists.userId, session!.user!.id),
	});
	if (!artist) return NextResponse.json({ error: "Artist not found" }, { status: 404 });

	const brief = await db.query.styleBriefs.findFirst({
		where: and(eq(styleBriefs.id, id), eq(styleBriefs.artistId, artist.id)),
	});
	if (!brief) return NextResponse.json({ error: "Not found" }, { status: 404 });

	await db.delete(generatedFrames).where(eq(generatedFrames.styleBriefId, id));
	await db
		.update(styleBriefs)
		.set({ status: "draft", published: false, updatedAt: new Date() })
		.where(eq(styleBriefs.id, id));

	return NextResponse.json({ success: true });
}
