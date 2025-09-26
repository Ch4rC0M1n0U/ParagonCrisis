import type { ReactNode } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
	title: {
		default: "Authentification | ParagonCrisis",
		template: "%s | ParagonCrisis",
	},
	robots: {
		index: false,
		follow: false,
	},
};

interface AuthLayoutProps {
	children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
	return (
		<div className="min-h-screen bg-base-200">
			<main className="mx-auto flex min-h-screen max-w-5xl md:max-w-[85vw] items-center justify-center px-6 py-12">
				{children}
			</main>
		</div>
	);
}
