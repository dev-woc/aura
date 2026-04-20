"use client";

import Link from "next/link";
import { authClient } from "@/lib/auth/client";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
	const { data: session } = authClient.useSession();

	return (
		<div className="min-h-screen bg-background">
			<nav className="border-b bg-card">
				<div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
					<Link href="/discover" className="text-lg font-semibold">
						Aura
					</Link>
					<div className="flex items-center gap-4">
						<Link href="/discover" className="text-sm text-muted-foreground hover:text-foreground">
							Discover
						</Link>
						{session?.user ? (
							<Link
								href="/dashboard"
								className="text-sm text-muted-foreground hover:text-foreground"
							>
								My Dashboard
							</Link>
						) : (
							<Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">
								Sign In
							</Link>
						)}
					</div>
				</div>
			</nav>
			<main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
		</div>
	);
}
