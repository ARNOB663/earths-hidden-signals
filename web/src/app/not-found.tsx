import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-start justify-center px-4 py-24 sm:px-6">
      <p className="text-sm font-medium text-accent">Page not found</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight text-ink">We couldn&apos;t find that page.</h1>
      <p className="mt-4 text-lg leading-relaxed text-ink-2">
        The link may be old or mistyped. Start from the home page, or jump straight into the story.
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-5">
        <Link
          href="/"
          className="rounded-full bg-accent px-6 py-3 font-medium text-accent-ink transition-all hover:bg-accent-hover active:scale-[0.98]"
        >
          Go to the home page
        </Link>
        <Link href="/findings" className="font-medium text-accent hover:underline">
          Read the story
        </Link>
      </div>
    </div>
  );
}
