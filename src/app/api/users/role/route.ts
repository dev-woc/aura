import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { artists, usersMeta } from "@/lib/db/schema";
import { userRoleSchema } from "@/lib/validations";

export async function POST(request: NextRequest) {
	const { data: session } = await auth.getSession();
	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const body = await request.json();
	const parsed = userRoleSchema.safeParse(body.role);
	if (!parsed.success) {
		return NextResponse.json({ error: "Invalid role" }, { status: 400 });
	}

	const role = parsed.data;

	await db
		.insert(usersMeta)
		.values({ userId: session!.user!.id, role, onboardingComplete: true })
		.onConflictDoUpdate({
			target: usersMeta.userId,
			set: { role, onboardingComplete: true, updatedAt: new Date() },
		});

	if (role === "artist") {
		await db
			.insert(artists)
			.values({ userId: session!.user!.id, displayName: session!.user?.name ?? "" })
			.onConflictDoNothing();
	}

	return NextResponse.json({ success: true, role });
}
