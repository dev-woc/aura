"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ArtStyleSelector } from "@/components/studio/art-style-selector";
import { AudioUpload } from "@/components/studio/audio-upload";
import { LayerWeightSliders } from "@/components/studio/layer-weight-sliders";
import { MoodTagSelector } from "@/components/studio/mood-tag-selector";
import { PalettePicker } from "@/components/studio/palette-picker";
import { ReferenceImageUpload } from "@/components/studio/reference-image-upload";
import { SpotifyTrackSearch } from "@/components/studio/spotify-track-search";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ArtStyle, LayerWeights, PaletteColor, Song, SpotifyTrack, StyleBrief } from "@/types";

type StepStatus = "idle" | "loading" | "done" | "error";

interface StyleBriefFormProps {
	initialBrief?: StyleBrief & { song?: Song | null };
	onSave?: (brief: StyleBrief) => void;
	onFramesGenerated?: (jobId: string) => void;
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

	const [songSource, setSongSource] = useState<"spotify" | "upload">("spotify");
	const [uploadedAudio, setUploadedAudio] = useState<{ url: string; durationMs: number } | null>(
		null,
	);
	const [uploadTitle, setUploadTitle] = useState("");
	const [uploadArtistName, setUploadArtistName] = useState("");
	const [uploadLyrics, setUploadLyrics] = useState("");
	const [uploadBpm, setUploadBpm] = useState(120);
	const [moodTags, setMoodTags] = useState<{ genreTags: string[]; vibeTags: string[] }>({
		genreTags: [],
		vibeTags: [],
	});

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
		if (!savedBriefId) return;
		setAnalyzeStatus("loading");
		try {
			if (songSource === "upload") {
				if (!uploadedAudio) throw new Error("No audio file uploaded");
				const res = await fetch("/api/generate/analyze-upload", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						styleBriefId: savedBriefId,
						audioFileUrl: uploadedAudio.url,
						title: uploadTitle,
						artistName: uploadArtistName,
						durationMs: uploadedAudio.durationMs,
						bpm: uploadBpm,
						lyrics: uploadLyrics || undefined,
						genreTags: moodTags.genreTags,
						vibeTags: moodTags.vibeTags,
					}),
				});
				if (!res.ok) {
					const err = await res.json();
					throw new Error(err.error ?? "Analyze failed");
				}
				const data = await res.json();
				setAnalyzedSongId(data.song.id);
			} else {
				if (!selectedTrack) throw new Error("No track selected");
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
			}

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

			const data = await res.json();
			setGenerateStatus("done");
			toast.success("Frame generation started!");
			onFramesGenerated?.(data.jobId);
		} catch (error) {
			setGenerateStatus("error");
			toast.error(error instanceof Error ? error.message : "Failed to generate frames");
		}
	};

	const canAnalyze =
		saveStatus === "done" &&
		(songSource === "spotify"
			? !!selectedTrack
			: !!uploadedAudio &&
				!!uploadTitle.trim() &&
				!!uploadArtistName.trim() &&
				moodTags.genreTags.length > 0);
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
				<Label>Music Source</Label>
				<div className="flex w-fit rounded-md border">
					{(["spotify", "upload"] as const).map((src) => (
						<button
							key={src}
							type="button"
							onClick={() => setSongSource(src)}
							className={`px-4 py-1.5 text-sm capitalize transition-colors first:rounded-l-md last:rounded-r-md ${
								songSource === src
									? "bg-foreground text-background"
									: "text-muted-foreground hover:text-foreground"
							}`}
						>
							{src === "spotify" ? "Spotify" : "Upload"}
						</button>
					))}
				</div>
			</div>

			{songSource === "spotify" && (
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
			)}

			{songSource === "upload" && (
				<div className="space-y-4">
					<AudioUpload
						uploaded={uploadedAudio}
						onUploaded={setUploadedAudio}
						onClear={() => setUploadedAudio(null)}
						title={uploadTitle}
						onTitleChange={setUploadTitle}
						artistName={uploadArtistName}
						onArtistNameChange={setUploadArtistName}
						lyrics={uploadLyrics}
						onLyricsChange={setUploadLyrics}
						bpm={uploadBpm}
						onBpmChange={setUploadBpm}
					/>
					<div className="space-y-2">
						<Label>
							Genre & Vibe{" "}
							<span className="text-xs text-muted-foreground">
								(used to infer mood for visuals)
							</span>
						</Label>
						<MoodTagSelector value={moodTags} onChange={setMoodTags} />
					</div>
				</div>
			)}

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
						? songSource === "upload" && !uploadLyrics
							? "Transcribing + Analyzing... (60–90s)"
							: "Analyzing... (30–60s)"
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
						? "Starting..."
						: generateStatus === "done"
							? "Generation Queued ✓"
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
