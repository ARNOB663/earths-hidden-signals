// Well-known places, so a clicked map square can be described as "Around Dhaka"
// instead of by its coordinates.

const PLACES: [string, number, number][] = [
  ["Delhi", 28.61, 77.21],
  ["Dhaka", 23.81, 90.41],
  ["Karachi", 24.86, 67.01],
  ["Mumbai", 19.08, 72.88],
  ["Kathmandu", 27.72, 85.32],
  ["Colombo", 6.93, 79.86],
  ["Chennai", 13.08, 80.27],
  ["Lahore", 31.55, 74.34],
  ["Kolkata", 22.57, 88.36],
  ["Kabul", 34.53, 69.17],
  ["Islamabad", 33.68, 73.05],
  ["Hyderabad", 17.39, 78.49],
  ["Bengaluru", 12.97, 77.59],
  ["Ahmedabad", 23.02, 72.57],
  ["Patna", 25.59, 85.14],
  ["Lucknow", 26.85, 80.95],
  ["Jaipur", 26.91, 75.79],
  ["Guwahati", 26.14, 91.74],
  ["Yangon", 16.84, 96.17],
  ["Mandalay", 21.96, 96.09],
  ["Thimphu", 27.47, 89.64],
  ["Chittagong", 22.36, 91.78],
  ["Srinagar", 34.08, 74.8],
  ["Quetta", 30.18, 66.98],
  ["Peshawar", 34.01, 71.52],
  ["Multan", 30.16, 71.52],
  ["Bhopal", 23.26, 77.41],
  ["Nagpur", 21.15, 79.09],
  ["Raipur", 21.25, 81.63],
  ["Bhubaneswar", 20.3, 85.82],
  ["Kochi", 9.93, 76.27],
  ["Goa", 15.3, 74.12],
  ["Pune", 18.52, 73.86],
  ["Dehradun", 30.32, 78.03],
  ["Shimla", 31.1, 77.17],
  ["Lhasa", 29.65, 91.1],
  ["Kandahar", 31.61, 65.71],
  ["Jaffna", 9.66, 80.01],
  ["Imphal", 24.82, 93.94],
  ["Varanasi", 25.32, 82.97],
];

/** "Around Dhaka" (or "Near Dhaka") for a point; the nearest listed place within ~350 km. */
export function describePlace(lat: number, lon: number): string {
  let best: [string, number] | null = null;
  for (const [name, la, lo] of PLACES) {
    const dx = (lo - lon) * Math.cos((lat * Math.PI) / 180);
    const d = Math.hypot(la - lat, dx) * 111;
    if (!best || d < best[1]) best = [name, d];
  }
  if (!best || best[1] > 350) return `${lat.toFixed(1)}°N, ${lon.toFixed(1)}°E`;
  return best[1] < 120 ? `Around ${best[0]}` : `Near ${best[0]}`;
}
