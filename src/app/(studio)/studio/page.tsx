"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Song, StyleBrief } from "@/types";

type BriefWithSong = StyleBrief & { song?: Song | null };

const statusColors: Record<string, string> = {
	draft: "bg-gray-100 text-gray-700",
	generating: "bg-yellow-100 text-yellow-700",
	ready: "bg-green-100 text-green-700",
};

const publishedBadge = "bg-blue-100 text-blue-700";

export default function StudioPage() {
	const [briefs, setBriefs] = useState<BriefWithSong[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	useEffect(() => {
		fetch("/api/style-briefs")
			.then((r) => r.json())
			.then((data) => {
				if (data.styleBriefs) setBriefs(data.styleBriefs);
				else setError("Failed to load style briefs");
			})
			.catch(() => setError("Failed to load style briefs"))
			.finally(() => setLoading(false));
	}, []);

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<h1 className="text-3xl font-bold">Aura Studio</h1>
				<Button asChild>
					<Link href="/studio/new">New Style Brief</Link>
				</Button>
			</div>

			{loading && (
				<div className="flex justify-center py-12">
					<p className="text-muted-foreground">Loading...</p>
				</div>
			)}

			{error && <p className="text-sm text-destructive">{error}</p>}

			{!loading && !error && briefs.length === 0 && (
				<div className="flex flex-col items-center gap-4 py-16 text-center">
					<p className="text-muted-foreground">No style briefs yet. Create your first one.</p>
					<Button asChild>
						<Link href="/studio/new">New Style Brief</Link>
					</Button>
				</div>
			)}

			{!loading && briefs.length > 0 && (
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{briefs.map((brief) => (
						<Link key={brief.id} href={`/studio/${brief.id}`}>
							<Card className="h-full cursor-pointer transition-shadow hover:shadow-md">
								<CardHeader>
									<CardTitle className="line-clamp-1 text-base">
										{brief.title || "Untitled"}
									</CardTitle>
								</CardHeader>
								<CardContent className="space-y-2">
									<p className="text-sm text-muted-foreground">
										{brief.song?.title
											? `${brief.song.title} — ${brief.song.artistName}`
											: "No song linked"}
									</p>
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-1.5">
											<span
												className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
													statusColors[brief.status] ?? statusColors.draft
												}`}
											>
												{brief.status}
											</span>
											{brief.published && (
												<span
													className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${publishedBadge}`}
												>
													published
												</span>
											)}
										</div>
										<span className="text-xs text-muted-foreground">
											{new Date(brief.createdAt).toLocaleDateString()}
										</span>
									</div>
								</CardContent>
							</Card>
						</Link>
					))}
				</div>
			)}
		</div>
	);
}
