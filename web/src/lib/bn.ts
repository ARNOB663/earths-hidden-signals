// Bangla number and date formatting. Plain functions (no React), usable on server and client.

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";

/** Latin digits (and minus) to Bangla digits, for numbers inside Bangla sentences. */
export function bnNum(value: string | number): string {
  return String(value)
    .replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)])
    .replace(/-/g, "−");
}

export const BN_MONTHS = [
  "জানুয়ারি",
  "ফেব্রুয়ারি",
  "মার্চ",
  "এপ্রিল",
  "মে",
  "জুন",
  "জুলাই",
  "আগস্ট",
  "সেপ্টেম্বর",
  "অক্টোবর",
  "নভেম্বর",
  "ডিসেম্বর",
];

/** "2026-08" or "2026-08-01" -> "আগস্ট ২০২৬". */
export function bnMonth(isoDate: string): string {
  return `${BN_MONTHS[Number(isoDate.slice(5, 7)) - 1]} ${bnNum(isoDate.slice(0, 4))}`;
}
