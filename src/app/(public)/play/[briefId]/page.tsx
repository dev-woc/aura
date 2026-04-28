import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { styleBriefs } from "@/lib/db/schema";
import { PlayPageClient } from "./page-client";

export async function generateMetadata({
	params,
}: {
	params: Promise<{ briefId: string }>;
}): Promise<Metadata> {
	const { briefId } = await params;
	const brief = await db.query.styleBriefs.findFirst({
		where: eq(styleBriefs.id, briefId),
		with: {
			song: true,
			generatedFrames: { limit: 1, orderBy: (t, { asc }) => [asc(t.sortOrder)] },
		},
	});
	if (!brief) return { title: "Aura" };

	const title = brief.title || "Untitled";
	const description = brief.song
		? `${brief.song.title} — ${brief.song.artistName}`
		: "A visual music experience on Aura";
	const imageUrl = brief.generatedFrames?.[0]?.frameUrl ?? null;

	return {
		title: `${title} — Aura`,
		description,
		openGraph: {
			title,
			description,
			...(imageUrl ? { images: [{ url: imageUrl }] } : {}),
		},
		twitter: {
			card: "summary_large_image",
			title,
			description,
			...(imageUrl ? { images: [imageUrl] } : {}),
		},
	};
}

export default async function PlayPage({ params }: { params: Promise<{ briefId: string }> }) {
	const { briefId } = await params;
	return <PlayPageClient briefId={briefId} />;
}
