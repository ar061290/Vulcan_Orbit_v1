"""Textbook droplet-burning physics for the d-squared-law baseline and the physics features.

Quasi-steady d-squared law (Law 2006, "Combustion Physics", ch. 6; Turns 2012, "An Introduction to
Combustion", 3rd ed., sec. 10.5):

    K = 8 (lambda / c_p)_gas / rho_l * ln(1 + B),
    B = (Y_O2,inf * LHV / nu_O2 + c_p (T_inf - T_boil)) / h_fg

Gas properties are those of the ambient mixture at 800 K (a fixed reference temperature between the
droplet surface and the flame). Mixture conductivity uses the Wassiljewa equation with the
Mason-Saxena coefficients (Poling, Prausnitz and O'Connell, "The Properties of Gases and Liquids",
5th ed., eqs. 10-6.1 and 10-6.2). Every constant is read from properties.csv with its source.
"""
from pathlib import Path
import numpy as np
import pandas as pd

PROPS_CSV = Path(__file__).with_name("properties.csv")
GASES = ("O2", "N2", "CO2", "He")
# Fuel formulas (C, H, O atoms), O2 moles per mole of fuel and water moles per mole of fuel, from the
# balanced combustion equations CH3OH + 1.5 O2 -> CO2 + 2 H2O and C7H16 + 11 O2 -> 7 CO2 + 8 H2O.
FUELS = {
    "methanol": {"C": 1, "H": 4, "O": 1, "o2_per_mol": 1.5, "h2o_per_mol": 2},
    "heptane": {"C": 7, "H": 16, "O": 0, "o2_per_mol": 11.0, "h2o_per_mol": 8},
}


def load_props() -> dict:
    t = pd.read_csv(PROPS_CSV)
    return dict(zip(t["name"], t["value"].astype(float)))


P = load_props()
M = {"O2": 2 * P["M_O"], "N2": 2 * P["M_N"], "CO2": P["M_C"] + 2 * P["M_O"], "He": P["M_He"]}  # g/mol
M_H2O = 2 * P["M_H"] + P["M_O"]
K_GAS = {g: P[f"{g}_k_800K"] for g in GASES}            # W/(m K)
CP_GAS = {g: P[f"{g}_cp_800K"] * 1000.0 for g in GASES}  # J/(kg K)
MU_GAS = {g: P[f"{g}_mu_800K"] for g in GASES}          # uPa s (only ratios are used)


def fuel_constants(fuel: str) -> dict:
    f = FUELS[fuel]
    m_fuel = f["C"] * P["M_C"] + f["H"] * P["M_H"] + f["O"] * P["M_O"]          # g/mol
    hhv = -P[f"{fuel}_dHc_liquid"]                                               # kJ/mol
    lhv_kj_mol = hhv - f["h2o_per_mol"] * P["water_h_fg_298"] * M_H2O / 1000.0  # kJ/mol
    return {
        "M": m_fuel,
        "LHV": lhv_kj_mol / m_fuel * 1e6,            # J/kg
        "nu_O2": f["o2_per_mol"] * M["O2"] / m_fuel,  # kg O2 per kg fuel
        "h_fg": P[f"{fuel}_h_fg"] * 1000.0,            # J/kg
        "T_boil": P[f"{fuel}_T_boil"],                 # K
        "rho_l": P[f"{fuel}_rho_liquid"],              # kg/m3
    }


FUEL_C = {f: fuel_constants(f) for f in FUELS}


def _fractions(x_o2, x_co2, x_he):
    x_o2, x_co2, x_he = (np.asarray(v, float) for v in (x_o2, x_co2, x_he))
    x_n2 = 1.0 - x_o2 - x_co2 - x_he  # N2 is the balance gas
    return {"O2": x_o2, "N2": x_n2, "CO2": x_co2, "He": x_he}


def mixture(x_o2, x_co2, x_he) -> dict:
    """Mass fractions, c_p (J/kg K), conductivity (W/m K) and lambda/c_p (kg/m s) of the ambient gas at 800 K."""
    x = _fractions(x_o2, x_co2, x_he)
    mbar = sum(x[g] * M[g] for g in GASES)
    y = {g: x[g] * M[g] / mbar for g in GASES}
    cp = sum(y[g] * CP_GAS[g] for g in GASES)
    lam = 0.0
    for i in GASES:
        denom = 0.0
        for j in GASES:
            phi = (1 + (MU_GAS[i] / MU_GAS[j]) ** 0.5 * (M[j] / M[i]) ** 0.25) ** 2 / (8 * (1 + M[i] / M[j])) ** 0.5
            denom = denom + x[j] * phi
        lam = lam + x[i] * K_GAS[i] / denom
    return {"y": y, "cp": cp, "k": lam, "k_over_cp": lam / cp}


AIR = mixture(0.21, 0.0, 0.0)


def transfer_number(fuel, x_o2, x_co2, x_he):
    fc = FUEL_C[fuel]
    mix = mixture(x_o2, x_co2, x_he)
    return (mix["y"]["O2"] * fc["LHV"] / fc["nu_O2"] + mix["cp"] * (P["T_ambient"] - fc["T_boil"])) / fc["h_fg"]


def d2_shape(fuel, x_o2, x_co2, x_he):
    """(lambda/c_p)_mix * ln(1 + B), in kg/(m s). The d2-law K is 8/rho_l times this."""
    mix = mixture(x_o2, x_co2, x_he)
    return mix["k_over_cp"] * np.log1p(transfer_number(fuel, x_o2, x_co2, x_he))


def d2_theory_mm2_s(fuel, x_o2, x_co2, x_he):
    """Textbook d2-law burning-rate constant with no fitted constant, mm2/s."""
    return 8.0 * d2_shape(fuel, x_o2, x_co2, x_he) / FUEL_C[fuel]["rho_l"] * 1e6


def inert_heat_capacity_per_o2(x_o2, x_co2, x_he):
    """Molar heat capacity (J/mol K, 800 K) of the inert gases per mole of O2: the 'thermal ballast'."""
    x = _fractions(x_o2, x_co2, x_he)
    cpm = {g: CP_GAS[g] * M[g] / 1000.0 for g in GASES}  # J/(mol K)
    return (x["N2"] * cpm["N2"] + x["CO2"] * cpm["CO2"] + x["He"] * cpm["He"]) / x["O2"]


def k_over_cp_rel_air(x_o2, x_co2, x_he):
    return mixture(x_o2, x_co2, x_he)["k_over_cp"] / AIR["k_over_cp"]
