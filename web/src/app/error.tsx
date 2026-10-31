"use client";

import Link from "next/link";
import { RotateCw, TriangleAlert } from "lucide-react";
import { T } from "@/lib/i18n";
import { CONTROL } from "@/components/ui";
import { GIcon } from "@/components/ui/icons";

/**
 * A page that failed to render: one calm card and one clear way forward. No toast — the boundary
 * may have been reached because the surrounding layout is failing, and the card is the one channel
 * that is always there.
 */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-start justify-center px-4 py-24 sm:px-6">
      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-watch-soft text-watch">
        <GIcon icon={TriangleAlert} size="xl" />
      </span>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink">
        <T en="Something went wrong." bn="কিছু একটা ভুল হয়েছে।" />
      </h1>
      <p className="mt-3 text-lg leading-relaxed text-ink-2">
        <T
          en="This part of the page could not load. Nothing you did was lost — you can try again."
          bn="পাতার এই অংশটি লোড হয়নি। আপনার করা কিছুই হারায়নি — আবার চেষ্টা করতে পারেন।"
        />
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-5">
        <button
          type="button"
          onClick={reset}
          className={`inline-flex ${CONTROL.button} items-center gap-2 rounded-full bg-accent-strong px-5 text-sm font-medium text-accent-ink ${CONTROL.transition} ${CONTROL.focusRing} hover:bg-accent-hover`}
        >
          <GIcon icon={RotateCw} />
          <T en="Try again" bn="আবার চেষ্টা করুন" />
        </button>
        <Link href="/" className="inline-flex min-h-10 items-center font-medium text-accent hover:underline">
          <T en="Go to the home page" bn="প্রথম পাতায় যান" />
        </Link>
      </div>
    </div>
  );
}
