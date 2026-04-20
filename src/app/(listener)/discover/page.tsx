"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Artist, Song, StyleBrief } from "@/types";

type DiscoverBrief = StyleBrief & { song: Song | null; artist: Artist };

export default function DiscoverPage() {
	const [briefs, setBriefs] = useState<DiscoverBrief[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		fetch("/api/discover")
			.then((r) => r.json())
			.then((data) => setBriefs(data.briefs ?? []))
			.finally(() => setLoading(false));
	}, []);

	if (loading) {
		return (
			<div className="flex justify-center py-16">
				<p className="text-muted-foreground">Loading...</p>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<h1 className="text-3xl font-bold">Discover</h1>

			{briefs.length === 0 && (
				<p className="py-16 text-center text-muted-foreground">No experiences published yet.</p>
			)}

			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{briefs.map((brief) => (
					<Link key={brief.id} href={`/play/${brief.id}`}>
						<Card className="cursor-pointer transition-shadow hover:shadow-md">
							<CardHeader>
								<CardTitle className="line-clamp-1 text-base">
									{brief.title || "Untitled"}
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-1">
								<p className="text-sm text-muted-foreground">{brief.artist.displayName}</p>
								{brief.song && (
									<p className="text-xs text-muted-foreground">
										{brief.song.title} — {brief.song.artistName}
									</p>
								)}
							</CardContent>
						</Card>
					</Link>
				))}
			</div>
		</div>
	);
}
