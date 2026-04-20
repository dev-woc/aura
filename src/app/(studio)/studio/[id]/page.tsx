"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PreviewPlayer } from "@/components/studio/preview-player";
import { StyleBriefForm } from "@/components/studio/style-brief-form";
import type { GeneratedFrame, Song, StyleBrief } from "@/types";

type BriefWithSong = StyleBrief & { song?: Song | null; generatedFrames?: GeneratedFrame[] };

export default function StyleBriefPage() {
	const { id } = useParams<{ id: string }>();
	const [brief, setBrief] = useState<BriefWithSong | null>(null);
	const [frames, setFrames] = useState<GeneratedFrame[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	useEffect(() => {
		if (!id) return;
		fetch(`/api/style-briefs/${id}`)
			.then((r) => r.json())
			.then((data) => {
				if (data.styleBrief) {
					setBrief(data.styleBrief);
					if (data.styleBrief.generatedFrames?.length) {
						setFrames(data.styleBrief.generatedFrames);
					}
				} else {
					setError("Style brief not found");
				}
			})
			.catch(() => setError("Failed to load style brief"))
			.finally(() => setLoading(false));
	}, [id]);

	const handleSave = (updated: StyleBrief) => {
		setBrief((prev) => (prev ? { ...prev, ...updated } : null));
	};

	const handleFramesGenerated = (newFrames: GeneratedFrame[]) => {
		setFrames(newFrames);
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
				<p className="text-destructive">{error || "Style brief not found"}</p>
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-2xl space-y-8">
			<h1 className="text-2xl font-bold">{brief.title || "Untitled Brief"}</h1>
			<StyleBriefForm
				initialBrief={brief}
				onSave={handleSave}
				onFramesGenerated={handleFramesGenerated}
			/>
			{frames.length > 0 && (
				<div className="space-y-3">
					<h2 className="text-lg font-semibold">Preview</h2>
					<PreviewPlayer frames={frames} />
				</div>
			)}
		</div>
	);
}
