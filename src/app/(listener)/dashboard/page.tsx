import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
	return (
		<div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
			<h1 className="text-2xl font-semibold">Welcome to Aura</h1>
			<p className="text-muted-foreground">
				Discover generative visual experiences from your favourite artists.
			</p>
			<Button asChild>
				<Link href="/discover">Browse Experiences</Link>
			</Button>
		</div>
	);
}
