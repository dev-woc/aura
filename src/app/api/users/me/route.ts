import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { usersMeta } from "@/lib/db/schema";

export async function GET(request: NextRequest) {
	const session = await auth.getSession(request);
	if (!session?.userId) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	let record = await db.query.usersMeta.findFirst({
		where: eq(usersMeta.userId, session.userId),
	});

	if (!record) {
		const [created] = await db.insert(usersMeta).values({ userId: session.userId }).returning();
		record = created;
	}

	return NextResponse.json({ user: record });
}
