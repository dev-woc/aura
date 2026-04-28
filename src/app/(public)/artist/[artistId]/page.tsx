import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { artists } from "@/lib/db/schema";
import { ArtistPageClient } from "./page-client";

export async function generateMetadata({
	params,
}: {
	params: Promise<{ artistId: string }>;
}): Promise<Metadata> {
	const { artistId } = await params;
	const artist = await db.query.artists.findFirst({
		where: eq(artists.id, artistId),
	});
	if (!artist) return { title: "Artist — Aura" };

	const title = artist.displayName || "Unknown Artist";
	const description = artist.bio || `Visual experiences by ${title} on Aura`;

	return {
		title: `${title} — Aura`,
		description,
		openGraph: {
			title,
			description,
			...(artist.avatarUrl ? { images: [{ url: artist.avatarUrl }] } : {}),
		},
		twitter: {
			card: "summary_large_image",
			title,
			description,
			...(artist.avatarUrl ? { images: [artist.avatarUrl] } : {}),
		},
	};
}

export default async function ArtistPage({ params }: { params: Promise<{ artistId: string }> }) {
	const { artistId } = await params;
	return <ArtistPageClient artistId={artistId} />;
}
