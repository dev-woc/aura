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
	const body = (await request.json()) as HandleUploadBody;

	try {
		const jsonResponse = await handleUpload({
			body,
			request,
			onBeforeGenerateToken: async () => {
				const { data: session } = await auth.getSession();
				if (!session?.user?.id) throw new Error("Unauthorized");
				if (!uploadRateLimiter.check(session.user.id).success) throw new Error("Rate limit exceeded");
				return {
					allowedContentTypes: ALLOWED_TYPES,
					maximumSizeInBytes: MAX_SIZE_BYTES,
					tokenPayload: session.user.id,
				};
			},
			onUploadCompleted: async () => {},
		});
		return NextResponse.json(jsonResponse);
	} catch (error) {
		return NextResponse.json({ error: (error as Error).message }, { status: 400 });
	}
}
