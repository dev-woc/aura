import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { fetchLyrics } from "@/lib/genius";

export async function GET(request: NextRequest) {
	const session = await auth.getSession(request);
	if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { searchParams } = new URL(request.url);
	const title = searchParams.get("title");
	const artist = searchParams.get("artist");

	if (!title || !artist) {
		return NextResponse.json({ error: "title and artist are required" }, { status: 400 });
	}

	const result = await fetchLyrics(title, artist);
	return NextResponse.json(result);
}
