// Level-specific preparedness checklist. Green is framed as "stay ready", never as "safe".

import { CheckCircle2 } from "lucide-react";
import { T } from "@/lib/i18n";
import type { Status } from "@/lib/signals/types";

const ITEMS: Record<Status, { en: string[]; bn: string[] }> = {
  green: {
    en: ["Keep documents in one waterproof folder", "Check you have drinking water and a torch", "Agree where the family meets if a warning comes"],
    bn: ["নথিপত্র একটি জলরোধী ফোল্ডারে রাখুন", "খাবার পানি ও টর্চ আছে কি না দেখে নিন", "সতর্কবার্তা এলে পরিবার কোথায় মিলিত হবে ঠিক করুন"],
  },
  yellow: {
    en: ["Charge phones and power banks", "Stock medicines for a week", "Check on relatives and neighbours who need help", "Move valuables above the ground floor"],
    bn: ["ফোন ও পাওয়ার ব্যাংক চার্জ দিন", "এক সপ্তাহের ওষুধ মজুদ রাখুন", "সহায়তা প্রয়োজন এমন আত্মীয় ও প্রতিবেশীর খোঁজ নিন", "মূল্যবান জিনিস মাটির তলার উপরে সরান"],
  },
  red: {
    en: ["Charge phones and power banks now", "Prepare medicines, documents and a torch in one bag", "Check on relatives, older people and children", "Decide now where you go if an official warning comes", "Move valuables and important documents higher"],
    bn: ["এখনই ফোন ও পাওয়ার ব্যাংক চার্জ দিন", "ওষুধ, নথিপত্র ও টর্চ একটি ব্যাগে প্রস্তুত রাখুন", "আত্মীয়, বয়স্ক ও শিশুদের খোঁজ নিন", "সরকারি সতর্কবার্তা এলে কোথায় যাবেন তা এখনই ঠিক করুন", "মূল্যবান জিনিস ও নথি উঁচুতে সরান"],
  },
  grey: {
    en: ["Follow official warnings for your area", "Keep documents, water and a torch ready anyway"],
    bn: ["আপনার এলাকার সরকারি সতর্কবার্তা মেনে চলুন", "তবুও নথি, পানি ও টর্চ প্রস্তুত রাখুন"],
  },
};

export function Checklist({ status }: { status: Status }) {
  const items = ITEMS[status];
  return (
    <section aria-labelledby="checklist" className="mt-4 rounded-2xl border border-line bg-card p-4">
      <h2 id="checklist" className="text-base font-semibold text-ink">
        {status === "green" ? <T en="Stay ready" bn="প্রস্তুত থাকুন" /> : <T en="What to do now" bn="এখন কী করবেন" />}
      </h2>
      <ul className="mt-2 space-y-1.5 text-sm text-ink-2">
        {items.en.map((item, index) => (
          <li key={item} className="flex gap-2">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-ink-3" aria-hidden />
            <T en={item} bn={items.bn[index]} />
          </li>
        ))}
      </ul>
    </section>
  );
}
