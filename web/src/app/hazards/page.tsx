import { ComingSoon } from "@/components/site/ComingSoon";

export default function HazardsPage() {
  return (
    <ComingSoon
      title="Hazard Signals"
      intro="How the same warming shows up as different hazards across South Asia, compared with the conditions seen before past events."
      items={[
        "Floods: rainfall, soil moisture and water storage in the major river basins and deltas",
        "Landslides: rainfall and soil saturation along the Himalaya, Western Ghats and Sri Lanka hills",
        "Wildfire: heat, dry soil and vegetation stress in the region's forest belts",
        "Evidence-based preparedness: similarity to past pre-event conditions, not a prediction",
      ]}
    />
  );
}
