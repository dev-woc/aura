import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { getAudioAnalysis, getAudioFeatures } from "@/lib/spotify";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const { data: session } = await auth.getSession();
	if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id } = await params;

	try {
		const [features, analysis] = await Promise.all([getAudioFeatures(id), getAudioAnalysis(id)]);
		return NextResponse.json({ features, analysis });
	} catch (error) {
		console.error("[spotify/analysis]", error);
		return NextResponse.json({ error: "Spotify analysis failed" }, { status: 502 });
	}
}
