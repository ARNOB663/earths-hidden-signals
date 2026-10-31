from intel.composite import combine


def comp(cid, level, direction="high", high_side="wet", counted=True, available=True):
    cls = {0: "normal", 1: "above-normal" if direction == "high" else "below-normal",
           2: "unusually-high" if direction == "high" else "unusually-low", 3: "extreme"}[level]
    return {"id": cid, "highSide": high_side, "counted": counted,
            "result": {"available": available, "level": level, "direction": direction, "class": cls}}


def test_total_normal_means_normal_even_with_a_daily_outlier():
    c = combine([comp("total", 0), comp("wettest-day", 2, "low")])
    assert c["class"] == "normal" and not c["conflicting"]


def test_single_component_cannot_be_extreme():
    c = combine([comp("total", 3)])
    assert c["class"] == "unusually-high" and c["level"] == 2


def test_extreme_needs_corroboration():
    assert combine([comp("total", 3), comp("heavy-rain", 0)])["level"] == 2
    c = combine([comp("total", 3), comp("heavy-rain", 1)])
    assert c["class"] == "extreme" and c["corroboratedBy"] == ["heavy-rain"]


def test_conflicting_components_give_normal():
    # Wet total but an unusually long dry spell (dry side when high).
    c = combine([comp("total", 2), comp("dry-spell", 2, "high", high_side="dry")])
    assert c["class"] == "normal" and c["conflicting"] is True
    assert c["conflictWith"] == ["dry-spell"]


def test_dry_spell_shorter_than_normal_supports_wet():
    c = combine([comp("total", 3), comp("dry-spell", 1, "low", high_side="dry")])
    assert c["class"] == "extreme" and c["direction"] == "high"


def test_intensity_is_never_counted():
    c = combine([comp("total", 3), comp("intensity", 3, counted=False)])
    assert c["level"] == 2  # intensity is the total divided by a constant, not corroboration
    assert "intensity" not in c["countedComponents"]


def test_dry_side_composite():
    c = combine([comp("total", 2, "low"), comp("dry-spell", 2, "high", high_side="dry")])
    assert c["class"] == "unusually-low" and c["side"] == "dry"


def test_no_total_is_unavailable():
    c = combine([comp("total", 0, available=False), comp("heavy-rain", 2)])
    assert c["available"] is False
