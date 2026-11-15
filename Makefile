# One command per layer. `make site` rebuilds everything that is built from the data files (seconds, no NASA download);
# `make models` reruns every model from NASA files in datasets/ (minutes; needs each model's requirements.txt);
# `make verify` runs the checks. `make all` does all three.
PY ?= python3
.PHONY: all site models verify hashes
all: models site verify
models:
	$(PY) models/m4-latency/build.py
	$(PY) models/m4-latency/rate_of_rise.py
	$(PY) models/m4-latency/sensitivity.py
	$(PY) models/m5-smoke-miss/build.py
	$(PY) models/m6-spread/build.py
	$(PY) models/m6b-predictor/build.py
	$(PY) models/m7-extinction/build.py
	$(PY) engine/drift.py
	$(PY) engine/calibrate.py
	$(PY) models/flame-sim/build.py
site:
	$(PY) scripts/build_efield.py
	$(PY) scripts/build_gaps.py
	$(PY) scripts/build_m7_explorer.py
	$(PY) scripts/build_daft.py
	$(PY) scripts/build_india.py
	$(PY) scripts/build_memory.py
	$(PY) scripts/build_assistant.py
	$(PY) scripts/build_crosscheck.py
	$(PY) scripts/permutation_tests.py
	$(PY) scripts/build_trust.py
	$(PY) scripts/build_kb.py
	$(PY) scripts/hash_data.py
verify:
	$(PY) scripts/check_data.py
	cd data && sha256sum -c --quiet SHA256SUMS.txt
hashes:
	$(PY) scripts/hash_data.py
