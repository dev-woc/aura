"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function OnboardingPage() {
	const router = useRouter();
	const [loading, setLoading] = useState<string | null>(null);
	const [error, setError] = useState("");

	const selectRole = async (role: "artist" | "listener") => {
		setLoading(role);
		setError("");
		try {
			const res = await fetch("/api/users/role", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ role }),
			});
			if (!res.ok) throw new Error("Failed to set role");
			router.push(role === "artist" ? "/studio" : "/dashboard");
		} catch {
			setError("Something went wrong. Please try again.");
			setLoading(null);
		}
	};

	return (
		<div className="flex min-h-screen items-center justify-center bg-background p-8">
			<div className="w-full max-w-2xl space-y-6">
				<div className="space-y-2 text-center">
					<h1 className="text-3xl font-bold">Welcome to Aura</h1>
					<p className="text-muted-foreground">How will you use Aura?</p>
				</div>
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<button
						type="button"
						onClick={() => selectRole("artist")}
						disabled={!!loading}
						className="text-left"
					>
						<Card className="h-full cursor-pointer border-2 transition-colors hover:border-primary">
							<CardHeader>
								<CardTitle>I&apos;m an Artist</CardTitle>
								<CardDescription>
									Define the visual language for your music. Upload a Style Brief, choose your
									palette and art style, and generate preview frames.
								</CardDescription>
							</CardHeader>
							<CardContent>
								{loading === "artist" && (
									<p className="text-sm text-muted-foreground">Setting up...</p>
								)}
							</CardContent>
						</Card>
					</button>
					<button
						type="button"
						onClick={() => selectRole("listener")}
						disabled={!!loading}
						className="text-left"
					>
						<Card className="h-full cursor-pointer border-2 transition-colors hover:border-primary">
							<CardHeader>
								<CardTitle>I&apos;m a Listener</CardTitle>
								<CardDescription>
									Experience generative art that responds to music in real time — shaped by the
									artist&apos;s vision, alive with every beat.
								</CardDescription>
							</CardHeader>
							<CardContent>
								{loading === "listener" && (
									<p className="text-sm text-muted-foreground">Setting up...</p>
								)}
							</CardContent>
						</Card>
					</button>
				</div>
				{error && <p className="text-center text-sm text-destructive">{error}</p>}
			</div>
		</div>
	);
}
