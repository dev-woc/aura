"use client";

import { LogOut } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";

export default function StudioLayout({ children }: { children: React.ReactNode }) {
	const router = useRouter();
	const { data: session } = authClient.useSession();

	useEffect(() => {
		// Verify artist role
		fetch("/api/users/me")
			.then((r) => r.json())
			.then((data) => {
				if (!data.user?.onboardingComplete) router.push("/onboarding");
				if (data.user?.role !== "artist") router.push("/dashboard");
			});
	}, [router]);

	const handleSignOut = async () => {
		await authClient.signOut();
		router.push("/login");
	};

	return (
		<div className="min-h-screen bg-background">
			<nav className="border-b bg-card">
				<div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
					<Link href="/studio" className="text-lg font-semibold">
						Aura Studio
					</Link>
					<div className="flex items-center gap-4">
						<Link
							href="/studio/settings"
							className="text-sm text-muted-foreground hover:text-foreground"
						>
							Settings
						</Link>
						{session?.user && (
							<span className="text-sm text-muted-foreground">{session.user.name}</span>
						)}
						<Button variant="ghost" size="sm" onClick={handleSignOut}>
							<LogOut className="mr-2 h-4 w-4" />
							Sign out
						</Button>
					</div>
				</div>
			</nav>
			<main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
		</div>
	);
}
