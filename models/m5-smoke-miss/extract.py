#!/usr/bin/env python3
"""Pull the per-test points out of Figures 6-8 of Urban et al. 2012 (AIAA 2012-3536) from the PDF's vector drawing.

    python models/m5-smoke-miss/extract.py path/to/20130000422.pdf    # writes models/m5-smoke-miss/traced.csv + trace_check.json

No hand tracing: every marker is read from the PDF's own drawing commands. Axes are calibrated from the tick labels.
Series are identified by marker colour, matched to the legend. Points at the same air velocity are paired into tests by
requiring the four plotted values to obey the lognormal (Hatch-Choate) relations; the leftover mismatch is reported.
"""
import sys, json, itertools, math, csv
from pathlib import Path
import pdfplumber, numpy as np

HERE = Path(__file__).resolve().parent
FIGS = {   # page, y-range of the plot (PDF points from top), left-axis max, colours of CMD, DAM, Dg, sigma_g markers
    "Lampwick": dict(fig=6, page=8, y=(230, 400), ymax=0.7, col=dict(CMD="(0.2902, 0.49412, 0.73333)", DAM="(0.7451, 0.29412, 0.28235)", Dg="(0.0, 0.50196, 0.0)", sg="(0.4902, 0.37647, 0.62745)")),
    "Kapton":   dict(fig=7, page=8, y=(465, 640), ymax=0.30, col=dict(CMD="(0.0, 0.50196, 0.0)", DAM="(0.7451, 0.29412, 0.28235)", Dg="(0.27451, 0.66667, 0.77255)", sg="(0.4902, 0.37647, 0.62745)")),
    "Teflon":   dict(fig=8, page=9, y=(85, 265), ymax=0.4, col=dict(CMD="(0.2902, 0.49412, 0.73333)", DAM="(0.7451, 0.29412, 0.28235)", Dg="(0.27451, 0.66667, 0.77255)", sg="(0.4902, 0.37647, 0.62745)")),
}
LEGEND_X = 300          # markers right of this are legend swatches, not data


def calib(page, y0, y1, ymax):
    """Linear maps from PDF coordinates to data, from the tick-label centres. Returns maps + the fit residuals."""
    ws = [w for w in page.extract_words() if y0 - 20 < w["top"] < y1 + 15]
    num = lambda s: float(s) if s.replace(".", "", 1).isdigit() else None
    left = [(num(w["text"]), (w["top"] + w["bottom"]) / 2) for w in ws if 100 < w["x0"] < 122 and num(w["text"]) is not None]
    left_top = max((w["top"] for w in ws if 100 < w["x0"] < 122 and num(w["text"]) is not None))
    right = [(num(w["text"]), (w["top"] + w["bottom"]) / 2) for w in ws if 280 < w["x0"] < 305 and num(w["text"]) is not None and w["top"] <= left_top + 1]
    xs = [(num(w["text"]), (w["x0"] + w["x1"]) / 2) for w in ws if num(w["text"]) is not None and w["top"] > left_top + 2 and w["top"] < left_top + 20 and 120 < w["x0"] < 300]
    out = {}
    for k, pts in (("left", left), ("right", right), ("x", xs)):
        v, p = np.array([a for a, _ in pts]), np.array([b for _, b in pts])
        A = np.vstack([p, np.ones_like(p)]).T; (m, c), *_ = np.linalg.lstsq(A, v, rcond=None)
        res = v - (m * p + c); span = v.max() - v.min()
        out[k] = dict(m=float(m), c=float(c), n=len(pts), max_err_frac=float(np.abs(res).max() / span), values=sorted(set(v.tolist())))
    return out


