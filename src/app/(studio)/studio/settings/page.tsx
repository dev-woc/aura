"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Artist } from "@/types";

export default function SettingsPage() {
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [uploading, setUploading] = useState(false);
	const [displayName, setDisplayName] = useState("");
	const [bio, setBio] = useState("");
	const [avatarUrl, setAvatarUrl] = useState("");
	const fileInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		fetch("/api/artists/me")
			.then((r) => r.json())
			.then((data: { artist?: Artist }) => {
				if (data.artist) {
					setDisplayName(data.artist.displayName ?? "");
					setBio(data.artist.bio ?? "");
					setAvatarUrl(data.artist.avatarUrl ?? "");
				}
			})
			.finally(() => setLoading(false));
	}, []);

	const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		setUploading(true);
		try {
			const formData = new FormData();
			formData.append("file", file);
			const res = await fetch("/api/upload/avatar", { method: "POST", body: formData });
			const data = await res.json();
			if (data.url) {
				setAvatarUrl(data.url);
				toast.success("Avatar uploaded");
			} else {
				toast.error(data.error ?? "Upload failed");
			}
		} catch {
			toast.error("Upload failed");
		} finally {
			setUploading(false);
			if (fileInputRef.current) fileInputRef.current.value = "";
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!displayName.trim()) {
			toast.error("Display name is required");
			return;
		}
		setSaving(true);
		try {
			const res = await fetch("/api/artists/me", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ displayName, bio, avatarUrl }),
			});
			const data = await res.json();
			if (data.artist) {
				toast.success("Profile updated");
			} else {
				toast.error("Failed to save profile");
			}
		} catch {
			toast.error("Failed to save profile");
		} finally {
			setSaving(false);
		}
	};

	if (loading) {
		return (
			<div className="flex justify-center py-16">
				<p className="text-muted-foreground">Loading...</p>
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-lg space-y-8">
			<h1 className="text-2xl font-bold">Artist Settings</h1>

			<form onSubmit={handleSubmit} className="space-y-6">
				<div className="space-y-2">
					<Label>Avatar</Label>
					<div className="flex items-center gap-4">
						{avatarUrl ? (
							<div className="relative h-16 w-16 overflow-hidden rounded-full border">
								<Image src={avatarUrl} alt="Avatar preview" fill className="object-cover" />
							</div>
						) : (
							<div className="flex h-16 w-16 items-center justify-center rounded-full border bg-muted text-lg font-bold text-muted-foreground">
								{displayName?.[0]?.toUpperCase() ?? "?"}
							</div>
						)}
						<div>
							<Button
								type="button"
								variant="outline"
								size="sm"
								disabled={uploading}
								onClick={() => fileInputRef.current?.click()}
							>
								{uploading ? "Uploading..." : "Upload Image"}
							</Button>
							<p className="mt-1 text-xs text-muted-foreground">JPEG, PNG, or WebP · Max 5MB</p>
						</div>
					</div>
					<input
						ref={fileInputRef}
						type="file"
						accept="image/jpeg,image/png,image/webp"
						className="hidden"
						onChange={handleAvatarChange}
					/>
				</div>

				<div className="space-y-2">
					<Label htmlFor="displayName">Display Name</Label>
					<Input
						id="displayName"
						value={displayName}
						onChange={(e) => setDisplayName(e.target.value)}
						placeholder="Your artist name"
						maxLength={100}
					/>
				</div>

				<div className="space-y-2">
					<Label htmlFor="bio">Bio</Label>
					<Textarea
						id="bio"
						value={bio}
						onChange={(e) => setBio(e.target.value)}
						placeholder="Tell listeners about yourself and your music..."
						maxLength={500}
						rows={4}
					/>
					<p className="text-xs text-muted-foreground">{bio.length}/500</p>
				</div>

				<Button type="submit" disabled={saving}>
					{saving ? "Saving..." : "Save Changes"}
				</Button>
			</form>
		</div>
	);
}
