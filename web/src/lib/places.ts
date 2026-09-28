// Well-known places: used to name clicked map squares ("Around Dhaka") and for place reports.

export interface Place {
  id: string;
  name: string;
  country: string;
  lat: number;
  lon: number;
}

const P = (name: string, country: string, lat: number, lon: number, id?: string): Place => ({
  id:
    id ??
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, ""),
  name,
  country,
  lat,
  lon,
});

export const PLACES: Place[] = [
  // Bangladesh
  P("Dhaka", "Bangladesh", 23.81, 90.41),
  P("Chittagong", "Bangladesh", 22.36, 91.78),
  P("Khulna", "Bangladesh", 22.85, 89.54),
  P("Rajshahi", "Bangladesh", 24.37, 88.6),
  P("Sylhet", "Bangladesh", 24.9, 91.87),
  P("Barisal", "Bangladesh", 22.7, 90.37),
  P("Rangpur", "Bangladesh", 25.74, 89.28),
  P("Mymensingh", "Bangladesh", 24.75, 90.41),
  P("Cox's Bazar", "Bangladesh", 21.43, 92.01, "coxs-bazar"),
  // India
  P("Delhi", "India", 28.61, 77.21),
  P("Mumbai", "India", 19.08, 72.88),
  P("Kolkata", "India", 22.57, 88.36),
  P("Chennai", "India", 13.08, 80.27),
  P("Bengaluru", "India", 12.97, 77.59),
  P("Hyderabad", "India", 17.39, 78.49, "hyderabad-india"),
  P("Ahmedabad", "India", 23.02, 72.57),
  P("Pune", "India", 18.52, 73.86),
  P("Jaipur", "India", 26.91, 75.79),
  P("Lucknow", "India", 26.85, 80.95),
  P("Patna", "India", 25.59, 85.14),
  P("Guwahati", "India", 26.14, 91.74),
  P("Bhopal", "India", 23.26, 77.41),
  P("Nagpur", "India", 21.15, 79.09),
  P("Raipur", "India", 21.25, 81.63),
  P("Bhubaneswar", "India", 20.3, 85.82),
  P("Kochi", "India", 9.93, 76.27),
  P("Thiruvananthapuram", "India", 8.52, 76.94),
  P("Dehradun", "India", 30.32, 78.03),
  P("Shimla", "India", 31.1, 77.17),
  P("Srinagar", "India", 34.08, 74.8),
  P("Varanasi", "India", 25.32, 82.97),
  P("Imphal", "India", 24.82, 93.94),
  P("Shillong", "India", 25.58, 91.89),
  P("Goa", "India", 15.49, 73.83),
  // Pakistan
  P("Karachi", "Pakistan", 24.86, 67.01),
  P("Lahore", "Pakistan", 31.55, 74.34),
  P("Islamabad", "Pakistan", 33.68, 73.05),
  P("Peshawar", "Pakistan", 34.01, 71.52),
  P("Quetta", "Pakistan", 30.18, 66.98),
  P("Multan", "Pakistan", 30.16, 71.52),
  P("Faisalabad", "Pakistan", 31.42, 73.08),
  P("Hyderabad", "Pakistan", 25.4, 68.37, "hyderabad-pakistan"),
  // Nepal, Bhutan, Sri Lanka
  P("Kathmandu", "Nepal", 27.72, 85.32),
  P("Pokhara", "Nepal", 28.21, 83.99),
  P("Biratnagar", "Nepal", 26.45, 87.27),
  P("Thimphu", "Bhutan", 27.47, 89.64),
  P("Colombo", "Sri Lanka", 6.93, 79.86),
  P("Kandy", "Sri Lanka", 7.29, 80.63),
  P("Jaffna", "Sri Lanka", 9.66, 80.01),
  // Neighbours inside the study area
  P("Kabul", "Afghanistan", 34.53, 69.17),
  P("Kandahar", "Afghanistan", 31.61, 65.71),
  P("Yangon", "Myanmar", 16.84, 96.17),
  P("Mandalay", "Myanmar", 21.96, 96.09),
  P("Lhasa", "China", 29.65, 91.1),
];

export const placeById = (id: string) => PLACES.find((p) => p.id === id);

export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dx = (lon2 - lon1) * Math.cos((((lat1 + lat2) / 2) * Math.PI) / 180);
  return Math.hypot(lat2 - lat1, dx) * 111.2;
}

/** "Around Dhaka" (or "Near Dhaka") for a point; the nearest listed place within ~350 km. */
export function describePlace(lat: number, lon: number): string {
  let best: [string, number] | null = null;
  for (const p of PLACES) {
    const d = distanceKm(lat, lon, p.lat, p.lon);
    if (!best || d < best[1]) best = [p.name, d];
  }
  if (!best || best[1] > 350) return `${lat.toFixed(1)}°N, ${lon.toFixed(1)}°E`;
  return best[1] < 120 ? `Around ${best[0]}` : `Near ${best[0]}`;
}
