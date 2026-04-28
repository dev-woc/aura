export default function AuthLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black p-4">
			{/* Ambient gradient orbs */}
			<div className="pointer-events-none absolute inset-0">
				<div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-violet-600/20 blur-[120px]" />
				<div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-indigo-600/20 blur-[120px]" />
				<div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-500/10 blur-[80px]" />
			</div>

			<div className="relative z-10 flex w-full max-w-md flex-col gap-8">
				{/* Wordmark */}
				<div className="text-center">
					<h1 className="text-4xl font-bold tracking-tight text-white">Aura</h1>
					<p className="mt-1 text-sm text-white/40">Generative visual experiences for music</p>
				</div>

				{/* Card */}
				<div className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl">
					{children}
				</div>
			</div>
		</div>
	);
}
