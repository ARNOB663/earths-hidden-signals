"use client";

// "Use my location" asks for permission only when tapped. The position is used once, to open the
// local place page; it is never stored and never sent anywhere except the local tile lookup.

import { LocateFixed } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useT } from "@/lib/i18n";

export function UseMyLocation({ disabled = false }: { disabled?: boolean }) {
  const router = useRouter();
  const t = useT();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function useLocation() {
    if (!navigator.geolocation) {
      setMessage(t("This browser cannot share a location.", "এই ব্রাউজার অবস্থান দিতে পারে না।"));
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setBusy(false);
        const { latitude, longitude } = position.coords;
        router.push(`/signals/place?lat=${latitude.toFixed(3)}&lon=${longitude.toFixed(3)}`);
      },
      () => {
        setBusy(false);
        setMessage(t("Location was not shared. You can still tap the map.", "অবস্থান দেওয়া হয়নি। মানচিত্রে চাপ দিতে পারেন।"));
      },
      { maximumAge: 60_000, timeout: 10_000 },
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={useLocation}
        disabled={disabled || busy}
        className="inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-card px-4 text-sm font-medium text-ink disabled:opacity-60"
      >
        <LocateFixed size={16} aria-hidden />
        {busy ? t("Finding you", "অবস্থান খোঁজা হচ্ছে") : t("Use my location", "আমার অবস্থান")}
      </button>
      {message && <p className="mt-2 text-sm text-ink-3">{message}</p>}
    </div>
  );
}
