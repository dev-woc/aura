"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Artist, Song, StyleBrief } from "@/types";

type ArtistPageData = {
	artist: Artist;
	briefs: Array<StyleBrief & { song: Song | null }>;
	following: boolean;
};

export function ArtistPageClient({ artistId }: { artistId: string }) {
	const [data, setData] = useState<ArtistPageData | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [following, setFollowing] = useState(false);
	const [followerCount, setFollowerCount] = useState(0);

	useEffect(() => {
		if (!artistId) return;
		fetch(`/api/artists/${artistId}`)
			.then((r) => r.json())
			.then((res) => {
				if (res.artist) {
					setData({
						artist: res.artist,
						briefs: res.briefs ?? [],
						following: res.following ?? false,
					});
					setFollowing(res.following ?? false);
					setFollowerCount(res.artist.followCount ?? 0);
				} else {
					setError("Artist not found");
				}
			})
			.catch(() => setError("Failed to load artist"))
			.finally(() => setLoading(false));
	}, [artistId]);

	if (loading) {
		return (
			<div className="flex justify-center py-16">
				<p className="text-muted-foreground">Loading...</p>
			</div>
		);
	}

	if (error || !data) {
		return (
			<div className="flex justify-center py-16">
				<p className="text-destructive">{error || "Artist not found"}</p>
			</div>
		);
	}

	const { artist, briefs } = data;

	const handleFollow = async () => {
		const res = await fetch(`/api/artists/${artistId}/follow`, { method: "POST" });
		if (!res.ok) return;
		const d = await res.json();
		setFollowing(d.following);
		setFollowerCount(d.followerCount);
	};

	return (
		<div className="space-y-8">
			<div className="flex items-start gap-6">
				{artist.avatarUrl ? (
					<div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-full border">
						<Image src={artist.avatarUrl} alt={artist.displayName} fill className="object-cover" />
					</div>
				) : (
					<div className="flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-full border bg-muted text-2xl font-bold text-muted-foreground">
						{artist.displayName?.[0]?.toUpperCase() ?? "?"}
					</div>
				)}
				<div className="space-y-2">
					<h1 className="text-3xl font-bold">{artist.displayName || "Unknown Artist"}</h1>
					{artist.bio && <p className="text-muted-foreground">{artist.bio}</p>}
					<div className="flex items-center gap-3">
						<Button variant={following ? "outline" : "default"} size="sm" onClick={handleFollow}>
							{following ? "Following" : "Follow"}
						</Button>
						{followerCount > 0 && (
							<span className="text-sm text-muted-foreground">
								{followerCount} {followerCount === 1 ? "follower" : "followers"}
							</span>
						)}
					</div>
				</div>
			</div>

			<div className="space-y-4">
				<h2 className="text-xl font-semibold">Visual Experiences</h2>
				{briefs.length === 0 ? (
					<p className="text-muted-foreground">No published experiences yet.</p>
				) : (
					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{briefs.map((brief) => (
							<Link key={brief.id} href={`/play/${brief.id}`}>
								<Card className="cursor-pointer transition-shadow hover:shadow-md">
									<CardHeader>
										<CardTitle className="line-clamp-1 text-base">
											{brief.title || "Untitled"}
										</CardTitle>
									</CardHeader>
									<CardContent>
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
