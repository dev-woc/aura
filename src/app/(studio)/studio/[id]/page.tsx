"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PreviewPlayer } from "@/components/studio/preview-player";
import { StyleBriefForm } from "@/components/studio/style-brief-form";
import { Button } from "@/components/ui/button";
import type { GeneratedFrame, Song, StyleBrief } from "@/types";

type BriefWithSong = StyleBrief & { song?: Song | null; generatedFrames?: GeneratedFrame[] };

export default function StyleBriefPage() {
	const { id } = useParams<{ id: string }>();
	const [brief, setBrief] = useState<BriefWithSong | null>(null);
	const [frames, setFrames] = useState<GeneratedFrame[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	const [jobId, setJobId] = useState<string | null>(null);
	const [jobStatus, setJobStatus] = useState<string | null>(null);
	const [publishing, setPublishing] = useState(false);

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

	// Poll job status while generation is in progress
	useEffect(() => {
		if (!jobId || jobStatus === "done" || jobStatus === "failed") return;
		const interval = setInterval(async () => {
			const res = await fetch(`/api/generate/jobs/${jobId}`);
			const data = await res.json();
			const status = data.job?.status ?? null;
			setJobStatus(status);
			if (status === "done" && data.frames?.length) {
				setFrames(data.frames);
				setBrief((prev) => (prev ? { ...prev, status: "ready" } : null));
				setJobId(null);
			}
		}, 3000);
		return () => clearInterval(interval);
	}, [jobId, jobStatus]);

	const handleSave = (updated: StyleBrief) => {
		setBrief((prev) => (prev ? { ...prev, ...updated } : null));
	};

	const handleGenerationStarted = (newJobId: string) => {
		setJobId(newJobId);
		setJobStatus("pending");
		setBrief((prev) => (prev ? { ...prev, status: "generating" } : null));
	};

	const handlePublish = async () => {
		if (!brief) return;
		setPublishing(true);
		try {
			const res = await fetch(`/api/style-briefs/${brief.id}/publish`, { method: "POST" });
			const data = await res.json();
			if (data.styleBrief) setBrief((prev) => (prev ? { ...prev, ...data.styleBrief } : null));
		} finally {
			setPublishing(false);
		}
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

	const isGenerating = jobId && (jobStatus === "pending" || jobStatus === "running");

	return (
		<div className="mx-auto max-w-2xl space-y-8">
			<div className="flex items-center justify-between gap-4">
				<h1 className="text-2xl font-bold">{brief.title || "Untitled Brief"}</h1>
				{brief.status === "ready" && (
					<Button
						variant={brief.published ? "outline" : "default"}
						size="sm"
						onClick={handlePublish}
						disabled={publishing}
					>
						{publishing ? "..." : brief.published ? "Unpublish" : "Publish"}
					</Button>
				)}
			</div>

			{isGenerating && (
				<div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
					Generating frames… this takes 2–5 minutes. You can leave this page and come back.
				</div>
			)}

			<StyleBriefForm
				initialBrief={brief}
				onSave={handleSave}
				onFramesGenerated={handleGenerationStarted}
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
