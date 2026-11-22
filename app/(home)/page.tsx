import Link from "next/link";

const entries = [
  { href: "/docs#install", title: "Install a server", text: "Requirements, load order and the convar to set." },
  { href: "/docs/resources", title: "Resources", text: "Every opx_* resource: what it does, its config and exports." },
  { href: "/docs/architecture", title: "Architecture", text: "Contracts between resources, providers, data shapes, events." },
  { href: "/docs/economy", title: "Economy", text: "Money, prices and how the economy is balanced." },
];

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-10 px-4 py-16 text-center">
      <div className="flex flex-col items-center gap-3">
        <h1 className="font-mono text-4xl font-bold tracking-tight sm:text-5xl">OPX//77</h1>
        <p className="max-w-xl text-fd-muted-foreground">
          A serious-roleplay framework for Open77, the multiplayer platform for Cyberpunk 2077, split into small{" "}
          <code>opx_*</code> resources you can replace one at a time.
        </p>
      </div>
      <div className="grid w-full max-w-3xl gap-3 sm:grid-cols-2">
        {entries.map((entry) => (
          <Link
            key={entry.href}
            href={entry.href}
            className="rounded-lg border bg-fd-card p-4 text-left transition-colors hover:bg-fd-accent"
          >
            <p className="font-medium">{entry.title}</p>
            <p className="text-sm text-fd-muted-foreground">{entry.text}</p>
          </Link>
        ))}
      </div>
      <Link href="/docs" className="text-sm font-medium underline underline-offset-4">
        Continue to documentation →
      </Link>
    </main>
  );
}
