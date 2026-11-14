"""Gas-phase chemistry and properties with Cantera.

* Equilibrium (constant enthalpy and pressure) of the stoichiometric fuel + oxidiser mixture at 298.15 K gives the adiabatic
  flame temperature and the product composition.
  - methane, ethylene, propane: gri30.yaml (GRI-Mech 3.0, shipped with Cantera);
  - n-heptane, ethanol, methanol, and any oxidiser containing helium: n-hexane-NUIG-2015.yaml (shipped with Cantera in
    example_data; contains NC7H16, C2H5OH, CH3OH and HE). It has no transport data.
* Lower heating value from the species enthalpies at 298.15 K (products CO2 and H2O vapour).
* Transport (mixture-averaged): gri30 species plus HE, NC7H16, C2H5OH with Lennard-Jones parameters from the San Diego
  mechanism transport file (properties.json). Used only for property evaluation, no reactions.
"""
import json, re, warnings
from functools import lru_cache
from pathlib import Path
import cantera as ct

warnings.filterwarnings("ignore")
HERE = Path(__file__).resolve().parent
PROPS = json.loads((HERE / "properties.json").read_text())
T0 = 298.15
FUELS = {   # name: (species, mechanism, liquid at cabin conditions)
    "methane": ("CH4", "gri30.yaml", False), "ethylene": ("C2H4", "gri30.yaml", False), "propane": ("C3H8", "gri30.yaml", False),
    "n-heptane": ("NC7H16", "example_data/n-hexane-NUIG-2015.yaml", True), "ethanol": ("C2H5OH", "example_data/n-hexane-NUIG-2015.yaml", True),
    "methanol": ("CH3OH", "example_data/n-hexane-NUIG-2015.yaml", True),
}


@lru_cache(None)
def mech(name):
    return ct.Solution(name)


@lru_cache(None)
def transport_gas():
    g = mech("gri30.yaml"); n = mech("example_data/n-hexane-NUIG-2015.yaml")
    sp = [g.species(k) for k in g.species_names]
    for k in ("HE", "NC7H16", "C2H5OH"):
        p = PROPS["transport_added"][k]
        s = n.species(k)
        s.transport = ct.GasTransportData(geometry=p["geometry"], diameter=p["diameter_A"] * 1e-10, well_depth=p["well_depth_K"] * ct.boltzmann,
                                          rotational_relaxation=p["rot_relax"])
        sp.append(s)
    return ct.Solution(thermo="ideal-gas", species=sp, transport_model="mixture-averaged")


def atoms(species, gas):
    return {e: gas.n_atoms(species, e) for e in ("C", "H", "O")}


def stoich_o2(species, gas):
    a = atoms(species, gas)
    return a["C"] + a["H"] / 4 - a["O"] / 2          # mol O2 per mol fuel


def oxidiser(X_O2, dil=None):
    """Oxidiser mole fractions: O2 plus diluents {species: mole fraction}; N2 fills the rest when dil is None."""
    dil = {"N2": 1 - X_O2} if dil is None else dil
    return {"O2": X_O2, **{k: v for k, v in dil.items() if v > 0}}


def _mech_for(fuel, ox):
    sp, m, _ = FUELS[fuel]
    if "HE" in ox: m = "example_data/n-hexane-NUIG-2015.yaml"
    return sp, mech(m)


@lru_cache(None)
def _equil(fuel, ox_items, P):
    ox = dict(ox_items)
    sp, g = _mech_for(fuel, ox)
    nu = stoich_o2(sp, g)
    X = {sp: 1.0}
    for k, v in ox.items():
        X[k] = X.get(k, 0) + nu * v / ox["O2"]
    g.TPX = T0, P, X
    g.equilibrate("HP")
    Xall = g.X; Xp = {k: float(Xall[g.species_index(k)]) for k in ("CO2", "H2O", "CO", "O2")}
    # mass-based quantities
    MW_F = g.molecular_weights[g.species_index(sp)]
    MW_ox = sum(v * g.molecular_weights[g.species_index(k)] for k, v in ox.items())
    Y_O2 = ox["O2"] * g.molecular_weights[g.species_index("O2")] / MW_ox
    s = nu * g.molecular_weights[g.species_index("O2")] / MW_F        # kg O2 per kg fuel
    Zst = 1.0 / (1.0 + s / Y_O2)
    return dict(T_ad=float(g.T), X_products=Xp, s=s, Y_O2=Y_O2, Z_st=Zst, MW_F=MW_F)


def equilibrium(fuel, X_O2, P, dil=None):
    ox = oxidiser(X_O2, dil)
    return _equil(fuel, tuple(sorted(ox.items())), float(P))


@lru_cache(None)
def lhv(fuel):
    """Lower heating value (J/kg fuel vapour) at 298.15 K from species enthalpies."""
    sp, m, _ = FUELS[fuel]
    g = mech(m)
    a = atoms(sp, g); nu = stoich_o2(sp, g)
    h = lambda k: g.species(k).thermo.h(T0)                     # J/kmol
    dh = h(sp) + nu * h("O2") - a["C"] * h("CO2") - a["H"] / 2 * h("H2O")
    return float(dh / g.molecular_weights[g.species_index(sp)])


def gas_props(X, T, P):
    """k (W/m K), cp (J/kg K), rho (kg/m3), mu of a mixture given as {species: mole fraction}."""
    g = transport_gas()
    g.TPX = T, P, X
    return dict(k=g.thermal_conductivity, cp=g.cp_mass, rho=g.density, mu=g.viscosity)


def fuel_species(fuel):
    return FUELS[fuel][0]


def is_liquid(fuel):
    return FUELS[fuel][2]
