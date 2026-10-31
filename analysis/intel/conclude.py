"""Structured conclusions (conclusion-v1): seven questions, English and Bangla, from computed values only.

The web app renders these strings; it never recomputes a class or threshold.
"""

from __future__ import annotations

from .confidence import weakest
from .periods import bn_num, label
from .thresholds import LEVELS, THRESHOLDS_ID

FIELDS = ["situation", "normality", "magnitude", "development", "hazards", "reliability", "actions"]
DISCLAIMER_EN = "A screening indicator derived from observations; it is not a forecast, a probability, or an official warning."
DISCLAIMER_BN = "পর্যবেক্ষণ থেকে তৈরি একটি স্ক্রিনিং সূচক; এটি পূর্বাভাস, সম্ভাবনা বা আনুষ্ঠানিক সতর্কতা নয়।"

CLASS_EN = {"normal": "normal", "above-normal": "above normal", "below-normal": "below normal",
            "unusually-high": "unusually high", "unusually-low": "unusually low"}
CLASS_BN = {"normal": "স্বাভাবিক", "above-normal": "স্বাভাবিকের চেয়ে বেশি", "below-normal": "স্বাভাবিকের চেয়ে কম",
            "unusually-high": "অস্বাভাবিক বেশি", "unusually-low": "অস্বাভাবিক কম"}
TEMP_EN = {0: "near-normal temperature", 1: "warmer than normal", 2: "unusually warm", 3: "extremely warm",
           -1: "cooler than normal", -2: "unusually cool", -3: "extremely cool"}
TEMP_BN = {0: "তাপমাত্রা প্রায় স্বাভাবিক", 1: "স্বাভাবিকের চেয়ে উষ্ণ", 2: "অস্বাভাবিক উষ্ণ", 3: "চরম উষ্ণ",
           -1: "স্বাভাবিকের চেয়ে শীতল", -2: "অস্বাভাবিক শীতল", -3: "চরম শীতল"}
RAIN_EN = {0: "near-normal rainfall", 1: "wetter than normal", 2: "unusually wet", 3: "extremely wet",
           -1: "drier than normal", -2: "unusually dry", -3: "extremely dry"}
RAIN_BN = {0: "বৃষ্টি প্রায় স্বাভাবিক", 1: "স্বাভাবিকের চেয়ে বেশি বৃষ্টি", 2: "অস্বাভাবিক বেশি বৃষ্টি", 3: "চরম বেশি বৃষ্টি",
           -1: "স্বাভাবিকের চেয়ে কম বৃষ্টি", -2: "অস্বাভাবিক কম বৃষ্টি", -3: "চরম কম বৃষ্টি"}
HAZARD_EN = {"heat": "Heat (seasonal warmth vs baseline; heatwaves not assessed)", "dry": "Dry conditions", "flood": "Flood",
             "landslide": "Landslide", "wildfire": "Wildfire", "cyclone": "Cyclone"}
HAZARD_BN = {"heat": "তাপ (মৌসুমি উষ্ণতা বনাম বেসলাইন; তাপপ্রবাহ মূল্যায়ন করা হয়নি)", "dry": "শুষ্ক অবস্থা", "flood": "বন্যা",
             "landslide": "ভূমিধস", "wildfire": "দাবানল", "cyclone": "ঘূর্ণিঝড়"}
LEVEL_EN = {"quiet": "quiet", "notable": "notable", "elevated": "elevated", "high": "high"}
LEVEL_BN = {"quiet": "শান্ত", "notable": "লক্ষণীয়", "elevated": "বর্ধিত", "high": "উচ্চ"}
GRADE_BN = {"high": "উচ্চ", "moderate": "মাঝারি", "low": "নিম্ন", "insufficient": "অপর্যাপ্ত"}
CONF_EN = {"observation": "observation quality", "anomaly": "anomaly assessment", "hazard": "hazard screening", "validation": "validation"}
CONF_BN = {"observation": "পর্যবেক্ষণের মান", "anomaly": "অস্বাভাবিকতার মূল্যায়ন", "hazard": "দুর্যোগ স্ক্রিনিং", "validation": "যাচাইকরণ"}
COMPONENT_EN = {"total": "rainfall total", "heavy-rain": "very heavy rain days", "wettest-day": "wettest day",
                "dry-spell": "longest monsoon dry spell", "intensity": "mean daily intensity"}
