import { put } from "@vercel/blob";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { uploadRateLimiter } from "@/lib/rate-limit";

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function POST(request: NextRequest) {
	const session = await auth.getSession(request);
	if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	if (!uploadRateLimiter.check(session.userId).success) {
		return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
	}

	const formData = await request.formData();
	const file = formData.get("file") as File | null;

	if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
	if (!ALLOWED_TYPES.includes(file.type)) {
		return NextResponse.json({ error: "File must be JPEG, PNG, or WebP" }, { status: 400 });
	}
	if (file.size > MAX_SIZE_BYTES) {
		return NextResponse.json({ error: "File must be under 5MB" }, { status: 400 });
	}

	try {
		const filename = `aura/reference-images/${session.userId}/${Date.now()}-${file.name}`;
		const blob = await put(filename, file, { access: "public" });
		return NextResponse.json({ url: blob.url });
	} catch (error) {
		console.error("[upload/reference-image]", error);
		return NextResponse.json({ error: "Upload failed" }, { status: 500 });
	}
}
