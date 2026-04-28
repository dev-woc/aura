"use client";

import { Heart } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AuraPlayer } from "@/components/player/aura-player";
import type { Artist, BeatGrid, GeneratedFrame, Song, StyleBrief } from "@/types";

type PlayBrief = StyleBrief & { song: Song | null; artist: Artist };

export function PlayPageClient({ briefId }: { briefId: string }) {
	const [brief, setBrief] = useState<PlayBrief | null>(null);
	const [frames, setFrames] = useState<GeneratedFrame[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [liked, setLiked] = useState(false);
	const [likeCount, setLikeCount] = useState(0);

	useEffect(() => {
		fetch(`/api/play/${briefId}`)
			.then((r) => r.json())
			.then((data) => {
				if (data.brief) {
					setBrief(data.brief);
					setFrames(data.frames ?? []);
					setLiked(data.liked ?? false);
					setLikeCount(data.brief.likeCount ?? 0);
				} else {
					setError("Not found");
				}
			})
			.catch(() => setError("Failed to load"))
			.finally(() => setLoading(false));
	}, [briefId]);

	useEffect(() => {
		if (!briefId) return;
		fetch(`/api/play/${briefId}/view`, { method: "POST" }).catch(() => {});
	}, [briefId]);

	const handleLike = async () => {
		const res = await fetch(`/api/play/${briefId}/like`, { method: "POST" });
		if (!res.ok) return;
		const data = await res.json();
		setLiked(data.liked);
		setLikeCount(data.likeCount);
	};

	if (loading) {
		return (
			<div className="flex justify-center py-16">
				<p className="text-muted-foreground">Loading...</p>
			</div>
		);
	}

	if (error || !brief) {
		return (
			<div className="flex justify-center py-16">
				<p className="text-destructive">{error || "Not found"}</p>
			</div>
		);
	}

	const beatGrid = (brief.song?.beatGrid as BeatGrid | null) ?? null;
	const durationMs = brief.song?.durationMs ?? 240_000;

	return (
		<div className="mx-auto max-w-3xl space-y-6">
			<div>
				<h1 className="text-2xl font-bold">{brief.title || "Untitled"}</h1>
				<Link href={`/artist/${brief.artist.id}`} className="text-muted-foreground hover:underline">
					{brief.artist.displayName}
				</Link>
				{brief.song && (
					<p className="mt-1 text-sm text-muted-foreground">
						{brief.song.title} — {brief.song.artistName}
					</p>
				)}
				<div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
					<button
						type="button"
						onClick={handleLike}
						className="flex items-center gap-1.5 hover:text-foreground"
					>
						<Heart className={`h-4 w-4 ${liked ? "fill-red-500 text-red-500" : ""}`} />
						<span>{likeCount}</span>
					</button>
					<span>{brief.playCount} plays</span>
				</div>
			</div>
			<AuraPlayer frames={frames} beatGrid={beatGrid} durationMs={durationMs} />
		</div>
	);
}
