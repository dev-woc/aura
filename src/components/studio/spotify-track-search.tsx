"use client";

import { Loader2, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import type { SpotifyTrack } from "@/types";

interface SpotifyTrackSearchProps {
	onSelect: (track: SpotifyTrack) => void;
}

function formatDuration(ms: number): string {
	const totalSeconds = Math.floor(ms / 1000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function SpotifyTrackSearch({ onSelect }: SpotifyTrackSearchProps) {
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<SpotifyTrack[]>([]);
	const [loading, setLoading] = useState(false);
	const [searched, setSearched] = useState(false);
	const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

	const search = useCallback(async (q: string) => {
		if (!q.trim()) {
			setResults([]);
			setSearched(false);
			return;
		}
		setLoading(true);
		setSearched(true);
		try {
			const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(q)}`);
			if (!res.ok) throw new Error("Search failed");
			const data = await res.json();
			setResults(data.tracks ?? []);
		} catch {
			setResults([]);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		clearTimeout(debounceRef.current);
		if (!query.trim()) {
			setResults([]);
			setSearched(false);
			setLoading(false);
			return;
		}
		debounceRef.current = setTimeout(() => {
			search(query);
		}, 300);
		return () => clearTimeout(debounceRef.current);
	}, [query, search]);

	const handleSelect = (track: SpotifyTrack) => {
		onSelect(track);
		setQuery("");
		setResults([]);
		setSearched(false);
	};

	return (
		<div className="relative space-y-2">
			<div className="relative">
				<Input
					placeholder="Search Spotify tracks..."
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					aria-label="Search Spotify tracks"
				/>
				{loading && (
					<Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
				)}
				{!loading && query && (
					<button
						type="button"
						onClick={() => {
							setQuery("");
							setResults([]);
							setSearched(false);
						}}
						className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
						aria-label="Clear search"
					>
						<X className="h-4 w-4" />
					</button>
				)}
			</div>

			{searched && !loading && results.length === 0 && (
				<p className="text-sm text-muted-foreground">No results found.</p>
			)}

			{results.length > 0 && (
				<ul className="absolute z-10 w-full rounded-md border bg-popover shadow-md">
					{results.map((track) => (
						<li key={track.id}>
							<button
								type="button"
								onClick={() => handleSelect(track)}
								className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-accent focus:bg-accent focus:outline-none"
							>
								{track.albumArtUrl ? (
									<Image
										src={track.albumArtUrl}
										alt={track.albumName}
										width={40}
										height={40}
										className="h-10 w-10 flex-shrink-0 rounded object-cover"
									/>
								) : (
									<div className="h-10 w-10 flex-shrink-0 rounded bg-muted" />
								)}
								<div className="min-w-0 flex-1">
									<p className="truncate font-medium text-sm">{track.name}</p>
									<p className="truncate text-xs text-muted-foreground">
										{track.artistName} · {formatDuration(track.durationMs)}
									</p>
								</div>
							</button>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
