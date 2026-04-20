"use client";

import { Pause, Play } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface PreviewPlayerProps {
	frames: Array<{ frameUrl: string; timestampSeconds: number; sortOrder: number }>;
	intervalMs?: number;
}

export function PreviewPlayer({ frames, intervalMs = 4000 }: PreviewPlayerProps) {
	const [currentIndex, setCurrentIndex] = useState(0);
	const [playing, setPlaying] = useState(true);
	const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

	const advance = useCallback(() => {
		setCurrentIndex((i) => (i + 1) % frames.length);
	}, [frames.length]);

	useEffect(() => {
		if (playing && frames.length > 1) {
			intervalRef.current = setInterval(advance, intervalMs);
		}
		return () => clearInterval(intervalRef.current);
	}, [playing, frames.length, advance, intervalMs]);

	if (!frames.length) {
		return (
			<div className="flex aspect-video items-center justify-center rounded-lg bg-muted text-muted-foreground">
				No frames generated yet
			</div>
		);
	}

	const current = frames[currentIndex];

	return (
		<div className="space-y-3">
			<div className="relative aspect-video overflow-hidden rounded-lg bg-black">
				{frames.map((frame, i) => (
					<Image
						key={frame.frameUrl}
						src={frame.frameUrl}
						alt={`Frame ${i + 1}`}
						fill
						unoptimized
						className={`object-cover transition-opacity duration-1000 ${
							i === currentIndex ? "opacity-100" : "opacity-0"
						}`}
					/>
				))}
				<div className="absolute bottom-3 left-3 flex items-center gap-2">
					<Button
						size="sm"
						variant="secondary"
						onClick={() => setPlaying((p) => !p)}
						className="h-8 w-8 p-0"
					>
						{playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
					</Button>
					<span className="text-xs text-white/80 tabular-nums">
						{currentIndex + 1} / {frames.length} · {current.timestampSeconds}s
					</span>
				</div>
			</div>
			<div className="flex gap-1 overflow-x-auto pb-1">
				{frames.map((frame, i) => (
					<button
						key={frame.frameUrl}
						type="button"
						onClick={() => {
							setCurrentIndex(i);
							setPlaying(false);
						}}
						className={`h-12 w-20 flex-shrink-0 overflow-hidden rounded border-2 transition-colors ${
							i === currentIndex ? "border-primary" : "border-transparent"
						}`}
					>
						<Image src={frame.frameUrl} alt="" fill unoptimized className="object-cover" />
					</button>
				))}
			</div>
		</div>
	);
}
