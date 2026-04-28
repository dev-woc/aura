"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";

export function LoginForm() {
	const router = useRouter();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setError("");

		try {
			const { error: authError } = await authClient.signIn.email({
				email,
				password,
			});

			if (authError) {
				setError("Invalid email or password");
				setLoading(false);
				return;
			}

			const res = await fetch("/api/users/me");
			const data = await res.json();
			const role = data?.user?.role;

			if (role === "artist") {
				router.push("/studio");
			} else if (role === "listener") {
				router.push("/dashboard");
			} else {
				router.push("/onboarding");
			}
		} catch {
			setError("Something went wrong. Please try again.");
			setLoading(false);
		}
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			<div className="space-y-1.5">
				<Label htmlFor="email" className="text-white/60 text-xs uppercase tracking-wide">Email</Label>
				<Input
					id="email"
					type="email"
					placeholder="you@example.com"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					aria-label="Email"
					className="border-white/10 bg-white/5 text-white placeholder:text-white/20 focus-visible:ring-white/20"
				/>
			</div>

			<div className="space-y-1.5">
				<Label htmlFor="password" className="text-white/60 text-xs uppercase tracking-wide">Password</Label>
				<Input
					id="password"
					type="password"
					placeholder="Your password"
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					aria-label="Password"
					className="border-white/10 bg-white/5 text-white placeholder:text-white/20 focus-visible:ring-white/20"
				/>
			</div>

			{error && <p className="text-sm text-red-400 text-center">{error}</p>}

			<Button type="submit" className="w-full bg-white text-black hover:bg-white/90" disabled={loading}>
				{loading ? "Signing in..." : "Sign In"}
			</Button>
		</form>
	);
}
