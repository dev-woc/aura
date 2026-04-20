import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { usersMeta } from "@/lib/db/schema";

export async function GET(request: NextRequest) {
	const { data: session } = await auth.getSession();
	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	let record = await db.query.usersMeta.findFirst({
		where: eq(usersMeta.userId, session!.user!.id),
	});

	if (!record) {
		const [created] = await db.insert(usersMeta).values({ userId: session!.user!.id }).returning();
		record = created;
	}

	return NextResponse.json({ user: record });
}
