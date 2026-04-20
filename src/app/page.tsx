"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Home() {
	const router = useRouter();

	useEffect(() => {
		fetch("/api/users/me")
			.then((r) => {
				if (r.status === 401) return null;
				return r.json();
			})
			.then((data) => {
				if (!data?.user) return;
				const role = data.user.role;
				if (role === "artist") {
					router.push("/studio");
				} else if (role === "listener") {
					router.push("/dashboard");
				}
				// No role yet — stay on landing page
			})
			.catch(() => {
				// Unauthenticated or network error — stay on landing page
			});
	}, [router]);

	return (
		<div className="flex min-h-screen flex-col items-center justify-center px-4">
			<div className="flex flex-col items-center gap-6 text-center max-w-md">
				<div className="space-y-2">
					<h1 className="text-4xl font-bold tracking-tight">Aura</h1>
					<p className="text-muted-foreground">Where music becomes visual</p>
				</div>

				<div className="flex flex-col gap-3 w-full sm:flex-row sm:justify-center">
					<Button asChild size="lg" className="w-full sm:w-auto">
						<Link href="/signup">Get Started</Link>
					</Button>
					<Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
						<Link href="/login">Sign In</Link>
					</Button>
				</div>
			</div>
		</div>
	);
}
