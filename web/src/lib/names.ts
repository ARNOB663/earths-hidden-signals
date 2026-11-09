// Bangla names and short descriptions for regions, hazards and well-known places.
// Plain data, usable on server and client.

import type { HazardId } from "./hazards";

export const ZONE_BN: Record<string, { name: string; description: string }> = {
  "study-area": { name: "সমগ্র দক্ষিণ এশিয়া", description: "মানচিত্রের সব স্থলভাগের গড়।" },
  "bengal-delta": {
    name: "গঙ্গা-ব্রহ্মপুত্র-মেঘনা ব-দ্বীপ",
    description: "নিচু ব-দ্বীপ, যেখানে এশিয়ার তিনটি বড় নদী বঙ্গোপসাগরে মেশে। এখানকার ও উজানের বর্ষার বৃষ্টি নদী ও আকস্মিক বন্যা ঘটায়।",
  },
  "indus-plain": {
    name: "সিন্ধু সমভূমি",
    description: "সিন্ধু নদের সমতল, ঘনবসতিপূর্ণ কৃষিভূমি। চরম বর্ষার বৃষ্টিতে ২০১০ ও ২০২২ সালে বিরাট বন্যা হয়েছিল।",
  },
  "central-himalaya": {
    name: "মধ্য হিমালয়",
    description: "খাড়া, নবীন পর্বতমালা, যেখানে বর্ষায় ভেজা মাটি প্রতি বছর হাজারো ভূমিধস ঘটায়।",
  },
  "western-himalaya": {
    name: "পশ্চিম হিমালয়",
    description: "কাশ্মীর থেকে উত্তরাখণ্ড পর্যন্ত পর্বতমালা; মেঘভাঙা বৃষ্টি ও রাস্তা কাটার ফলে ঢাল ধসে পড়ে।",
  },
  "western-ghats": {
    name: "পশ্চিমঘাট পর্বতমালা",
    description: "মৌসুমি বাতাসের মুখোমুখি উপকূলীয় পর্বতমালা; তীব্র বৃষ্টিতে ২০১৮ ও ২০২৪ সালে কেরালায় ভয়াবহ ভূমিধস হয়েছিল।",
  },
  "sri-lanka-hills": {
    name: "শ্রীলঙ্কার মধ্য পার্বত্য অঞ্চল",
    description: "চা-বাগানে ঢাকা পাহাড়ি এলাকা, যেখানে বর্ষার প্রবল বৃষ্টি প্রায়ই ভূমিধস ঘটায়।",
  },
  "central-india-forests": {
    name: "মধ্য ভারতের বনাঞ্চল",
    description: "শুষ্ক পর্ণমোচী বন, যা প্রতি বছর বর্ষার আগে (মার্চ–মে) গরম চরমে উঠলে ও মাটি শুকিয়ে গেলে পোড়ে।",
  },
  "northeast-hills": {
    name: "উত্তর-পূর্ব ভারত ও মিয়ানমারের পাহাড়",
    description: "বনাঞ্চলে ঢাকা পাহাড়, যেখানে বসন্তে প্রায়ই আগুন লাগে; বর্ষায় ভূমিধসের ঝুঁকিও থাকে।",
  },
  "bay-of-bengal": {
    name: "বঙ্গোপসাগর",
    description: "উষ্ণ, অগভীর সাগর; এর ঘূর্ণিঝড় বাংলাদেশ, পূর্ব ভারত ও মিয়ানমারে আঘাত হানে, প্রায়ই প্রাণঘাতী জলোচ্ছ্বাস নিয়ে।",
  },
  "arabian-sea": {
    name: "আরব সাগর",
    description: "তুলনামূলক শান্ত সাগর; এর ঘূর্ণিঝড় পশ্চিম ভারত, পাকিস্তান ও ওমানে পৌঁছায়।",
  },
};

export const zoneNameBn = (id: string, fallback: string) => ZONE_BN[id]?.name ?? fallback;

export const HAZARD_BN: Record<
  HazardId,
  { label: string; plural: string; bigYears: string; intro: string; affected: string[] }
> = {
  flood: {
    label: "বন্যা",
    plural: "বন্যা সতর্কতা",
    bigYears: "বড় বন্যার বছর",
    intro: "বিশাল প্লাবনভূমিতে নদী ও আকস্মিক বন্যা, স্থানীয় ও উজানের বর্ষার বৃষ্টিতে।",
    affected: ["নদী ও ব-দ্বীপের মানুষ", "কৃষক", "জরুরি উদ্ধার দল", "স্থানীয় প্রশাসন"],
  },
  landslide: {
    label: "ভূমিধস",
    plural: "ভূমিধস",
    bigYears: "বড় ভূমিধসের বছর",
    intro: "খাড়া ঢালে মাটি ধসে পড়া, সাধারণত বর্ষার বৃষ্টিতে মাটি ভিজে গেলে।",
    affected: ["পাহাড়ি জনগোষ্ঠী", "সড়ক", "জলবিদ্যুৎ কেন্দ্র", "দুর্যোগ ব্যবস্থাপনা সংস্থা"],
  },
  wildfire: {
    label: "দাবানল",
    plural: "স্যাটেলাইটে দেখা আগুন",
    bigYears: "বড় আগুনের বছর",
    intro: "বর্ষার আগে গরম, শুকনো সপ্তাহগুলোতে (মার্চ–মে) বন ও ঝোপঝাড়ে আগুন।",
    affected: ["বনের মানুষ", "কৃষক", "বন বিভাগ", "জরুরি সাড়াদানকারী"],
  },
  cyclone: {
    label: "ঘূর্ণিঝড়",
    plural: "ঘূর্ণিঝড়",
    bigYears: "ঘূর্ণিঝড়-বহুল বছর",
    intro: "উষ্ণ বঙ্গোপসাগর ও আরব সাগরে ঘূর্ণিঝড় তৈরি হয়, মূলত মে ও অক্টোবর–নভেম্বরে, উপকূলে জলোচ্ছ্বাস, ঝড়ো হাওয়া ও বন্যা আনে।",
    affected: ["উপকূলের মানুষ", "জেলে", "বন্দর ও নৌপরিবহন", "ঘূর্ণিঝড় আশ্রয়কেন্দ্র ও উদ্ধারকর্মী"],
  },
};

