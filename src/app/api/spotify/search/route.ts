import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { apiRateLimiter } from "@/lib/rate-limit";
import { searchTracks } from "@/lib/spotify";
import { spotifySearchSchema } from "@/lib/validations";

export async function GET(request: NextRequest) {
	const session = await auth.getSession(request);
	if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const ip = request.headers.get("x-forwarded-for") ?? "unknown";
	if (!apiRateLimiter.check(ip).success) {
		return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
	}

	const { searchParams } = new URL(request.url);
	const parsed = spotifySearchSchema.safeParse({ q: searchParams.get("q") });
	if (!parsed.success) return NextResponse.json({ error: "Missing query" }, { status: 400 });

	try {
		const tracks = await searchTracks(parsed.data.q);
		return NextResponse.json({ tracks });
	} catch (error) {
		console.error("[spotify/search]", error);
		return NextResponse.json({ error: "Spotify search failed" }, { status: 502 });
	}
}