COMPONENT_BN = {"total": "মোট বৃষ্টি", "heavy-rain": "অতি ভারী বৃষ্টির দিন", "wettest-day": "সবচেয়ে বৃষ্টির দিন",
                "dry-spell": "বর্ষার দীর্ঘতম শুষ্ক সময়", "intensity": "গড় দৈনিক তীব্রতা"}


def _signed(rec: dict) -> int:
    if not rec or not rec.get("available") or not rec.get("level"):
        return 0
    return rec["level"] if rec["direction"] == "high" else -rec["level"]


def class_en(rec: dict) -> str:
    if not rec or not rec.get("class"):
        return "not available"
    if rec["class"] == "extreme":
        return f"extremely {'high' if rec['direction'] == 'high' else 'low'}"
    return CLASS_EN[rec["class"]]


def class_bn(rec: dict) -> str:
    if not rec or not rec.get("class"):
        return "পাওয়া যায়নি"
    if rec["class"] == "extreme":
        return "চরম বেশি" if rec["direction"] == "high" else "চরম কম"
    return CLASS_BN[rec["class"]]


def _num(v: float, d: int, signed: bool = False) -> str:
    s = f"{v:+,.{d}f}" if signed else f"{v:,.{d}f}"
    return s.replace("-", "−")


def _pct_en(rec: dict) -> str:
    return f"P≈{rec['percentile']:.0f} of {rec['baseline']['n']} baseline years"


def _pct_bn(rec: dict) -> str:
    return f"P≈{bn_num(round(rec['percentile']))}, {bn_num(rec['baseline']['n'])} বছরের বেসলাইন"


def _temp_sentence(rec: dict, lang: str) -> str:
    if not rec or not rec.get("available"):
        return "temperature not available" if lang == "en" else "তাপমাত্রার তথ্য নেই"
    d = _num(rec["difference"], 2, True)
    if lang == "en":
        return f"surface temperature was {d} °C compared with the 1991–2020 average"
    return f"ভূপৃষ্ঠের তাপমাত্রা ১৯৯১–২০২০ সালের গড়ের তুলনায় {bn_num(d)} °সে"


def _rain_sentence(rec: dict, lang: str) -> str:
    if not rec or not rec.get("available"):
        return "rainfall not available" if lang == "en" else "বৃষ্টির তথ্য নেই"
    v = _num(rec["value"], 0)
    if lang == "en":
        return f"rainfall was {v} mm ({rec['ratioPct']}% of the 1991–2020 average)"
    return f"বৃষ্টি {bn_num(v)} মিমি (১৯৯১–২০২০ সালের গড়ের {bn_num(rec['ratioPct'])}%)"


def latest_monthly(ind: dict, var: str) -> dict | None:
    """The most recent available monthly indicator for a variable (present only after --refresh)."""
    recs = [r for k, r in ind.items() if k.startswith(f"{var}_") and k.split("_")[1].isdigit() and r.get("available")]
    return max(recs, key=lambda r: r["observedThrough"], default=None)


def overall_level(hazards: list[dict], indicators: list[dict]) -> str:
    sev = {h["severity"] for h in hazards if h.get("severity")}
    if "warning" in sev:
        return "high"
    if "watch" in sev:
        return "elevated"
    if "info" in sev or any(r.get("available") and r.get("level", 0) >= 2 for r in indicators):
        return "notable"
    return "quiet"


