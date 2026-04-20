"use client";

import { X } from "lucide-react";
import Image from "next/image";
import { useCallback, useRef, useState } from "react";

const MAX_IMAGES = 10;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

interface ReferenceImageUploadProps {
	value: string[];
	onChange: (urls: string[]) => void;
}

export function ReferenceImageUpload({ value, onChange }: ReferenceImageUploadProps) {
	const [uploading, setUploading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isDragging, setIsDragging] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

	const isAtLimit = value.length >= MAX_IMAGES;

	const uploadFile = useCallback(
		async (file: File) => {
			if (value.length >= MAX_IMAGES) {
				setError(`Maximum ${MAX_IMAGES} images allowed.`);
				return;
			}
			if (!ACCEPTED_TYPES.includes(file.type)) {
				setError("Only JPEG, PNG, and WebP images are accepted.");
				return;
			}
			if (file.size > MAX_FILE_SIZE) {
				setError("File must be under 5MB.");
				return;
			}

			setError(null);
			setUploading(true);
			try {
				const formData = new FormData();
				formData.append("file", file);
				const res = await fetch("/api/upload/reference-image", {
					method: "POST",
					body: formData,
				});
				if (!res.ok) {
					const data = await res.json().catch(() => ({}));
					throw new Error(data.error ?? "Upload failed");
				}
				const { url } = await res.json();
				onChange([...value, url]);
			} catch (err) {
				setError(err instanceof Error ? err.message : "Upload failed. Please try again.");
			} finally {
				setUploading(false);
			}
		},
		[value, onChange],
	);

	const handleFiles = useCallback(
		(files: FileList | null) => {
			if (!files) return;
			// Upload only the first file at a time to keep state predictable
			const file = files[0];
			if (file) uploadFile(file);
		},
		[uploadFile],
	);

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			setIsDragging(false);
			if (isAtLimit || uploading) return;
			handleFiles(e.dataTransfer.files);
		},
		[handleFiles, isAtLimit, uploading],
	);

	const handleDragOver = (e: React.DragEvent) => {
		e.preventDefault();
		setIsDragging(true);
	};

	const handleDragLeave = () => setIsDragging(false);

	const handleRemove = (index: number) => {
		onChange(value.filter((_, i) => i !== index));
	};

	return (
		<div className="space-y-3">
			<button
				type="button"
				disabled={isAtLimit || uploading}
				onDrop={handleDrop}
				onDragOver={handleDragOver}
				onDragLeave={handleDragLeave}
				onClick={() => inputRef.current?.click()}
				className={`flex w-full min-h-[100px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
					isDragging
						? "border-primary bg-accent"
						: "border-border hover:border-primary hover:bg-accent/50"
				}`}
				aria-label="Upload reference images"
			>
				<input
					ref={inputRef}
					type="file"
					accept={ACCEPTED_TYPES.join(",")}
					className="hidden"
					onChange={(e) => handleFiles(e.target.files)}
					disabled={isAtLimit || uploading}
					tabIndex={-1}
				/>
				{uploading ? (
					<p className="text-sm text-muted-foreground">Uploading...</p>
				) : isAtLimit ? (
					<p className="text-sm text-muted-foreground">Maximum images reached.</p>
				) : (
					<>
						<p className="text-sm font-medium">Drag & drop or click to upload</p>
						<p className="mt-1 text-xs text-muted-foreground">JPEG, PNG, WebP · max 5MB per file</p>
					</>
				)}
			</button>

			{error && <p className="text-xs text-destructive">{error}</p>}

			<p className="text-xs text-muted-foreground">
				{value.length} / {MAX_IMAGES} images
			</p>

			{value.length > 0 && (
				<div className="flex flex-wrap gap-2">
					{value.map((url, i) => (
						<div key={url} className="relative h-20 w-20 flex-shrink-0">
							<Image
								src={url}
								alt={`${i + 1}`}
								width={80}
								height={80}
								className="h-full w-full rounded-md object-cover"
							/>
							<button
								type="button"
								onClick={() => handleRemove(i)}
								className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 focus:outline-none"
								aria-label={`Remove image ${i + 1}`}
							>
								<X className="h-3 w-3" />
							</button>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
