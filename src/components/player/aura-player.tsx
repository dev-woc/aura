"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import type { BeatGrid, GeneratedFrame } from "@/types";

interface AuraPlayerProps {
	frames: GeneratedFrame[];
	beatGrid: BeatGrid | null;
	durationMs: number;
}

const BEATS_PER_FRAME = 8;
const FALLBACK_INTERVAL_MS = 4000;

export function AuraPlayer({ frames, beatGrid, durationMs }: AuraPlayerProps) {
	const [frameIndex, setFrameIndex] = useState(0);
	const [playing, setPlaying] = useState(false);
	const startTimeRef = useRef<number | null>(null);
	const rafRef = useRef<number | null>(null);

	const getFrameForMs = useCallback(
		(currentMs: number): number => {
			if (!beatGrid?.beats.length) {
				return Math.floor(currentMs / FALLBACK_INTERVAL_MS) % frames.length;
			}
			const beats = beatGrid.beats;
			const beatIdx = beats.findIndex((b) => b.startMs > currentMs) - 1;
			return Math.floor(Math.max(0, beatIdx) / BEATS_PER_FRAME) % frames.length;
		},
		[beatGrid, frames.length],
	);

	const tick = useCallback(() => {
		if (!startTimeRef.current) return;
		const elapsed = Date.now() - startTimeRef.current;
		setFrameIndex(getFrameForMs(elapsed % durationMs));
		rafRef.current = requestAnimationFrame(tick);
	}, [durationMs, getFrameForMs]);

	const play = useCallback(() => {
		startTimeRef.current = Date.now();
		setPlaying(true);
		rafRef.current = requestAnimationFrame(tick);
	}, [tick]);

	const pause = useCallback(() => {
		setPlaying(false);
		if (rafRef.current) cancelAnimationFrame(rafRef.current);
	}, []);

	useEffect(() => {
		return () => {
			if (rafRef.current) cancelAnimationFrame(rafRef.current);
		};
	}, []);

	if (!frames.length) return null;

	const current = frames[frameIndex];

	return (
		<div className="space-y-4">
			<div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
				<Image
					key={current.id}
					src={current.frameUrl}
					alt={`Frame ${frameIndex + 1}`}
					fill
					className="object-cover transition-opacity duration-300"
					priority
				/>
			</div>

			<div className="flex items-center justify-between">
				<button
					type="button"
					onClick={playing ? pause : play}
					className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
				>
					{playing ? "Pause" : "Play"}
				</button>
				<p className="text-xs text-muted-foreground">
					{frameIndex + 1} / {frames.length}
					{beatGrid ? ` · ${Math.round(beatGrid.bpm)} BPM` : ""}
				</p>
			</div>

			<div className="flex gap-1 overflow-x-auto pb-1">
				{frames.map((f, i) => (
					<button
						key={f.id}
						type="button"
						onClick={() => setFrameIndex(i)}
						className={`relative h-12 w-20 flex-shrink-0 overflow-hidden rounded ${
							i === frameIndex ? "ring-2 ring-primary" : "opacity-60 hover:opacity-100"
						}`}
					>
						<Image src={f.frameUrl} alt={`Frame ${i + 1}`} fill className="object-cover" />
					</button>
				))}
			</div>
		</div>
	);
}