def actions(hazards: list[dict], sources: list[dict]) -> list[dict]:
    names_en = ", ".join(s["name"] for s in sources[:-1]) or "your national meteorological service"
    names_bn = ", ".join(s["nameBn"] for s in sources[:-1]) or "আপনার দেশের জাতীয় আবহাওয়া দপ্তর"
    out = [{"id": "official-first",
            "en": f"Follow forecasts and warnings from {names_en}. This page is a screening summary, not a warning.",
            "bn": f"{names_bn}-এর পূর্বাভাস ও সতর্কতা অনুসরণ করুন। এই পাতা একটি স্ক্রিনিং সারাংশ, সতর্কতা নয়।"}]
    flagged = {h["hazard"] for h in hazards if h.get("severity") in ("watch", "warning")}
    if "heat" in flagged:
        out.append({"id": "heat", "en": "Plan for heat: check official heat advisories, keep water and shade available for outdoor work, and check on older people, young children and the sick.",
                    "bn": "গরমের জন্য প্রস্তুতি নিন: আনুষ্ঠানিক তাপ-পরামর্শ দেখুন, বাইরের কাজে পানি ও ছায়ার ব্যবস্থা রাখুন, বয়স্ক, শিশু ও অসুস্থদের খোঁজ নিন।"})
    if flagged & {"flood", "landslide"}:
        out.append({"id": "wet", "en": "Before and during the monsoon, check river and landslide warnings, know your evacuation route, and keep documents and medicines in a waterproof bag.",
                    "bn": "বর্ষার আগে ও সময়ে নদী ও ভূমিধসের সতর্কতা দেখুন, সরে যাওয়ার পথ জেনে রাখুন, কাগজপত্র ও ওষুধ পানিরোধী ব্যাগে রাখুন।"})
    if "dry" in flagged:
        out.append({"id": "dry", "en": "Follow agricultural and water advisories; plan water storage and irrigation for a weak monsoon.",
                    "bn": "কৃষি ও পানি বিষয়ক পরামর্শ অনুসরণ করুন; দুর্বল বর্ষার জন্য পানি সংরক্ষণ ও সেচের পরিকল্পনা করুন।"})
    if "wildfire" in flagged:
        out.append({"id": "wildfire", "en": "In the pre-monsoon, follow forest-department fire notices and avoid open burning.",
                    "bn": "প্রাক-বর্ষায় বন বিভাগের আগুন সংক্রান্ত নোটিশ মেনে চলুন এবং খোলা জায়গায় আগুন জ্বালানো এড়িয়ে চলুন।"})
    if "cyclone" in flagged:
        out.append({"id": "cyclone", "en": "Know your nearest cyclone shelter and follow official cyclone bulletins in the cyclone seasons (Apr–Jun, Oct–Dec).",
                    "bn": "নিকটতম ঘূর্ণিঝড় আশ্রয়কেন্দ্র জেনে রাখুন এবং ঘূর্ণিঝড় মৌসুমে (এপ্রিল–জুন, অক্টোবর–ডিসেম্বর) আনুষ্ঠানিক বুলেটিন অনুসরণ করুন।"})
    if len(out) == 1:
        out.append({"id": "routine", "en": "No screening flag: keep normal seasonal preparedness and keep following official forecasts.",
                    "bn": "কোনো স্ক্রিনিং সংকেত নেই: স্বাভাবিক মৌসুমি প্রস্তুতি বজায় রাখুন এবং আনুষ্ঠানিক পূর্বাভাস অনুসরণ করুন।"})
    return out


