"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ArtStyleSelector } from "@/components/studio/art-style-selector";
import { LayerWeightSliders } from "@/components/studio/layer-weight-sliders";
import { PalettePicker } from "@/components/studio/palette-picker";
import { ReferenceImageUpload } from "@/components/studio/reference-image-upload";
import { SpotifyTrackSearch } from "@/components/studio/spotify-track-search";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
	ArtStyle,
	GeneratedFrame,
	LayerWeights,
	PaletteColor,
	Song,
	SpotifyTrack,
	StyleBrief,
} from "@/types";

type StepStatus = "idle" | "loading" | "done" | "error";

interface StyleBriefFormProps {
	initialBrief?: StyleBrief & { song?: Song | null };
	onSave?: (brief: StyleBrief) => void;
	onFramesGenerated?: (frames: GeneratedFrame[]) => void;
}

export function StyleBriefForm({ initialBrief, onSave, onFramesGenerated }: StyleBriefFormProps) {
	const [title, setTitle] = useState(initialBrief?.title ?? "");
	const [selectedTrack, setSelectedTrack] = useState<SpotifyTrack | null>(null);
	const [palette, setPalette] = useState<PaletteColor[]>(
		(initialBrief?.palette as PaletteColor[]) ?? [],
	);
	const [artStyle, setArtStyle] = useState<ArtStyle>(
		(initialBrief?.artStyle as ArtStyle) ?? { descriptors: [], freeText: "" },
	);
	const [layerWeights, setLayerWeights] = useState<LayerWeights>(
		(initialBrief?.layerWeights as LayerWeights) ?? { mood: 33, audio: 33, lyrics: 34 },
	);
	const [referenceImageUrls, setReferenceImageUrls] = useState<string[]>(
		(initialBrief?.referenceImageUrls as string[]) ?? [],
	);

	const [savedBriefId, setSavedBriefId] = useState<string | null>(initialBrief?.id ?? null);
	const [analyzedSongId, setAnalyzedSongId] = useState<string | null>(initialBrief?.songId ?? null);

	const [saveStatus, setSaveStatus] = useState<StepStatus>("idle");
	const [analyzeStatus, setAnalyzeStatus] = useState<StepStatus>("idle");
	const [generateStatus, setGenerateStatus] = useState<StepStatus>("idle");

	const handleSave = async () => {
		setSaveStatus("loading");
		try {
			const payload = { title, palette, artStyle, layerWeights, referenceImageUrls };
			const isUpdate = !!savedBriefId;
			const url = isUpdate ? `/api/style-briefs/${savedBriefId}` : "/api/style-briefs";
			const method = isUpdate ? "PUT" : "POST";

			const res = await fetch(url, {
				method,
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});

			if (!res.ok) {
				const err = await res.json();
				throw new Error(err.error ?? "Save failed");
			}

			const data = await res.json();
			const brief: StyleBrief = data.styleBrief;
			setSavedBriefId(brief.id);
			setSaveStatus("done");
			toast.success("Style brief saved!");
			onSave?.(brief);
		} catch (error) {
			setSaveStatus("error");
			toast.error(error instanceof Error ? error.message : "Failed to save style brief");
		}
	};

	const handleAnalyze = async () => {
		if (!savedBriefId || !selectedTrack) return;
		setAnalyzeStatus("loading");
		try {
			const res = await fetch("/api/generate/analyze", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					spotifyTrackId: selectedTrack.id,
					styleBriefId: savedBriefId,
					trackTitle: selectedTrack.name,
					artistName: selectedTrack.artistName,
				}),
			});

			if (!res.ok) {
				const err = await res.json();
				throw new Error(err.error ?? "Analyze failed");
			}

			const data = await res.json();
			setAnalyzedSongId(data.song.id);
			setAnalyzeStatus("done");
			toast.success("Song analyzed successfully!");
		} catch (error) {
			setAnalyzeStatus("error");
			toast.error(error instanceof Error ? error.message : "Failed to analyze song");
		}
	};

	const handleGenerate = async () => {
		if (!savedBriefId || !analyzedSongId) return;
		setGenerateStatus("loading");
		try {
			const res = await fetch("/api/generate/frames", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ songId: analyzedSongId, styleBriefId: savedBriefId }),
			});

			if (!res.ok) {
				const err = await res.json();
				throw new Error(err.error ?? "Frame generation failed");
			}

			setGenerateStatus("done");
			toast.success("Frames generated!");

			const framesRes = await fetch(
				`/api/generate/frames/${analyzedSongId}?styleBriefId=${savedBriefId}`,
			);
			if (framesRes.ok) {
				const framesData = await framesRes.json();
				onFramesGenerated?.(framesData.frames);
			}
		} catch (error) {
			setGenerateStatus("error");
			toast.error(error instanceof Error ? error.message : "Failed to generate frames");
		}
	};

	const canAnalyze = saveStatus === "done" && !!selectedTrack;
	const canGenerate = analyzeStatus === "done";

	return (
		<div className="space-y-6">
			<div className="space-y-2">
				<Label htmlFor="title">Title</Label>
				<Input
					id="title"
					placeholder="My Style Brief"
					value={title}
					onChange={(e) => setTitle(e.target.value)}
				/>
			</div>

			<div className="space-y-2">
				<Label>Spotify Track</Label>
				<SpotifyTrackSearch onSelect={setSelectedTrack} />
				{selectedTrack && (
					<div className="rounded-md border bg-muted/40 p-3 text-sm">
						<span className="font-medium">{selectedTrack.name}</span>
						<span className="text-muted-foreground"> — {selectedTrack.artistName}</span>
					</div>
				)}
				{initialBrief?.song && !selectedTrack && (
					<div className="rounded-md border bg-muted/40 p-3 text-sm">
						<span className="font-medium">{initialBrief.song.title}</span>
						<span className="text-muted-foreground"> — {initialBrief.song.artistName}</span>
					</div>
				)}
			</div>

			<div className="space-y-2">
				<Label>Color Palette</Label>
				<PalettePicker value={palette} onChange={setPalette} />
			</div>

			<div className="space-y-2">
				<Label>Art Style</Label>
				<ArtStyleSelector value={artStyle} onChange={setArtStyle} />
			</div>

			<div className="space-y-2">
				<Label>Layer Weights</Label>
				<LayerWeightSliders value={layerWeights} onChange={setLayerWeights} />
			</div>

			<div className="space-y-2">
				<Label>Reference Images</Label>
				<ReferenceImageUpload value={referenceImageUrls} onChange={setReferenceImageUrls} />
			</div>

			<div className="flex flex-col gap-3 sm:flex-row">
				<Button
					onClick={handleSave}
					disabled={saveStatus === "loading"}
					variant={saveStatus === "done" ? "outline" : "default"}
					className="flex-1"
				>
					{saveStatus === "loading"
						? "Saving..."
						: saveStatus === "done"
							? "Brief Saved ✓"
							: saveStatus === "error"
								? "Retry Save"
								: "Save Brief"}
				</Button>

				<Button
					onClick={handleAnalyze}
					disabled={!canAnalyze || analyzeStatus === "loading"}
					variant={analyzeStatus === "done" ? "outline" : "default"}
					className="flex-1"
				>
					{analyzeStatus === "loading"
						? "Analyzing... (30-60s)"
						: analyzeStatus === "done"
							? "Song Analyzed ✓"
							: analyzeStatus === "error"
								? "Retry Analyze"
								: "Analyze Song"}
				</Button>

				<Button
					onClick={handleGenerate}
					disabled={!canGenerate || generateStatus === "loading"}
					variant={generateStatus === "done" ? "outline" : "default"}
					className="flex-1"
				>
					{generateStatus === "loading"
						? "Generating... (2-5min)"
						: generateStatus === "done"
							? "Frames Generated ✓"
							: generateStatus === "error"
								? "Retry Generate"
								: "Generate Frames"}
				</Button>
			</div>

			{saveStatus === "error" && (
				<p className="text-sm text-destructive">Failed to save. Please try again.</p>
			)}
			{analyzeStatus === "error" && (
				<p className="text-sm text-destructive">Analysis failed. Please try again.</p>
			)}
			{generateStatus === "error" && (
				<p className="text-sm text-destructive">Frame generation failed. Please try again.</p>
			)}
		</div>
	);
}
