"use client";

import { upload } from "@vercel/blob/client";
import { Loader2, Music, X } from "lucide-react";
import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface UploadedAudioData {
	url: string;
	durationMs: number;
}

interface AudioUploadProps {
	onUploaded: (data: UploadedAudioData) => void;
	onClear: () => void;
	uploaded: UploadedAudioData | null;
	lyrics: string;
	onLyricsChange: (lyrics: string) => void;
	bpm: number;
	onBpmChange: (bpm: number) => void;
	title: string;
	onTitleChange: (title: string) => void;
	artistName: string;
	onArtistNameChange: (name: string) => void;
}

function formatDuration(ms: number): string {
	const s = Math.floor(ms / 1000);
	return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function AudioUpload({
	onUploaded,
	onClear,
	uploaded,
	lyrics,
	onLyricsChange,
	bpm,
	onBpmChange,
	title,
	onTitleChange,
	artistName,
	onArtistNameChange,
}: AudioUploadProps) {
	const fileRef = useRef<HTMLInputElement>(null);
	const [uploading, setUploading] = useState(false);
	const [error, setError] = useState("");

	const handleFile = async (file: File) => {
		setError("");
		setUploading(true);

		const durationMs = await new Promise<number>((resolve) => {
			const audio = new Audio(URL.createObjectURL(file));
			audio.onloadedmetadata = () => resolve(Math.round(audio.duration * 1000));
			audio.onerror = () => resolve(0);
		});

		try {
			const blob = await upload(`aura/audio/${Date.now()}-${file.name}`, file, {
				access: "public",
				handleUploadUrl: "/api/upload/audio",
			});
			onUploaded({ url: blob.url, durationMs });
		} catch (e) {
			setError(e instanceof Error ? e.message : "Upload failed");
		} finally {
			setUploading(false);
		}
	};

	return (
		<div className="space-y-4">
			{!uploaded ? (
				<div>
					<input
						ref={fileRef}
						type="file"
						accept="audio/mpeg,audio/wav,audio/ogg,audio/aac,audio/mp4,.mp3,.wav,.ogg,.aac,.m4a"
						className="hidden"
						onChange={(e) => {
							const f = e.target.files?.[0];
							if (f) handleFile(f);
						}}
					/>
					<button
						type="button"
						onClick={() => fileRef.current?.click()}
						disabled={uploading}
						className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/30 py-8 text-sm text-muted-foreground transition-colors hover:border-muted-foreground/60 hover:text-foreground disabled:opacity-50"
					>
						{uploading ? (
							<Loader2 className="h-5 w-5 animate-spin" />
						) : (
							<Music className="h-5 w-5" />
						)}
						{uploading ? "Uploading..." : "Click to upload MP3, WAV, OGG, or AAC (max 50MB)"}
					</button>
					{error && <p className="mt-1 text-xs text-destructive">{error}</p>}
				</div>
			) : (
				<div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-sm">
					<span className="flex items-center gap-2">
						<Music className="h-4 w-4 text-muted-foreground" />
						<span>Audio uploaded · {formatDuration(uploaded.durationMs)}</span>
					</span>
					<button
						type="button"
						onClick={onClear}
						className="text-muted-foreground hover:text-foreground"
					>
						<X className="h-4 w-4" />
					</button>
				</div>
			)}

			<div className="grid grid-cols-2 gap-3">
				<div className="space-y-1">
					<Label htmlFor="upload-title">Song Title</Label>
					<Input
						id="upload-title"
						placeholder="Title"
						value={title}
						onChange={(e) => onTitleChange(e.target.value)}
					/>
				</div>
				<div className="space-y-1">
					<Label htmlFor="upload-artist">Artist Name</Label>
					<Input
						id="upload-artist"
						placeholder="Artist"
						value={artistName}
						onChange={(e) => onArtistNameChange(e.target.value)}
					/>
				</div>
			</div>

			<div className="space-y-1">
				<Label htmlFor="upload-bpm">
					BPM <span className="text-muted-foreground">(optional — used for beat-sync visuals)</span>
				</Label>
				<Input
					id="upload-bpm"
					type="number"
					min={40}
					max={300}
					placeholder="120"
					value={bpm}
					onChange={(e) => onBpmChange(Number(e.target.value) || 120)}
					className="max-w-[120px]"
				/>
			</div>

			<div className="space-y-1">
				<Label htmlFor="upload-lyrics">
					Lyrics{" "}
					<span className="text-muted-foreground">(optional — leave blank to auto-transcribe)</span>
				</Label>
				<Textarea
					id="upload-lyrics"
					placeholder="Paste lyrics here, or leave blank and we'll transcribe them automatically..."
					value={lyrics}
					onChange={(e) => onLyricsChange(e.target.value)}
					rows={6}
					className="resize-y font-mono text-xs"
				/>
			</div>
		</div>
	);
}
