# Models: one folder per feature

Each of the seven models (M1 to M7 in `AGENTS.md`) lives in `models/<feature-id>/` and owns only that folder, its output file(s) in `data/` and its line in `data/manifest.json`.

## Folder layout (copy this for a new feature)

```
models/<feature-id>/
  DATA.md            every input file: PSI id, DOI, rows, the columns used and their meaning quoted from the docs
  RULES.md           metric, target and validation split, committed on its own BEFORE any training
  README.md          data, method, score, limits, and a "Decisions" list for every judgement call
  REPORT.md          for the human reviewer: headline numbers with ranges, baselines, pass/fail, hand checks
  requirements.txt   pinned versions
  build.py           ONE command rebuilds every output:  python models/<feature-id>/build.py
  <pkg>/             small Python modules imported by build.py (loaders, splits, models, outputs)
  checks/            matplotlib check plots (small PNGs)
```

## Conventions

- `build.py` reads only from `datasets/` and writes only the feature's own files in `data/`.
- Shared files are merged, never overwritten. `data/models.json` holds one entry per model; replace only the entries whose `id` your feature owns.
- Validate every output against `CONTRACT.md` inside `build.py` and fail loudly if the shape is wrong.
- Fixed random seeds; a second run of `build.py` should produce byte-identical outputs.
- Extra NASA files a feature needs are fetched by a script in its folder that appends rows to `datasets/psi/MANIFEST.csv`. It never rewrites the file. Large documents go to `datasets/raw/` (git-ignored).

## Features

| Id | Folder | Outputs |
|---|---|---|
| M7 | `m7-extinction/` | `data/flex_suppression.json`; entries `m7-*` in `data/models.json` |
