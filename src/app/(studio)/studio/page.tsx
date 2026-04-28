"use client";

import { Heart } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import type { GeneratedFrame, Song, StyleBrief } from "@/types";

type BriefWithSong = StyleBrief & {
	song?: Song | null;
	generatedFrames?: GeneratedFrame[];
};

const statusColors: Record<string, string> = {
	draft: "bg-gray-100 text-gray-700",
	generating: "bg-yellow-100 text-yellow-700",
	ready: "bg-green-100 text-green-700",
};

const publishedBadge = "bg-blue-100 text-blue-700";

export default function StudioPage() {
	const router = useRouter();
	const [briefs, setBriefs] = useState<BriefWithSong[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [deletingId, setDeletingId] = useState<string | null>(null);

	useEffect(() => {
		fetch("/api/style-briefs")
			.then((r) => r.json())
			.then((data) => {
				if (data.styleBriefs) setBriefs(data.styleBriefs);
				else setError("Failed to load style briefs");
			})
			.catch(() => setError("Failed to load style briefs"))
			.finally(() => setLoading(false));
	}, []);

	const handleDelete = async (briefId: string, e: React.MouseEvent) => {
		e.stopPropagation();
		setDeletingId(briefId);
		try {
			const res = await fetch(`/api/style-briefs/${briefId}`, { method: "DELETE" });
			if (res.ok) setBriefs((prev) => prev.filter((b) => b.id !== briefId));
		} finally {
			setDeletingId(null);
		}
	};

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<h1 className="text-3xl font-bold">Aura Studio</h1>
				<Button asChild>
					<Link href="/studio/new">New Style Brief</Link>
				</Button>
			</div>

			{loading && (
				<div className="flex justify-center py-12">
					<p className="text-muted-foreground">Loading...</p>
				</div>
			)}

			{error && <p className="text-sm text-destructive">{error}</p>}

			{!loading && !error && briefs.length === 0 && (
				<div className="flex flex-col items-center gap-4 py-16 text-center">
					<p className="text-muted-foreground">No style briefs yet. Create your first one.</p>
					<Button asChild>
						<Link href="/studio/new">New Style Brief</Link>
					</Button>
				</div>
			)}

			{!loading && briefs.length > 0 && (
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{briefs.map((brief) => (
						<button
							key={brief.id}
							type="button"
							onClick={() => router.push(`/studio/${brief.id}`)}
							className="w-full cursor-pointer text-left"
						>
							<Card className="h-full transition-shadow hover:shadow-md">
								{brief.generatedFrames?.[0]?.frameUrl && (
									<div className="relative aspect-video w-full overflow-hidden rounded-t-lg bg-muted">
										<Image
											src={brief.generatedFrames[0].frameUrl}
											alt={brief.title || "Brief thumbnail"}
											fill
											className="object-cover"
										/>
									</div>
								)}
								<CardHeader>
									<CardTitle className="line-clamp-1 text-base">
										{brief.title || "Untitled"}
									</CardTitle>
								</CardHeader>
								<CardContent className="space-y-2">
									<p className="text-sm text-muted-foreground">
										{brief.song?.title
											? `${brief.song.title} — ${brief.song.artistName}`
											: "No song linked"}
									</p>
									{(brief.playCount > 0 || brief.likeCount > 0) && (
										<div className="flex items-center gap-3 text-xs text-muted-foreground">
											{brief.playCount > 0 && <span>{brief.playCount} plays</span>}
											{brief.likeCount > 0 && (
												<span className="flex items-center gap-1">
													<Heart className="h-3 w-3" />
													{brief.likeCount}
												</span>
											)}
										</div>
									)}
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-1.5">
											<span
												className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
													statusColors[brief.status] ?? statusColors.draft
												}`}
											>
												{brief.status}
											</span>
											{brief.published && (
												<span
													className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${publishedBadge}`}
												>
													published
												</span>
											)}
										</div>
										<div className="flex items-center gap-2">
											<span className="text-xs text-muted-foreground">
												{new Date(brief.createdAt).toLocaleDateString()}
											</span>
											<Dialog>
												<DialogTrigger asChild>
													<Button
														variant="ghost"
														size="sm"
														className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
														onClick={(e) => e.stopPropagation()}
														disabled={deletingId === brief.id}
													>
														×
													</Button>
												</DialogTrigger>
												<DialogContent>
													<DialogHeader>
														<DialogTitle>Delete Style Brief</DialogTitle>
														<DialogDescription>
															This permanently deletes &ldquo;{brief.title || "Untitled"}
															&rdquo;. Cannot be undone.
														</DialogDescription>
													</DialogHeader>
													<DialogFooter showCloseButton>
														<Button
															variant="destructive"
															onClick={(e) => handleDelete(brief.id, e)}
															disabled={deletingId === brief.id}
														>
															{deletingId === brief.id ? "Deleting..." : "Delete"}
														</Button>
													</DialogFooter>
												</DialogContent>
											</Dialog>
										</div>
									</div>
								</CardContent>
							</Card>
						</button>
					))}
				</div>
			)}
		</div>
	);
}