export const PLACE_BN: Record<string, string> = {
  dhaka: "ঢাকা",
  chittagong: "চট্টগ্রাম",
  khulna: "খুলনা",
  rajshahi: "রাজশাহী",
  sylhet: "সিলেট",
  barisal: "বরিশাল",
  rangpur: "রংপুর",
  mymensingh: "ময়মনসিংহ",
  "coxs-bazar": "কক্সবাজার",
  delhi: "দিল্লি",
  mumbai: "মুম্বাই",
  kolkata: "কলকাতা",
  chennai: "চেন্নাই",
  bengaluru: "বেঙ্গালুরু",
  guwahati: "গুয়াহাটি",
  shillong: "শিলং",
  patna: "পাটনা",
  karachi: "করাচি",
  lahore: "লাহোর",
  islamabad: "ইসলামাবাদ",
  kathmandu: "কাঠমান্ডু",
  pokhara: "পোখারা",
  thimphu: "থিম্পু",
  colombo: "কলম্বো",
  kandy: "ক্যান্ডি",
  yangon: "ইয়াঙ্গুন",
  kabul: "কাবুল",
  "hyderabad-india": "হায়দরাবাদ",
  "hyderabad-pakistan": "হায়দরাবাদ",
  ahmedabad: "আহমেদাবাদ",
  pune: "পুনে",
  jaipur: "জয়পুর",
  lucknow: "লখনউ",
  bhopal: "ভোপাল",
  nagpur: "নাগপুর",
  raipur: "রায়পুর",
  bhubaneswar: "ভুবনেশ্বর",
  kochi: "কোচি",
  thiruvananthapuram: "তিরুবনন্তপুরম",
  dehradun: "দেরাদুন",
  shimla: "শিমলা",
  srinagar: "শ্রীনগর",
  varanasi: "বারাণসী",
  imphal: "ইম্ফল",
  goa: "গোয়া",
  peshawar: "পেশোয়ার",
  quetta: "কোয়েটা",
  multan: "মুলতান",
  faisalabad: "ফয়সালাবাদ",
  biratnagar: "বিরাটনগর",
  jaffna: "জাফনা",
  kandahar: "কান্দাহার",
  mandalay: "মান্দালয়",
  lhasa: "লাসা",
};

export const COUNTRY_BN: Record<string, string> = {
  Bangladesh: "বাংলাদেশ",
  India: "ভারত",
  Pakistan: "পাকিস্তান",
  Nepal: "নেপাল",
  Bhutan: "ভুটান",
  "Sri Lanka": "শ্রীলঙ্কা",
  Afghanistan: "আফগানিস্তান",
  Myanmar: "মিয়ানমার",
  China: "চীন",
};

export const UNIT_BN: Record<string, string> = { "°C": "°সে", mm: "মিমি", months: "মাস", days: "দিন" };
export const unitBn = (unit: string) => UNIT_BN[unit] ?? unit;

/** Bangla definitions of the extreme measures (English ones come from the analysis manifest). */
export const DEFINITION_BN: Record<string, string> = {
  "hot-months": "যেসব মাস ১৯৫১–১৯৮০ সালের ওই মাসের গড়ের চেয়ে অন্তত ১ °সে বেশি গরম ছিল।",
  "heavy-rain": "যেসব দিনে বৃষ্টি ওই জায়গার বৃষ্টির দিনগুলোর (১ মিমি বা বেশি) শীর্ষ ৫%-এর চেয়েও বেশি।",
  "wettest-day": "প্রতি বছর একদিনে সবচেয়ে বেশি যত বৃষ্টি হয়েছে।",
  "dry-spell": "জুন–সেপ্টেম্বরে টানা যত দিন ১ মিমি-র কম বৃষ্টি হয়েছে তার দীর্ঘতম সময়: বর্ষায় বিরতি ও খরার লক্ষণ।",
};

export const AGREEMENT_BN = {
  agree: "আরেকটি স্বাধীন তথ্যসূত্রও একমত",
  partly: "আরেকটি স্বাধীন তথ্যসূত্র আংশিক একমত",
  disagree: "আরেকটি স্বাধীন তথ্যসূত্র একমত নয়",
} as const;

/** Bangla names of the climate drivers behind each hazard, by result key (e.g. "rainfall_monsoon"). */
export function driverNameBn(key: string): string {
  if (key.startsWith("sea_")) return "ঘূর্ণিঝড় মৌসুমে সাগরের উষ্ণতা";
  const names: Record<string, string> = {
    "temperature_pre-monsoon": "বর্ষার আগের তাপমাত্রা",
    "rainfall_pre-monsoon": "বর্ষার আগের বৃষ্টি",
    rainfall_monsoon: "বর্ষার বৃষ্টি",
  };
  return names[key] ?? key;
}
