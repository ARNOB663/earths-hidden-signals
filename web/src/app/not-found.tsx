import Link from "next/link";
import { T } from "@/lib/i18n";

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-start justify-center px-4 py-24 sm:px-6">
      <p className="text-sm font-medium text-accent">
        <T en="Page not found" bn="পাতাটি পাওয়া যায়নি" />
      </p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight text-ink">
        <T en="We couldn't find that page." bn="আমরা পাতাটি খুঁজে পাইনি।" />
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-ink-2">
        <T
          en="The link may be old or mistyped. Start from the home page, or jump straight into the story."
          bn="লিংকটি পুরোনো বা ভুল লেখা হতে পারে। প্রথম পাতা থেকে শুরু করুন, অথবা সরাসরি গল্পটা পড়ুন।"
        />
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-5">
        <Link
          href="/"
          className="rounded-full bg-accent px-6 py-3 font-medium text-accent-ink transition-all hover:bg-accent-hover active:scale-[0.98]"
        >
          <T en="Go to the home page" bn="প্রথম পাতায় যান" />
        </Link>
        <Link href="/findings" className="font-medium text-accent hover:underline">
          <T en="Read the story" bn="গল্পটা পড়ুন" />
        </Link>
      </div>
    </div>
  );
}
