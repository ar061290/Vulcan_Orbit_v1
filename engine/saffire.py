"""Read the Saffire-III flight telemetry (NASA PSI-100) and pull out the events the drift model is tuned and tested on."""
import csv, glob
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
FILE = "datasets/psi/PSI-100/PSI-100_Raw Data_Saffire_Data_Table2017.161.00.42.03-EU.csv"

def load():
    rows = list(csv.reader(open(ROOT / FILE, newline="")))
    head = [h.replace("P@", "").replace("sfsHk.", "") for h in rows[0]]
    col = {h: k for k, h in enumerate(head)}
    def num(x):
        try: return float(x)
        except ValueError: return np.nan
    a = np.array([[num(x) for x in r] for r in rows[1:] if len(r) == len(head)])
    t = a[:, col["RelativeSeconds"]] / 1000.0                 # the column is in milliseconds
    ok = (t >= 0) & (t < 1e4); a, t = a[ok], t[ok]
    g = lambda name: a[:, col[name]]
    scat = g("CDH_F2PCM_SMK_DET_SCAT_SENS_P"); m = scat != 0   # zero rows are packets without this channel
    ts, ys = t[m], scat[m]
    keep = np.r_[True, np.diff(ts) > 5.0]                      # each reading appears twice; keep the first
    rad = g("Radiometer1value"); v = rad > -1000               # large negative numbers are fill values
    return dict(t_scat=ts[keep], scat=ys[keep],
                t_sfs=t[v], rad1=rad[v], rad2=g("Radiometer2value")[v], anem1=g("Anemometer1")[v],
                ign1=g("Sample1IgniterCurrent")[v], ign2=g("Sample2IgniterCurrent")[v], wire=g("SmokeWireCurrent")[v])

def events(d):
    t = d["t_sfs"]
    on = lambda x: (float(t[x > 0.3].min()), float(t[x > 0.3].max()))
    wire = t[d["wire"] > 0.3]; first = wire[wire < 6000]
    burning = t[(np.maximum(d["rad1"], d["rad2"]) > 0) & (t > 5900)]
    return dict(sample1_igniter=on(d["ign1"]), sample2_igniter=on(d["ign2"]), smoke_wire=(float(first.min()), float(first.max())),
                sample1_flame=(float(burning.min()), float(burning.max())), duct_flow_cm_s=float(np.median(d["anem1"][(t > 5900) & (t < 5950)])))

if __name__ == "__main__":
    d = load(); print(events(d)); print(len(d["t_scat"]), "smoke-detector readings")
