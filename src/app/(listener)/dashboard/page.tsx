"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Artist, GeneratedFrame, Song, StyleBrief } from "@/types";

type LikedBrief = StyleBrief & {
	song: Song | null;
	artist: Artist;
	generatedFrames?: GeneratedFrame[];
};

export default function DashboardPage() {
	const [liked, setLiked] = useState<LikedBrief[]>([]);
	const [loadingLiked, setLoadingLiked] = useState(true);
	const [following, setFollowing] = useState<LikedBrief[]>([]);
	const [loadingFollowing, setLoadingFollowing] = useState(true);

	useEffect(() => {
		fetch("/api/listener/liked")
			.then((r) => r.json())
			.then((data) => setLiked(data.briefs ?? []))
			.finally(() => setLoadingLiked(false));
	}, []);

	useEffect(() => {
		fetch("/api/listener/following")
			.then((r) => r.json())
			.then((data) => setFollowing(data.briefs ?? []))
			.finally(() => setLoadingFollowing(false));
	}, []);

	return (
		<div className="space-y-10">
			<div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
				<h1 className="text-2xl font-semibold">Welcome to Aura</h1>
				<p className="text-muted-foreground">
					Discover generative visual experiences from your favourite artists.
				</p>
				<Button asChild>
					<Link href="/discover">Browse Experiences</Link>
				</Button>
			</div>

			<div className="space-y-4">
				<h2 className="text-xl font-semibold">Following</h2>

				{loadingFollowing && <p className="text-sm text-muted-foreground">Loading...</p>}

				{!loadingFollowing && following.length === 0 && (
					<p className="text-sm text-muted-foreground">
						Follow artists on their profile pages to see their latest releases here.
					</p>
				)}

				{following.length > 0 && (
					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{following.map((brief) => (
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
									</CardContent>
								</Card>
							</Link>
						))}
					</div>
				)}
			</div>

			<div className="space-y-4">
				<h2 className="text-xl font-semibold">Liked Experiences</h2>

				{loadingLiked && <p className="text-sm text-muted-foreground">Loading...</p>}

				{!loadingLiked && liked.length === 0 && (
					<p className="text-sm text-muted-foreground">
						No liked experiences yet. Head to{" "}
						<Link href="/discover" className="underline hover:no-underline">
							Discover
						</Link>{" "}
						to find something you love.
					</p>
				)}

				{liked.length > 0 && (
					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{liked.map((brief) => (
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
				)}
			</div>
		</div>
	);
}
