from global_signals import parse_co2, parse_sea_ice

SEA_ICE = """year, mo,source_dataset, region, extent,   area
1979,  9,    NSIDC-0051,      N,   7.05,   4.58
1980,  9,    NSIDC-0051,      N,  -9999,  -9999
2025,  9,    NSIDC-0803,      N,   4.75,   3.08
"""

CO2 = "# comment\n# more\nyear,month,decimal,average,average_unc,trend,trend_unc\n" + "\n".join(
    [f"2000,{m},2000.0,{360 + m},0.1,360,0.1" for m in range(1, 13)] + [f"2001,{m},2001.0,370,0.1,370,0.1" for m in range(1, 7)]
)


def test_sea_ice_reads_september_extent_and_skips_missing():
    assert parse_sea_ice(SEA_ICE) == {1979: 7.05, 2025: 4.75}


def test_co2_annual_mean_needs_all_twelve_months():
    out = parse_co2(CO2)
    assert out == {2000: 366.5}  # 2001 has only six months
