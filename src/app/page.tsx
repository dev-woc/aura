"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const GENRES = [
	"Electronic",
	"Jazz",
	"Ambient",
	"Hip-Hop",
	"Classical",
	"R&B",
	"Experimental",
	"Soul",
	"Post-Rock",
	"Folk",
	"Drone",
	"Neo-Soul",
	"Afrobeat",
	"Shoegaze",
	"Lo-Fi",
	"Techno",
	"Blues",
	"Orchestral",
	"Trap",
	"Avant-garde",
];

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
				if (role === "artist") router.push("/studio");
				else if (role === "listener") router.push("/dashboard");
			})
			.catch(() => {});
	}, [router]);

	const tickerItems = [...GENRES, ...GENRES];

	return (
		<>
			<style>{`
        .al {
          background: #09090b;
          color: #f0ebe0;
          min-height: 100dvh;
          font-family: var(--font-dm-mono), 'DM Mono', monospace;
          position: relative;
          overflow: hidden;
        }

        /* grain */
        .al::before {
          content: '';
          position: fixed;
          inset: 0;
          z-index: 99;
          pointer-events: none;
          opacity: 0.5;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.72' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='0.09'/%3E%3C/svg%3E");
          background-size: 300px 300px;
          mix-blend-mode: overlay;
        }

        /* ambient orb */
        .al-orb {
          position: fixed;
          width: 80vw;
          height: 80vw;
          max-width: 1000px;
          max-height: 1000px;
          border-radius: 50%;
          background: radial-gradient(
            circle at center,
            rgba(190, 120, 45, 0.065) 0%,
            rgba(150, 85, 30, 0.035) 45%,
            transparent 70%
          );
          bottom: -25%;
          right: -20%;
          pointer-events: none;
          animation: orbPulse 10s ease-in-out infinite;
        }

        @keyframes orbPulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50%       { opacity: 1;   transform: scale(1.1); }
        }

        /* nav */
        .al-nav {
          position: fixed;
          top: 0; left: 0; right: 0;
          z-index: 50;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.75rem 2.5rem;
          border-bottom: 1px solid rgba(240, 235, 224, 0.055);
          animation: fromTop 0.9s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both;
        }

        @keyframes fromTop {
          from { opacity: 0; transform: translateY(-10px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .al-logo {
          font-family: var(--font-cormorant), serif;
          font-weight: 400;
          font-size: 1rem;
          letter-spacing: 0.38em;
          text-transform: uppercase;
          color: #f0ebe0;
          text-decoration: none;
        }

        .al-logo sup {
          font-size: 0.42em;
          vertical-align: super;
          opacity: 0.3;
          letter-spacing: 0;
        }

        .al-nav-links {
          display: flex;
          align-items: center;
          gap: 2.5rem;
        }

        .al-nav-link {
          font-size: 0.58rem;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: rgba(240, 235, 224, 0.35);
          text-decoration: none;
          transition: color 0.25s ease;
        }

        .al-nav-link:hover { color: rgba(240, 235, 224, 0.75); }

        .al-nav-sep {
          width: 1px;
          height: 13px;
          background: rgba(240, 235, 224, 0.1);
        }

        .al-nav-cta {
          font-family: var(--font-dm-mono), monospace;
          font-size: 0.58rem;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: #09090b;
          background: #f0ebe0;
          padding: 0.55rem 1.4rem;
          text-decoration: none;
          transition: opacity 0.25s ease;
        }

        .al-nav-cta:hover { opacity: 0.82; }

        /* vertical accent */
        .al-vert {
          position: fixed;
          left: 2.5rem;
          top: 50%;
          transform: translateY(-50%);
          pointer-events: none;
          animation: fadeIn 1.8s ease 1s both;
        }

        .al-vert-line {
          width: 1px;
          height: 90px;
          background: linear-gradient(
            to bottom,
            transparent,
            rgba(240, 235, 224, 0.16),
            transparent
          );
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        /* hero */
        .al-hero {
          min-height: 100dvh;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          padding: 0 2.5rem 5.5rem;
          position: relative;
        }

        .al-wordmark {
          font-family: var(--font-cormorant), serif;
          font-weight: 300;
          font-style: italic;
          font-size: clamp(110px, 18.5vw, 270px);
          line-height: 0.87;
          letter-spacing: -0.03em;
          color: #f0ebe0;
          margin: 0 0 2.25rem -0.06em;
          animation: fromBottom 1.5s cubic-bezier(0.16, 1, 0.3, 1) 0s both;
        }

        @keyframes fromBottom {
          from { opacity: 0; transform: translateY(80px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .al-rule {
          height: 1px;
          background: rgba(240, 235, 224, 0.09);
          margin-bottom: 1.75rem;
          animation: fromBottom 1.5s cubic-bezier(0.16, 1, 0.3, 1) 0.12s both;
        }

        .al-footer {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 2rem;
          animation: fromBottom 1.5s cubic-bezier(0.16, 1, 0.3, 1) 0.22s both;
        }

        .al-descriptor {
          max-width: 300px;
        }

        .al-label {
          display: block;
          font-size: 0.52rem;
          letter-spacing: 0.3em;
          text-transform: uppercase;
          color: rgba(240, 235, 224, 0.2);
          margin-bottom: 0.65rem;
        }

        .al-copy {
          font-size: 0.68rem;
          letter-spacing: 0.04em;
          color: rgba(240, 235, 224, 0.42);
          line-height: 2;
          margin: 0;
        }

        .al-actions {
          display: flex;
          align-items: center;
          gap: 2.75rem;
          flex-shrink: 0;
        }

        .al-btn-ghost {
          font-family: var(--font-dm-mono), monospace;
          font-size: 0.58rem;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: rgba(240, 235, 224, 0.38);
          text-decoration: none;
          transition: color 0.25s ease;
        }

        .al-btn-ghost:hover { color: rgba(240, 235, 224, 0.8); }

        .al-btn-solid {
          font-family: var(--font-dm-mono), monospace;
          font-size: 0.58rem;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: #09090b;
          background: #f0ebe0;
          padding: 0.85rem 2.25rem;
          text-decoration: none;
          transition: opacity 0.25s ease;
          display: inline-block;
        }

        .al-btn-solid:hover { opacity: 0.82; }

        /* year mark */
        .al-year {
          position: fixed;
          right: 2rem;
          top: 50%;
          transform: translateY(-50%) rotate(90deg);
          font-size: 0.48rem;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          color: rgba(240, 235, 224, 0.12);
          white-space: nowrap;
          pointer-events: none;
          animation: fadeIn 2s ease 1.2s both;
        }

        /* ticker */
        .al-ticker {
          position: fixed;
          bottom: 0; left: 0; right: 0;
          height: 2rem;
          display: flex;
          align-items: center;
          overflow: hidden;
          border-top: 1px solid rgba(240, 235, 224, 0.045);
          animation: fadeIn 1s ease 0.9s both;
        }

        .al-ticker-inner {
          display: flex;
          gap: 3.5rem;
          white-space: nowrap;
          animation: ticker 38s linear infinite;
          font-size: 0.48rem;
          letter-spacing: 0.32em;
          text-transform: uppercase;
          color: rgba(240, 235, 224, 0.13);
        }

        @keyframes ticker {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }

        /* responsive */
        @media (max-width: 640px) {
          .al-nav { padding: 1.25rem 1.25rem; }
          .al-nav-links { gap: 1.5rem; }
          .al-nav-link:not(.al-keep) { display: none; }
          .al-nav-sep { display: none; }
          .al-hero { padding: 0 1.25rem 5rem; }
          .al-footer { flex-direction: column; align-items: flex-start; gap: 2rem; }
          .al-vert { display: none; }
          .al-year { display: none; }
        }
      `}</style>

			<div className="al">
				<div className="al-orb" />

				<nav className="al-nav">
					<a href="/" className="al-logo">
						Aura<sup>®</sup>
					</a>
					<div className="al-nav-links">
						<Link href="/discover" className="al-nav-link">
							Discover
						</Link>
						<div className="al-nav-sep" />
						<Link href="/login" className="al-nav-link al-keep">
							Sign in
						</Link>
						<Link href="/signup" className="al-nav-cta">
							Get started
						</Link>
					</div>
				</nav>

				<div className="al-vert">
					<div className="al-vert-line" />
				</div>

				<main className="al-hero">
					<h1 className="al-wordmark">Aura</h1>

					<div className="al-rule" />

					<div className="al-footer">
						<div className="al-descriptor">
							<span className="al-label">Studio — 2026</span>
							<p className="al-copy">
								AI-generated artwork
								<br />
								from your music.
								<br />
								For artists & listeners.
							</p>
						</div>
						<div className="al-actions">
							<Link href="/login" className="al-btn-ghost">
								Sign in
							</Link>
							<Link href="/signup" className="al-btn-solid">
								Begin
							</Link>
						</div>
					</div>
				</main>

				<div className="al-year">Aura Studio — 2026</div>

				<div className="al-ticker">
					<div className="al-ticker-inner">
						{tickerItems.map((genre, i) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: static list
							<span key={i}>{genre}</span>
						))}
					</div>
				</div>
			</div>
		</>
	);
}
