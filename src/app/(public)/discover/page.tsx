"use client";

import { Heart } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Artist, Song, StyleBrief } from "@/types";

type DiscoverBrief = StyleBrief & { song: Song | null; artist: Artist };

export default function DiscoverPage() {
	const [briefs, setBriefs] = useState<DiscoverBrief[]>([]);
	const [loading, setLoading] = useState(true);
	const [query, setQuery] = useState("");
	const [debouncedQuery, setDebouncedQuery] = useState("");
	const [sort, setSort] = useState<"recent" | "trending">("recent");

	useEffect(() => {
		const timer = setTimeout(() => setDebouncedQuery(query), 300);
		return () => clearTimeout(timer);
	}, [query]);

	useEffect(() => {
		setLoading(true);
		const params = new URLSearchParams();
		if (debouncedQuery) params.set("q", debouncedQuery);
		if (sort === "trending") params.set("sort", "trending");
		const url = params.size > 0 ? `/api/discover?${params}` : "/api/discover";
		fetch(url)
			.then((r) => r.json())
			.then((data) => setBriefs(data.briefs ?? []))
			.finally(() => setLoading(false));
	}, [debouncedQuery, sort]);

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between gap-4">
				<h1 className="text-3xl font-bold">Discover</h1>
				<div className="flex items-center gap-2">
					<div className="flex rounded-md border">
						<button
							type="button"
							onClick={() => setSort("recent")}
							className={`rounded-l-md px-3 py-1.5 text-sm transition-colors ${
								sort === "recent"
									? "bg-foreground text-background"
									: "text-muted-foreground hover:text-foreground"
							}`}
						>
							Recent
						</button>
						<button
							type="button"
							onClick={() => setSort("trending")}
							className={`rounded-r-md px-3 py-1.5 text-sm transition-colors ${
								sort === "trending"
									? "bg-foreground text-background"
									: "text-muted-foreground hover:text-foreground"
							}`}
						>
							Trending
						</button>
					</div>
					<Input
						type="search"
						placeholder="Search by title, artist, or song..."
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						className="max-w-xs"
					/>
				</div>
			</div>

			{loading && (
				<div className="flex justify-center py-8">
					<p className="text-muted-foreground">Loading...</p>
				</div>
			)}

			{!loading && briefs.length === 0 && (
				<p className="py-16 text-center text-muted-foreground">
					{debouncedQuery ? `No results for "${debouncedQuery}"` : "No experiences published yet."}
				</p>
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
								<Link
									href={`/artist/${brief.artist.id}`}
									className="text-sm text-muted-foreground hover:underline"
									onClick={(e) => e.stopPropagation()}
								>
									{brief.artist.displayName}
								</Link>
								{brief.song && (
									<p className="text-xs text-muted-foreground">
										{brief.song.title} — {brief.song.artistName}
									</p>
								)}
								{brief.likeCount > 0 && (
									<p className="flex items-center gap-1 text-xs text-muted-foreground">
										<Heart className="h-3 w-3" />
										{brief.likeCount}
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
