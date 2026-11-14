"""Grouped, repeated cross-validation as fixed in RULES.md (shared procedure)."""
from dataclasses import dataclass, field
import numpy as np
import pandas as pd
from sklearn.base import clone
from sklearn.metrics import mean_absolute_error, r2_score, roc_auc_score
from sklearn.model_selection import StratifiedGroupKFold

from .estimators import Selector, predict

N_SPLITS = 5
N_BOOT = 2000


def outer_splits(strat, groups, n_repeats):
    """Yield (repeat, train_idx, test_idx). Asserts that no session is on both sides."""
    groups = np.asarray(groups)
    for r in range(n_repeats):
        cv = StratifiedGroupKFold(N_SPLITS, shuffle=True, random_state=r)
        for tr, te in cv.split(np.zeros(len(groups)), strat, groups):
            assert set(groups[tr]).isdisjoint(set(groups[te])), "a session is in both train and test"
            yield r, tr, te


def metric(task, y, p):
    return roc_auc_score(y, p) if task == "clf" else mean_absolute_error(y, p)


@dataclass
class CVResult:
    task: str
    oof: np.ndarray                       # (n_repeats, n_rows) out-of-fold predictions
    per_repeat: np.ndarray                # metric per repeat (pooled over its folds)
    chosen: list = field(default_factory=list)       # model picked in each outer fold (nested runs)
    importance: dict = field(default_factory=dict)   # input -> mean loss when permuted
    n_folds_checked: int = 0

    @property
    def score(self):
        return float(np.median(self.per_repeat))

    def pred_median(self):
        return np.median(self.oof, axis=0)


def _fold(make_est, X, y, groups, strat, task, r, k, tr, te, importance_inputs, n_perm):
    est = make_est()
    if isinstance(est, Selector):
        est.fit(X.iloc[tr], y[tr], groups[tr], strat[tr], seed=r)
        chosen = est.chosen_
    else:
        est.fit(X.iloc[tr], y[tr])
        chosen = None
    Xte, yte = X.iloc[te], y[te]
    p = predict(est, Xte)
    imp = {}
    if importance_inputs and (task != "clf" or len(np.unique(yte)) == 2):
        base = metric(task, yte, p)
        rng = np.random.default_rng(10_000 + 100 * r + k)  # fixed per (repeat, fold)
        for c in importance_inputs:
            losses = []
            for _ in range(n_perm):
                Xp = Xte.copy()
                Xp[c] = rng.permutation(Xp[c].to_numpy())
                m = metric(task, yte, predict(est, Xp))
                losses.append(base - m if task == "clf" else m - base)
            imp[c] = float(np.mean(losses))
    return r, te, p, chosen, imp


def cross_val(make_est, X, y, groups, strat, task, n_repeats, importance_inputs=None, n_perm=5, log=None, n_jobs=-1):
    """Run the outer CV, folds in parallel. make_est() returns a fresh estimator (a Selector for nested runs).
    Results do not depend on scheduling: each fold is seeded by its (repeat, fold) position."""
    from joblib import Parallel, delayed
    groups, strat = np.asarray(groups), np.asarray(strat)
    tasks, k_in_repeat = [], {}
    for r, tr, te in outer_splits(strat, groups, n_repeats):
        k = k_in_repeat.get(r, 0)
        k_in_repeat[r] = k + 1
        tasks.append((r, k, tr, te))
    outs = Parallel(n_jobs=n_jobs)(delayed(_fold)(make_est, X, y, groups, strat, task, r, k, tr, te,
                                                   importance_inputs, n_perm) for r, k, tr, te in tasks)
    oof = np.full((n_repeats, len(y)), np.nan)
    chosen, imp = [], {c: [] for c in (importance_inputs or [])}
    for r, te, p, ch, im in outs:
        oof[r, te] = p
        if ch is not None:
            chosen.append(ch)
        for c, v in im.items():
            imp[c].append(v)
    assert not np.isnan(oof).any()
    per_repeat = np.array([metric(task, y, oof[r]) for r in range(n_repeats)])
    if log:
        log(f"      {len(tasks)} outer folds; no session in both train and test (asserted on every fold)")
    return CVResult(task, oof, per_repeat, chosen, {c: float(np.mean(v)) for c, v in imp.items() if v}, len(tasks))


def fast_auc(y, p):
    """ROC AUC via the Mann-Whitney rank formula (ties get average ranks); equal to sklearn's roc_auc_score."""
    from scipy.stats import rankdata
    y = np.asarray(y)
    n1 = int(y.sum()); n0 = len(y) - n1
    ranks = rankdata(p)
    return float((ranks[y == 1].sum() - n1 * (n1 + 1) / 2) / (n1 * n0))


def session_bootstrap(res: CVResult, y, groups, seed=12345, n_boot=N_BOOT):
    """95% interval: resample sessions with replacement; replicate b uses repeat b mod n_repeats."""
    groups = np.asarray(groups)
    idx = {g: np.flatnonzero(groups == g) for g in pd.unique(groups)}
    keys = list(idx)
    rng = np.random.default_rng(seed)
    fast = fast_auc if res.task == "clf" else (lambda a, b: float(np.mean(np.abs(a - b))))
    assert abs(fast(y, res.oof[0]) - metric(res.task, y, res.oof[0])) < 1e-12, "fast metric disagrees with sklearn"
    vals = []
    b = 0
    while len(vals) < n_boot:
        pick = rng.choice(len(keys), size=len(keys), replace=True)
        rows = np.concatenate([idx[keys[i]] for i in pick])
        if res.task == "clf" and len(np.unique(y[rows])) < 2:
            continue  # redraw: a replicate with one class has no AUC
        r = b % res.oof.shape[0]
        vals.append(fast(y[rows], res.oof[r, rows]))
        b += 1
    return [float(np.percentile(vals, 2.5)), float(np.percentile(vals, 97.5))]


def shares(importance: dict, names: dict) -> list:
    """Permutation losses -> drivers [{name, share}], negatives set to 0, sorted, summing to 1."""
    pos = {k: max(v, 0.0) for k, v in importance.items()}
    tot = sum(pos.values())
    if tot <= 0:
        return [{"name": names[k], "share": 0.0} for k in importance]
    out = [{"name": names[k], "share": v / tot} for k, v in pos.items()]
    return sorted(out, key=lambda d: -d["share"])


def r2_per_repeat(res: CVResult, y):
    return np.array([r2_score(y, res.oof[r]) for r in range(res.oof.shape[0])])


def brier(y, p):
    return float(np.mean((p - y) ** 2))


def candidate_cv(est, X, y, groups, strat, task, n_repeats):
    return cross_val(lambda: clone(est), X, y, groups, strat, task, n_repeats)
