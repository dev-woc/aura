import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { uploadRateLimiter } from "@/lib/rate-limit";

const MAX_SIZE_BYTES = 50 * 1024 * 1024;
const ALLOWED_TYPES = [
	"audio/mpeg",
	"audio/wav",
	"audio/ogg",
	"audio/aac",
	"audio/mp4",
	"audio/x-m4a",
];

export async function POST(request: NextRequest): Promise<NextResponse> {
	const { data: session } = await auth.getSession();
	if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	if (!uploadRateLimiter.check(session.user.id).success) {
		return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
	}

	const userId = session.user.id;
	const body = (await request.json()) as HandleUploadBody;

	try {
		const jsonResponse = await handleUpload({
			body,
			request,
			onBeforeGenerateToken: async () => ({
				allowedContentTypes: ALLOWED_TYPES,
				maximumSizeInBytes: MAX_SIZE_BYTES,
				tokenPayload: userId,
			}),
			onUploadCompleted: async () => {},
		});
		return NextResponse.json(jsonResponse);
	} catch (error) {
		const message = (error as Error).message;
		console.error("[upload/audio]", message);
		return NextResponse.json({ error: message }, { status: 400 });
	}
}
