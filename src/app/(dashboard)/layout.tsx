"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function DashboardLayout(_: { children: React.ReactNode }) {
	const router = useRouter();

	useEffect(() => {
		fetch("/api/users/me")
			.then((r) => {
				if (r.status === 401) {
					router.push("/login");
					return null;
				}
				return r.json();
			})
			.then((data) => {
				if (!data) return;
				const role = data.user?.role;
				const onboardingComplete = data.user?.onboardingComplete;

				if (!onboardingComplete) {
					router.push("/onboarding");
				} else if (role === "artist") {
					router.push("/studio");
				} else if (role === "listener") {
					router.push("/dashboard");
				} else {
					router.push("/onboarding");
				}
			})
			.catch(() => {
				router.push("/login");
			});
	}, [router]);

	return (
		<div className="flex min-h-screen items-center justify-center">
			<div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
		</div>
	);
}
