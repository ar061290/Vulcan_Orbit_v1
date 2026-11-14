"""Read and clean the NASA tables M7 uses. Every cleaning step is appended to DECISIONS.

Inputs (all under datasets/psi/, see models/m7-extinction/DATA.md for column meanings):
  PSI-69  FLEX experimental table (droplet burns, methanol and n-heptane)
  PSI-39  CFI data-summary spreadsheet (n-dodecane and n-dodecane/iso-dodecane droplets)
  PSI-159 CFI-G normal-flame table (gas-fuelled spherical flames; cool-flame column)
"""
from pathlib import Path
import re
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[3]
PSI = ROOT / "datasets" / "psi"
FLEX_CSV = PSI / "PSI-69" / "PSI-69_Experimental table_FLEX.csv"
CFI_XLSX = PSI / "PSI-39" / "PSI-39_Science Documents_CFI_DataSummary_Spreadsheet_Jan2021.xlsx"
CFIG_NORMAL = PSI / "PSI-159" / "PSI-159_Experimental table_CFI-G_Normal Flames.csv"

MMHG_PER_ATM = 760.0  # 1 atm = 760 mmHg by definition

DECISIONS: list[str] = []


def _decide(text: str) -> None:
    if text not in DECISIONS:
        DECISIONS.append(text)


def _num(s: pd.Series) -> pd.Series:
    """Numeric parse. The FLEX file marks empty cells with an en dash (byte 0x96 in cp1252)
    and a few burn times as '~6'; anything non-numeric becomes NaN (missing)."""
    return pd.to_numeric(s.astype(str).str.strip(), errors="coerce")


def _date(s: pd.Series) -> pd.Series:
    s = s.astype(str).str.strip()
    a = pd.to_datetime(s, format="%m/%d/%Y", errors="coerce")
    b = pd.to_datetime(s, format="%m/%d/%y", errors="coerce")
    return a.fillna(b)


# ----------------------------------------------------------------------------------- FLEX
def load_flex() -> pd.DataFrame:
    """All FLEX burns after removing a duplicated row. One row per burn."""
    raw = pd.read_csv(FLEX_CSV, encoding="cp1252", dtype=str)
    raw.columns = [c.strip() for c in raw.columns]
    df = pd.DataFrame({
        "test_no": _num(raw["FLEX Test #"]).astype(int),
        "test_id": raw["FLEX Identifier"].str.strip(),
        "date": _date(raw["Test Date"]),
        "fuel": raw["Fuel"].str.strip().str.lower(),
        "p_mmhg": _num(raw["Ambient pressure; mmHg"]),
        "x_o2": _num(raw["O initial ambient composition; mole fraction"]),
        "x_n2": _num(raw["N initial ambient composition; mole fraction"]),
        "x_co2": _num(raw["CO initial ambient composition; mole fraction"]),
        "x_he": _num(raw["He initial ambient composition; mole fraction"]),
        "d0_mm": _num(raw["Droplet initial diameter; mm"]),
        "dext_mm": _num(raw["Visible flame extinction diameter; mm"]),
        "k_mm2_s": _num(raw["Burning rate; mm"]),
        "burn_time_s": _num(raw["Burn time; s"]),
        "test_end": raw["Test end"].str.strip(),
    })
    _decide("FLEX: read as cp1252; cells holding an en dash (byte 0x96) or text such as '~6' are treated as missing.")
    assert df["date"].notna().all(), "unparsed FLEX test date"

    bad_p = df["p_mmhg"] <= 0
    for _, r in df[bad_p].iterrows():
        _decide(f"FLEX: test {r.test_id} (#{r.test_no}) lists ambient pressure {r.p_mmhg:g} mmHg; treated as missing, "
                "so the burn is left out of the models (it still counts in flex_suppression.json).")
    df.loc[bad_p, "p_mmhg"] = np.nan

    dup = df[df["test_id"].duplicated(keep=False)].sort_values("test_no")
    for tid, g in dup.groupby("test_id"):
        keep, drop = g.iloc[0], g.iloc[1:]
        _decide(f"FLEX: identifier {tid} appears {len(g)} times (#{', #'.join(map(str, g.test_no))}) with the same date and "
                f"time; kept #{keep.test_no}, dropped #{', #'.join(map(str, drop.test_no))}.")
    df = df.drop_duplicates("test_id", keep="first").reset_index(drop=True)

    df["p_atm"] = df["p_mmhg"] / MMHG_PER_ATM
    df["heptane"] = (df["fuel"] == "heptane").astype(int)
    df["diluent"] = np.select([df["x_he"] > 0, df["x_co2"] > 0], ["He", "CO2"], "N2 only")
    assert not ((df["x_he"] > 0) & (df["x_co2"] > 0)).any(), "a FLEX burn with both He and CO2"
    df["extinguished"] = (df["test_end"] == "Extinction").astype(int)
    df["session"] = df["date"].dt.strftime("%Y-%m-%d")
    # Nominal atmosphere: pressure to 0.1 atm, mole fractions to 0.01 (for the stricter split).
    df["atmosphere"] = (df["p_atm"].round(1).astype(str) + "atm_O2=" + df["x_o2"].round(2).astype(str)
                        + "_CO2=" + df["x_co2"].round(2).astype(str) + "_He=" + df["x_he"].round(2).astype(str))
    return df


