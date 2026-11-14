"""Candidate models and baselines. Every estimator takes the raw input DataFrame, so permutation
importance is always measured on the same named inputs whatever features a model builds inside."""
import warnings
import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, clone
from sklearn.exceptions import ConvergenceWarning
from sklearn.gaussian_process import GaussianProcessClassifier, GaussianProcessRegressor
from sklearn.gaussian_process.kernels import ConstantKernel, Matern, WhiteKernel
from sklearn.linear_model import LogisticRegression, Ridge
from sklearn.metrics import mean_absolute_error, roc_auc_score
from sklearn.model_selection import StratifiedGroupKFold
from sklearn.preprocessing import StandardScaler

from . import physics as ph

FLEX_INPUTS = ["x_o2", "x_co2", "x_he", "p_atm", "d0_mm", "heptane"]
CFI_INPUTS = ["p_atm", "x_o2", "x_he", "d0_mm", "dodecane_frac", "fiber"]


# ------------------------------------------------------------------ feature builders (raw -> matrix)
def feats_raw(X: pd.DataFrame, cols) -> np.ndarray:
    return X[list(cols)].to_numpy(float)


def feats_flex_interact(X: pd.DataFrame) -> np.ndarray:
    """(a) raw FLEX inputs plus heptane x O2 and heptane x d0."""
    h = X["heptane"].to_numpy(float)
    return np.column_stack([feats_raw(X, FLEX_INPUTS), h * X["x_o2"].to_numpy(float), h * X["d0_mm"].to_numpy(float)])


def feats_flex_physics(X: pd.DataFrame) -> np.ndarray:
    """(b) inert heat capacity per mole O2, O2 partial pressure, mixture k/cp relative to air, d0, fuel, fuel x d0."""
    o2, co2, he = (X[c].to_numpy(float) for c in ("x_o2", "x_co2", "x_he"))
    h, d0 = X["heptane"].to_numpy(float), X["d0_mm"].to_numpy(float)
    return np.column_stack([
        ph.inert_heat_capacity_per_o2(o2, co2, he), o2 * X["p_atm"].to_numpy(float),
        ph.k_over_cp_rel_air(o2, co2, he), d0, h, h * d0,
    ])


FEATURES = {
    "flex_interact": feats_flex_interact,
    "flex_physics": feats_flex_physics,
    "flex_raw": lambda X: feats_raw(X, FLEX_INPUTS),
    "cfi_raw": lambda X: feats_raw(X, CFI_INPUTS),
}


# ------------------------------------------------------------------ classifiers
class Logit(BaseEstimator):
    """Standardised features + L2 logistic regression."""

    def __init__(self, features="flex_interact", C=1.0):
        self.features, self.C = features, C

    def fit(self, X, y):
        Z = FEATURES[self.features](X)
        self.scaler_ = StandardScaler().fit(Z)
        self.lr_ = LogisticRegression(C=self.C, max_iter=10000).fit(self.scaler_.transform(Z), y)
        return self

    def predict_proba1(self, X):
        return self.lr_.predict_proba(self.scaler_.transform(FEATURES[self.features](X)))[:, 1]

    def describe(self):
        return f"logistic regression ({self.features.replace('_', ' ')}, C={self.C:g})"


class GPClassifier(BaseEstimator):
    """Standardised raw inputs + Gaussian-process classifier, Matern(nu=1.5) with one length scale per input."""

    def __init__(self, features="flex_raw"):
        self.features = features

    def fit(self, X, y):
        Z = FEATURES[self.features](X)
        self.scaler_ = StandardScaler().fit(Z)
        kernel = ConstantKernel(1.0, (1e-2, 1e2)) * Matern(np.ones(Z.shape[1]), (1e-2, 1e3), nu=1.5)
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", ConvergenceWarning)
            self.gp_ = GaussianProcessClassifier(kernel, random_state=0, n_restarts_optimizer=0).fit(self.scaler_.transform(Z), y)
        return self

    def predict_proba1(self, X):
        return self.gp_.predict_proba(self.scaler_.transform(FEATURES[self.features](X)))[:, 1]

    def describe(self):
        return "Gaussian-process classifier (Matern, one length scale per input)"


class SingleVariable(BaseEstimator):
    """Baseline: the one input with the best training AUC, turned into a probability by a 1-D logistic fit."""

    def __init__(self, inputs=tuple(FLEX_INPUTS)):
        self.inputs = inputs

    def fit(self, X, y):
        aucs = {}
        for c in self.inputs:
            v = X[c].to_numpy(float)
            aucs[c] = max(roc_auc_score(y, v), 1 - roc_auc_score(y, v)) if np.ptp(v) > 0 else 0.5
        self.col_ = max(aucs, key=aucs.get)
        v = X[[self.col_]].to_numpy(float)
        self.scaler_ = StandardScaler().fit(v)
        self.lr_ = LogisticRegression(C=1e6, max_iter=10000).fit(self.scaler_.transform(v), y)
        return self

    def predict_proba1(self, X):
        return self.lr_.predict_proba(self.scaler_.transform(X[[self.col_]].to_numpy(float)))[:, 1]

    def describe(self):
        return f"single-variable rule on {self.col_}"


