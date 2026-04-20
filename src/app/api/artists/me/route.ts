import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { artists } from "@/lib/db/schema";
import { artistProfileSchema } from "@/lib/validations";

export async function GET(_request: NextRequest) {
	const { data: session } = await auth.getSession();
	if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const artist = await db.query.artists.findFirst({
		where: eq(artists.userId, session!.user!.id),
	});
	if (!artist) return NextResponse.json({ error: "Artist profile not found" }, { status: 404 });

	return NextResponse.json({ artist });
}

export async function PATCH(request: NextRequest) {
	const { data: session } = await auth.getSession();
	if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const body = await request.json();
	const parsed = artistProfileSchema.partial().safeParse(body);
	if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

	const [updated] = await db
		.update(artists)
		.set({ ...parsed.data, updatedAt: new Date() })
		.where(eq(artists.userId, session!.user!.id))
		.returning();

	if (!updated) return NextResponse.json({ error: "Artist profile not found" }, { status: 404 });

	return NextResponse.json({ artist: updated });
}