def flex_model_frame(df: pd.DataFrame) -> pd.DataFrame:
    """Burns usable as model inputs: fuel, pressure, composition and initial diameter all present."""
    need = ["p_atm", "x_o2", "x_co2", "x_he", "d0_mm"]
    out = df.dropna(subset=need).reset_index(drop=True)
    n_drop = len(df) - len(out)
    _decide(f"FLEX: {n_drop} burns lack pressure or initial diameter and are left out of the models "
            "(no values are filled in).")
    return out


# ----------------------------------------------------------------------------------- CFI
def _dodecane_fraction(fuel: str) -> float:
    fuel = str(fuel).strip()
    if fuel == "C12H26":
        return 1.0
    m = re.match(r"\[\s*([\d.]+)\s*\]\s*/\s*\[\s*([\d.]+)\s*\]\s*C12H26/iso-dodecane", fuel)
    if m:
        return float(m.group(1))
    return np.nan  # farnesane (no analysed data) or unknown


def load_cfi() -> pd.DataFrame:
    """CFI tests (PSI-39): conditions from 'Master Sheet', measurements from 'DATA', crew notes from 'Comments'."""
    sheets = pd.read_excel(CFI_XLSX, sheet_name=["Master Sheet", "DATA", "Comments"], dtype=str, engine="openpyxl")
    m, d, c = (sheets[k].copy() for k in ("Master Sheet", "DATA", "Comments"))
    for t in (m, d, c):
        t.columns = [str(k).strip() for k in t.columns]
        t.dropna(subset=["Flex Number"], inplace=True)
        t["Flex Number"] = t["Flex Number"].astype(str).str.strip()
    j = m.merge(d, on="Flex Number", how="left").merge(c[["Flex Number", "Comments"]], on="Flex Number", how="left")
    out = pd.DataFrame({
        "test_id": "FLEX-" + j["Flex Number"],
        "session": pd.to_datetime(j["Test Date"], errors="coerce").dt.strftime("%Y-%m-%d"),
        "p_atm": _num(j["Pressure"].str.replace("atm", "", regex=False)),
        "x_o2": _num(j["Oxygen"]),
        "x_n2": _num(j["Nitrogen"]),
        "x_he": _num(j["Helium"]),
        "fiber": j["Fiber"].str.strip().map({"Yes": 1, "No": 0}),
        "fuel": j["Fuel"].str.strip(),
        "dodecane_frac": j["Fuel"].map(_dodecane_fraction),
        "d0_mm": _num(j["D0 ( mm )"]),
        "dext_hot_mm": _num(j["Dext, hot ( mm )"]),
        "k_hot_mm2_s": _num(j["khot ( mm^2/s )"]),
        "k_cool_mm2_s": _num(j["kcool ( mm^2/s )"]),
        "dext_cool_mm": _num(j["Dext,cool ( mm )"]),
        "reignitions": _num(j["Reignitions"]),
        "extrap_cf": _num(j["Extrap CF?"]),
        "analysed": j["Completed Analysis?"].astype(str).str.strip().eq("Yes"),
        "comments": j["Comments"].fillna(""),
    })
    p_data = _num(j["Pressure (atm)"])
    both = out["p_atm"].notna() & p_data.notna()
    assert (np.abs(out.loc[both, "p_atm"] - p_data[both]) < 1e-9).all(), "CFI pressure differs between sheets"
    _decide("CFI: pressure is taken from the 'Master Sheet' text (e.g. '.5 atm'); it agrees with 'Pressure (atm)' in the "
            "DATA sheet wherever both are filled in.")
    return out


def cfi_cool_frame(cfi: pd.DataFrame) -> pd.DataFrame:
    """Analysed CFI burns where the visible (hot) flame went out and the cool-flame end state was measured."""
    keep = (cfi["analysed"] & cfi["d0_mm"].notna() & cfi["dext_hot_mm"].notna()
            & cfi["dext_cool_mm"].notna() & cfi["dodecane_frac"].notna() & cfi["fiber"].notna())
    out = cfi[keep].copy().reset_index(drop=True)
    out["consumed"] = (out["dext_cool_mm"] == 0).astype(int)
    _decide("CFI: cool-flame model uses burns with 'Completed Analysis? = Yes', a recorded initial diameter, a recorded "
            "hot-flame extinction diameter and a recorded cool-flame extinction diameter. Label = droplet fully consumed "
            "('Dext,cool' recorded as 0) versus cool flame went out leaving fuel ('Dext,cool' > 0).")
    _decide("CFI: a missing 'kcool' is NOT read as 'no cool flame'. The crew comments show many such burns drifted out of "
            "the camera view during the cool flame (e.g. FLEX-1214, 1216, 1229), so presence/absence of a cool flame is "
            "not modelled.")
    return out


# ----------------------------------------------------------------------------------- CFI-G
def load_cfig_normal() -> pd.DataFrame:
    raw = pd.read_csv(CFIG_NORMAL, encoding="cp1252", dtype=str).dropna(how="all")
    raw.columns = [c.strip() for c in raw.columns]
    return pd.DataFrame({
        "day": _num(raw["Day"]),
        "fuel": raw["Fuel"].str.strip(),
        "test": raw["Test"].str.strip(),
        "cool_flame": raw["Cool flame?"].fillna("").str.strip(),
        "x_o2_before": _num(raw["XO2 before test"]),
        "p_bar": _num(raw["approx p (bar)"]),
        "x_f": _num(raw["Xf"]),
        "m_fuel_mg_s": _num(raw["mHC (mg/s)"]),
        "hot_ignition": raw["Hot ignition"].str.strip(),
        "end": raw["Self-ext or flow term"].str.strip(),
        "comments": raw["Comments"].fillna("").str.strip(),
    })