def build(*, location: dict, source: dict, ind: dict[str, dict], comp: dict[str, dict], hazards: list[dict],
          confidences: dict[str, dict], trend: dict | None, as_of: str) -> dict:
    """ind/comp: indicator and composite records of the source geography, keyed 'var_period'."""
    t_ann, t_mon = ind.get("temperature_annual"), ind.get("temperature_monsoon")
    r_ann, r_mon = ind.get("rainfall_annual"), ind.get("rainfall_monsoon")
    c_ann, c_mon = comp.get("annual"), comp.get("monsoon")
    year = t_ann["year"] if t_ann else r_ann["year"]
    name, name_bn = location["name"], location["nameBn"]

    prefix_en = prefix_bn = ""
    if location["kind"] == "city":
        prefix_en = f"Estimate for {source['name']} ({location['geography']['resolutionLabelEn']}); not a measurement of {name}. "
        prefix_bn = f"{source['nameBn']}-এর জন্য অনুমান ({location['geography']['resolutionLabelBn']}); {name_bn}-এর পরিমাপ নয়। "

    situation_en = (f"{prefix_en}In {year}, {_temp_sentence(t_ann, 'en')}, and {_rain_sentence(r_ann, 'en')}. "
                    f"In {label('monsoon', year)}, {_temp_sentence(t_mon, 'en')} "
                    f"and {_rain_sentence(r_mon, 'en')}. These are climate-scale observations from monthly analyses published weeks to months after the period, not current weather.")
    situation_bn = (f"{prefix_bn}{bn_num(year)} সালে {_temp_sentence(t_ann, 'bn')} এবং {_rain_sentence(r_ann, 'bn')}। "
                    f"{label('monsoon', year, 'bn')}-এ {_temp_sentence(t_mon, 'bn')} এবং {_rain_sentence(r_mon, 'bn')}। "
                    "এগুলো মাসিক বিশ্লেষণ থেকে পাওয়া জলবায়ু-মাত্রার পর্যবেক্ষণ, যা সময়কালের কয়েক সপ্তাহ থেকে কয়েক মাস পরে প্রকাশিত হয়; এটি বর্তমান আবহাওয়া নয়।")

    def comp_en(c):
        if not c or not c.get("available"):
            return "not available"
        if c["conflicting"]:
            return "normal overall, with components pointing in opposite directions"
        if not c["level"]:
            return f"{class_en(c)} (rainfall total; {c['usable']} counted component{'s' if c['usable'] != 1 else ''})"
        sup = c.get("corroboratedBy") or []
        dom = ("corroborated by the " + " and the ".join(COMPONENT_EN[x] for x in sup)) if sup else "rainfall total only, not corroborated"
        return f"{class_en(c)} ({dom})"

    def comp_bn(c):
        if not c or not c.get("available"):
            return "পাওয়া যায়নি"
        if c["conflicting"]:
            return "সামগ্রিকভাবে স্বাভাবিক, উপাদানগুলো বিপরীত দিক দেখায়"
        if not c["level"]:
            return f"{class_bn(c)} (মোট বৃষ্টি; {bn_num(c['usable'])}টি উপাদান গণনা)"
        sup = c.get("corroboratedBy") or []
        dom = ("সমর্থন: " + " ও ".join(COMPONENT_BN[x] for x in sup)) if sup else "শুধু মোট বৃষ্টি, সমর্থন নেই"
        return f"{class_bn(c)} ({dom})"

    normality_en = (f"Temperature in {year}: {class_en(t_ann)}" + (f" ({_pct_en(t_ann)}, baseline 1991–2020)" if t_ann and t_ann.get("available") else "") +
                    f". Monsoon temperature: {class_en(t_mon)}. Rainfall in {year}: {comp_en(c_ann)}. Monsoon rainfall: {comp_en(c_mon)}.")
    normality_bn = (f"{bn_num(year)} সালের তাপমাত্রা: {class_bn(t_ann)}" + (f" ({_pct_bn(t_ann)}, বেসলাইন ১৯৯১–২০২০)" if t_ann and t_ann.get("available") else "") +
                    f"। বর্ষার তাপমাত্রা: {class_bn(t_mon)}। {bn_num(year)} সালের বৃষ্টি: {comp_bn(c_ann)}। বর্ষার বৃষ্টি: {comp_bn(c_mon)}।")

    def mag_en(rec, unit, word):
        if not rec or not rec.get("available"):
            return f"{word}: not available."
        z = "" if rec["zScore"] is None else f"; z = {_num(rec['zScore'], 2, True)} (supplementary)"
        ratio = f" ({rec['ratioPct']}% of average)" if rec.get("ratioPct") is not None else ""
        return (f"{word}: {_num(rec['difference'], 2 if unit == '°C' else 0, True)} {unit} vs the baseline mean{ratio}; "
                f"rank {rec['rankHigh']} of {rec['rankOf']} (1 = highest, this year and {rec['baseline']['n']} baseline years){z}.")

    def mag_bn(rec, unit, word):
        if not rec or not rec.get("available"):
            return f"{word}: তথ্য নেই।"
        z = "" if rec["zScore"] is None else f"; z = {bn_num(format(rec['zScore'], '+.2f'))} (সহায়ক)"
        unit_bn = "°সে" if unit == "°C" else "মিমি"
        return (f"{word}: বেসলাইন গড়ের তুলনায় {bn_num(_num(rec['difference'], 2 if unit == '°C' else 0, True))} {unit_bn}; "
                f"{bn_num(rec['rankOf'])}টির মধ্যে {bn_num(rec['rankHigh'])} নম্বর (১ = সর্বোচ্চ){z}।")

    magnitude_en = " ".join([mag_en(t_ann, "°C", f"Temperature {year}"), mag_en(r_ann, "mm", f"Rainfall {year}"),
                             mag_en(r_mon, "mm", "Monsoon rainfall")])
    magnitude_bn = " ".join([mag_bn(t_ann, "°C", f"তাপমাত্রা {bn_num(year)}"), mag_bn(r_ann, "mm", f"বৃষ্টি {bn_num(year)}"),
                             mag_bn(r_mon, "mm", "বর্ষার বৃষ্টি")])

    def dev_en(rec, what):
        if not rec or not rec.get("available"):
            return ""
        run = rec["duration"]["periods"]
        if run == 0:
            return f"{what} is within the normal range this period."
        side = "above" if rec["direction"] == "high" else "below"
        return f"{what} has been {side} normal or further for {run} consecutive year{'s' if run != 1 else ''} (since {rec['duration']['sinceYear']})."

    def dev_bn(rec, what):
        if not rec or not rec.get("available"):
            return ""
        run = rec["duration"]["periods"]
        if run == 0:
            return f"এই সময়ে {what} স্বাভাবিক সীমার মধ্যে।"
        side = "স্বাভাবিকের বেশি" if rec["direction"] == "high" else "স্বাভাবিকের কম"
        return f"{what} টানা {bn_num(run)} বছর ধরে {side} ({bn_num(rec['duration']['sinceYear'])} থেকে)।"

    dev_en_parts = [dev_en(t_ann, "Annual temperature"), dev_en(c_mon, "Monsoon rainfall") if c_mon else ""]
    dev_bn_parts = [dev_bn(t_ann, "বার্ষিক তাপমাত্রা"), dev_bn(c_mon, "বর্ষার বৃষ্টি") if c_mon else ""]
    if trend:
        slope = _num(trend["slopePerDecade"], 2, True)
        dev_en_parts.append(f"Long-term context, kept separate from this observation: temperature trend 1981–2025 {slope} °C per decade (Mann–Kendall p = {trend['p']:.3f}).")
        dev_bn_parts.append(f"দীর্ঘমেয়াদি প্রেক্ষাপট (এই পর্যবেক্ষণ থেকে আলাদা): ১৯৮১–২০২৫ সালে তাপমাত্রার প্রবণতা প্রতি দশকে {bn_num(slope)} °সে।")

    hz = []
    for h in hazards:
        lvl = h["level"]
        sev_en = f" ({h['severity']})" if h.get("severity") else ""
        why_en = h.get("whyEn", "")
        why_bn = h.get("whyBn", "")
        hz.append({"hazard": h["hazard"], "level": lvl,
                   "en": f"{HAZARD_EN[h['hazard']]}: {LEVEL_EN[lvl]}{sev_en}. {why_en} {DISCLAIMER_EN}".replace("  ", " "),
                   "bn": f"{HAZARD_BN[h['hazard']]}: {LEVEL_BN[lvl]}। {why_bn} {DISCLAIMER_BN}".replace("  ", " ")})

    wname, wconf = weakest(confidences)
    rel_en = ("; ".join(f"{CONF_EN[k]}: {v['grade']}" for k, v in confidences.items()) +
              f". Weakest link: {CONF_EN[wname]} ({wconf['grade']}) — {wconf['reasons'][0]['textEn']}")
    rel_bn = ("; ".join(f"{CONF_BN[k]}: {GRADE_BN[v['grade']]}" for k, v in confidences.items()) +
              f"। দুর্বলতম অংশ: {CONF_BN[wname]} ({GRADE_BN[wconf['grade']]}) — {wconf['reasons'][0]['textBn']}")

    level = overall_level(hazards, [t_ann or {}, t_mon or {}, c_ann or {}, c_mon or {}])
    flagged = sorted((h for h in hazards if h.get("severity")), key=lambda h: -LEVELS.index(h["level"]))
    hz_en = f"{flagged[0]['hazard']} {flagged[0]['severity']}" if flagged else "no hazard flag"
    hz_bn = (f"{HAZARD_BN[flagged[0]['hazard']].split(' (')[0]} {LEVEL_BN[flagged[0]['level']]}" if flagged else "কোনো দুর্যোগ সংকেত নেই")
    t_word = TEMP_EN[_signed(t_ann)]
    r_word = "mixed rainfall signals" if c_ann and c_ann.get("conflicting") else RAIN_EN[_signed(c_ann)]
    headline_en = f"{name}, {year}: {t_word}, {r_word}; screening: {hz_en}."
    if len(headline_en) > 140:
        headline_en = f"{name}, {year}: {t_word}, {r_word}."
    t_bn = TEMP_BN[_signed(t_ann)]
    r_bn = "বৃষ্টির সংকেত মিশ্র" if c_ann and c_ann.get("conflicting") else RAIN_BN[_signed(c_ann)]
    headline_bn = f"{name_bn}, {bn_num(year)}: {t_bn}, {r_bn}; স্ক্রিনিং: {hz_bn}।"
    if len(headline_bn) > 140:
        headline_bn = f"{name_bn}, {bn_num(year)}: {t_bn}, {r_bn}।"

    evidence = [r["id"] for r in (t_ann, t_mon, r_ann, r_mon) if r] + [c["id"] for c in (c_ann, c_mon) if c]
    monthly_t = latest_monthly(ind, "temperature")
    monthly_r = latest_monthly(ind, "rainfall")
    if monthly_t or monthly_r:
        parts_en, parts_bn = [], []
        if monthly_t:
            parts_en.append(f"in {label(monthly_t['period'], monthly_t['year'])} temperature was {class_en(monthly_t)} ({_pct_en(monthly_t)})")
            parts_bn.append(f"{label(monthly_t['period'], monthly_t['year'], 'bn')}-এ তাপমাত্রা {class_bn(monthly_t)} ({_pct_bn(monthly_t)})")
            evidence.append(monthly_t["id"])
        if monthly_r:
            parts_en.append(f"in {label(monthly_r['period'], monthly_r['year'])} {_rain_sentence(monthly_r, 'en')}, {class_en(monthly_r)}")
            parts_bn.append(f"{label(monthly_r['period'], monthly_r['year'], 'bn')}-এ {_rain_sentence(monthly_r, 'bn')}, {class_bn(monthly_r)}")
            evidence.append(monthly_r["id"])
        situation_en += " Latest months: " + "; ".join(parts_en) + "."
        situation_bn += " সর্বশেষ মাস: " + "; ".join(parts_bn) + "।"
    observed_through = max((r["observedThrough"] for r in (t_ann, r_ann) if r), default=None)
    age = max((r["ageDays"] for r in (t_ann, r_ann) if r), default=None)
    return {
        "schema": "conclusion-v1",
        "locationId": location["id"],
        "level": level,
        "headline": {"en": headline_en, "bn": headline_bn},
        "situation": {"en": situation_en, "bn": situation_bn},
        "normality": {"en": normality_en, "bn": normality_bn},
        "magnitude": {"en": magnitude_en, "bn": magnitude_bn},
        "development": {"en": " ".join(p for p in dev_en_parts if p), "bn": " ".join(p for p in dev_bn_parts if p)},
        "hazards": hz,
        "reliability": {"en": rel_en, "bn": rel_bn, "weakest": wname},
        "actions": actions(hazards, location["officialSources"]),
        "observedThrough": observed_through,
        "dataAgeDays": age,
        "assessedAt": as_of,
        "evidenceIds": evidence,
        "thresholdsId": THRESHOLDS_ID,
    }


def missing_fields(c: dict) -> list[str]:
    """Fields among the seven questions that are absent or empty (used by tests and the pipeline)."""
    bad = []
    for f in FIELDS:
        v = c.get(f)
        if isinstance(v, list):
            if not v or any(not x.get("en") or not x.get("bn") for x in v):
                bad.append(f)
        elif not v or not v.get("en") or not v.get("bn"):
            bad.append(f)
    return bad