class Majority(BaseEstimator):
    def fit(self, X, y):
        self.p_ = float(np.mean(y))
        return self

    def predict_proba1(self, X):
        return np.full(len(X), self.p_)

    def describe(self):
        return "majority class (training prevalence)"


# ------------------------------------------------------------------ regression (burning rate)
def _d2_shape(X):
    out = np.empty(len(X))
    for fuel in ("methanol", "heptane"):
        m = (X["heptane"].to_numpy() == (1 if fuel == "heptane" else 0))
        out[m] = ph.d2_shape(fuel, X.loc[m, "x_o2"], X.loc[m, "x_co2"], X.loc[m, "x_he"])
    return out


class FuelMean(BaseEstimator):
    def fit(self, X, y):
        h = X["heptane"].to_numpy()
        self.mean_ = {v: float(np.mean(y[h == v])) for v in (0, 1)}
        return self

    def predict(self, X):
        return np.array([self.mean_[v] for v in X["heptane"].to_numpy()])

    def describe(self):
        return "per-fuel mean"


class D2Theory(BaseEstimator):
    """Textbook d2 law, no fitted constant."""

    def fit(self, X, y):
        return self

    def predict(self, X):
        rho = np.where(X["heptane"].to_numpy() == 1, ph.FUEL_C["heptane"]["rho_l"], ph.FUEL_C["methanol"]["rho_l"])
        return 8.0 * _d2_shape(X) / rho * 1e6

    def describe(self):
        return "d-squared law, textbook constants only"


class D2Scaled(BaseEstimator):
    """d2 law with one least-squares constant per fuel: K = C_fuel * (lambda/cp) ln(1+B)."""

    def fit(self, X, y):
        g, h = _d2_shape(X), X["heptane"].to_numpy()
        self.c_ = {v: float(np.sum(y[h == v] * g[h == v]) / np.sum(g[h == v] ** 2)) for v in (0, 1)}
        return self

    def predict(self, X):
        return np.array([self.c_[v] for v in X["heptane"].to_numpy()]) * _d2_shape(X)

    def describe(self):
        return "d-squared law, one constant per fuel"


class D2Corrected(BaseEstimator):
    """d2 law (one constant per fuel) times exp(f(inputs)); f is ridge or a GP fitted to log(K / K_d2)."""

    def __init__(self, sub="ridge", alpha=1.0):
        self.sub, self.alpha = sub, alpha

    def fit(self, X, y):
        self.base_ = D2Scaled().fit(X, y)
        r = np.log(y / self.base_.predict(X))
        Z = feats_raw(X, FLEX_INPUTS)
        self.scaler_ = StandardScaler().fit(Z)
        Zs = self.scaler_.transform(Z)
        if self.sub == "ridge":
            self.f_ = Ridge(alpha=self.alpha).fit(Zs, r)
        else:
            kernel = ConstantKernel(0.1, (1e-3, 1e1)) * Matern(np.ones(Z.shape[1]), (1e-2, 1e3), nu=1.5) + WhiteKernel(0.01, (1e-5, 1))
            with warnings.catch_warnings():
                warnings.simplefilter("ignore", ConvergenceWarning)
                self.f_ = GaussianProcessRegressor(kernel, normalize_y=True, random_state=0).fit(Zs, r)
        return self

    def predict(self, X):
        return self.base_.predict(X) * np.exp(self.f_.predict(self.scaler_.transform(feats_raw(X, FLEX_INPUTS))))

    def describe(self):
        return ("d-squared law x ridge correction (alpha=%g)" % self.alpha) if self.sub == "ridge" else \
            "d-squared law x Gaussian-process correction"


# ------------------------------------------------------------------ helpers
def predict(est, X):
    if isinstance(est, Selector):
        return predict(est.best_, X)
    return est.predict_proba1(X) if hasattr(est, "predict_proba1") else est.predict(X)


def score(task, y, p):
    """Higher is better for both tasks (AUC; negative MAE)."""
    return roc_auc_score(y, p) if task == "clf" else -mean_absolute_error(y, p)


class Selector(BaseEstimator):
    """Nested choice: inner grouped CV over the candidates on the outer-training part, then refit the winner."""

    def __init__(self, candidates, task="clf", inner_splits=4):
        self.candidates, self.task, self.inner_splits = candidates, task, inner_splits

    def fit(self, X, y, groups, strat, seed=0):
        cv = StratifiedGroupKFold(self.inner_splits, shuffle=True, random_state=1000 + seed)
        oof = {k: np.full(len(y), np.nan) for k in self.candidates}
        for tr, te in cv.split(np.zeros(len(y)), strat, groups):
            for k, est in self.candidates.items():
                oof[k][te] = predict(clone(est).fit(X.iloc[tr], y[tr]), X.iloc[te])
        self.inner_scores_ = {k: score(self.task, y, v) for k, v in oof.items()}
        self.chosen_ = max(self.inner_scores_, key=self.inner_scores_.get)  # ties: first listed (simplest)
        self.best_ = clone(self.candidates[self.chosen_]).fit(X, y)
        return self

    def describe(self):
        return self.best_.describe()
