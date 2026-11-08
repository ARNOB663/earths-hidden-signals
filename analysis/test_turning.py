"""Tests for the Pettitt turning-point test."""

import numpy as np

import turning


def test_finds_a_clear_step():
    rng = np.random.default_rng(3)
    x = np.concatenate([rng.normal(0, 0.3, 20), rng.normal(2, 0.3, 25)])
    idx, _, p = turning.pettitt(x)
    assert idx == 20
    assert p < 0.001


def test_no_split_in_noise():
    rng = np.random.default_rng(4)
    ps = [turning.pettitt(rng.normal(size=45))[2] for _ in range(40)]
    # Under no change, a clear split (p < 0.05) should be rare.
    assert sum(p < 0.05 for p in ps) <= 6


def test_index_is_first_value_after_the_split():
    x = np.array([1, 1, 1, 5, 5, 5, 5], dtype=float)
    assert turning.pettitt(x)[0] == 3
