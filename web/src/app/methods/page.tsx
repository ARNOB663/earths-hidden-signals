import { ComingSoon } from "@/components/site/ComingSoon";

export default function MethodsPage() {
  return (
    <ComingSoon
      title="Methods"
      intro="How we get from satellite data to a trustworthy trend, and what we are careful not to claim."
      items={[
        "Datasets: MODIS, MERRA-2, GLDAS, GPM IMERG, GRACE and Landsat-based forest change",
        "Seasonal handling: annual or seasonal aggregates, or the Seasonal Kendall test",
        "Autocorrelation-aware Mann-Kendall and a false-discovery-rate correction for per-pixel maps",
        "What 'not significant' means, and why correlation is not causation",
      ]}
    />
  );
}
