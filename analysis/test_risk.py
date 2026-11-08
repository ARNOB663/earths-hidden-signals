"""Tests for the hazard risk model's validation maths (offline, synthetic data)."""

import numpy as np

import risk


def test_lpo_auc_is_one_for_perfect_separation():
    X = np.array([[-2.0], [-1.5], [-1.0], [-0.5], [1.0], [1.5], [2.0]])
    y = np.array([0, 0, 0, 0, 1, 1, 1])
    assert risk.lpo_auc(X, y) == 1.0


def test_lpo_auc_is_near_half_for_noise_where_loo_is_biased_low():
    rng = np.random.default_rng(0)
    aucs = []
    for _ in range(30):
        X = rng.normal(size=(24, 1))
        y = np.array([1] * 6 + [0] * 18)
        aucs.append(risk.lpo_auc(X, y))
    # No signal: leave-pair-out should centre on 0.5 (pooled leave-one-out drifts towards 0).
    assert 0.35 < float(np.mean(aucs)) < 0.65


def test_bh_adjust_matches_hand_computation():
    adj = risk.bh_adjust([0.02, 0.2, 0.3, 0.5])
    # 0.02*4/1=0.08, 0.2*4/2=0.4, 0.3*4/3=0.4, 0.5*4/4=0.5 (monotone)
    assert np.allclose(adj, [0.08, 0.4, 0.4, 0.5])


def test_bh_adjust_keeps_input_order_and_caps_at_one():
    adj = risk.bh_adjust([0.9, 0.01, 0.95])
    assert adj[1] < adj[0] <= 1.0 and adj[2] <= 1.0


def test_shift_applies_absolute_and_relative_changes():
    raw = np.array([[30.0, 100.0], [31.0, 200.0]])
    keys = ["temperature_pre-monsoon", "rainfall_pre-monsoon"]
    metrics = {"preTemp": {"perModel": {"M": 2.0}}, "preRain": {"perModel": {"M": -10.0}}}
    outlook = {"metrics": {"preTemp": {"kind": "abs"}, "preRain": {"kind": "pct"}}}
    out = risk.shift(raw, keys, metrics, "M", outlook, {"preTemp": 30, "preRain": 150})
    assert np.allclose(out[:, 0], [32.0, 33.0])
    assert np.allclose(out[:, 1], [90.0, 180.0])


def test_loyo_baseline_is_training_base_rate():
    X = np.zeros((4, 1))
    y = np.array([1, 0, 0, 0])
    years = np.array([2000, 2001, 2002, 2003])
    _, base = risk.loyo(X, y, years)
    assert np.allclose(base, [0.0, 1 / 3, 1 / 3, 1 / 3])