def markers(page, y0, y1, colour):
    """Marker centres for one colour. Excel draws each marker as a small stack of shapes (outline, fill, ...), and two
    tests can sit on top of each other, so shapes are clustered by position and each cluster holds
    round(shapes / shapes-per-marker) markers, where shapes-per-marker is the most common cluster size."""
    shapes = []
    for c in page.curves + page.rects:
        if not (y0 < c["top"] and c["bottom"] < y1) or str(c.get("non_stroking_color")) != colour: continue
        if c["width"] < 3 or c["width"] > 8: continue                  # skip spokes, fit lines and gridlines
        cx, cy = (c["x0"] + c["x1"]) / 2, (c["top"] + c["bottom"]) / 2
        if cx <= LEGEND_X: shapes.append((cx, cy))
    clusters = []
    for x, y in shapes:
        for cl in clusters:
            if abs(cl[0] - x) < 0.6 and abs(cl[1] - y) < 0.6: cl[2].append((x, y)); break
        else: clusters.append([x, y, [(x, y)]])
    sizes = [len(cl[2]) for cl in clusters]; per = max(set(sizes), key=sizes.count)
    pts = []
    for cl in clusters:
        k = max(1, round(len(cl[2]) / per)); xs, ys = sorted(p[0] for p in cl[2]), sorted(p[1] for p in cl[2])
        for j in range(k):                                             # spread overlapping markers across the cluster's own y extent
            part = ys[j * len(ys) // k:(j + 1) * len(ys) // k]
            pts.append((float(np.mean(xs)), float(np.mean(part))))
    return pts


def main(pdf_path):
    pdf = pdfplumber.open(pdf_path)
    rows, check = [], {}
    for mat, f in FIGS.items():
        page = pdf.pages[f["page"] - 1]; y0, y1 = f["y"]
        cal = calib(page, y0, y1, f["ymax"])
        X = lambda px: cal["x"]["m"] * px + cal["x"]["c"]
        L = lambda py: cal["left"]["m"] * py + cal["left"]["c"]
        R = lambda py: cal["right"]["m"] * py + cal["right"]["c"]
        S = {k: markers(page, y0, y1, col) for k, col in f["col"].items()}
        n = {k: len(v) for k, v in S.items()}
        assert len(set(n.values())) == 1, (mat, n)
        # group by x position, then pair within each group by the Hatch-Choate relations
        xs = sorted({round(p[0], 0) for p in S["CMD"]})
        tests = []
        for xp in xs:
            g = {k: [p for p in v if abs(p[0] - xp) < 1.0] for k, v in S.items()}
            cmd = [L(p[1]) for p in g["CMD"]]; dam = [L(p[1]) for p in g["DAM"]]; dg = [L(p[1]) for p in g["Dg"]]; sg = [R(p[1]) for p in g["sg"]]
            best = None
            for pd in itertools.permutations(range(len(dam))):
                for pg in itertools.permutations(range(len(dg))):
                    for ps in itertools.permutations(range(len(sg))):
                        err = 0.0
                        for i in range(len(cmd)):
                            c, d = cmd[i], dam[pd[i]]
                            if d <= c: err += 9; continue
                            s2 = math.log(d / c)
                            err += abs(c * math.exp(-s2 / 2) / dg[pg[i]] - 1) + abs(math.exp(math.sqrt(s2)) / sg[ps[i]] - 1)
                        if best is None or err < best[0]: best = (err, pd, pg, ps)
            _, pd, pg, ps = best
            for i in range(len(cmd)):
                c, d, gm, s = cmd[i], dam[pd[i]], dg[pg[i]], sg[ps[i]]
                s2 = math.log(d / c)
                tests.append(dict(material=mat, figure=f["fig"], air_velocity_cm_s=round(X(g["CMD"][i][0]), 2), CMD_um=round(c, 4), DAM_um=round(d, 4), Dg_um=round(gm, 4), sigma_g=round(s, 3),
                                  Dg_from_moments_um=round(c * math.exp(-s2 / 2), 4), sigma_g_from_moments=round(math.exp(math.sqrt(s2)), 3)))
        for i, t in enumerate(tests, 1): t["test"] = f"{mat[:3].upper()}-{i}"
        rows += tests
        check[mat] = dict(markers_per_series=n, axis_calibration=cal,
                          pairing_error_Dg_median=float(np.median([abs(t["Dg_from_moments_um"] / t["Dg_um"] - 1) for t in tests])),
                          pairing_error_sigma_median=float(np.median([abs(t["sigma_g_from_moments"] / t["sigma_g"] - 1) for t in tests])))
    cols = ["test", "material", "figure", "air_velocity_cm_s", "CMD_um", "DAM_um", "Dg_um", "sigma_g", "Dg_from_moments_um", "sigma_g_from_moments"]
    with open(HERE / "traced.csv", "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=cols); w.writeheader(); [w.writerow({k: r[k] for k in cols}) for r in rows]
    (HERE / "trace_check.json").write_text(json.dumps(check, indent=1))
    for r in rows: print({k: r[k] for k in cols})
    for m, c in check.items(): print(m, c["markers_per_series"], {k: round(v["max_err_frac"], 4) for k, v in c["axis_calibration"].items()}, "pairing Dg %.3f sigma %.3f" % (c["pairing_error_Dg_median"], c["pairing_error_sigma_median"]))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "paper.pdf")
