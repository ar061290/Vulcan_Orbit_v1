# Plugging Mukund's camera model into the site

The site is already built to read one file, `data/cv_latest.json`: Assess ("Load from camera" → growth simulation → burn time),
the Bench rig "Camera reading now" card and the model cards all use it. Nothing on the site needs changing.

## In the FIRE-LOCALIZATION-AND-VOLUME-ESTIMATION repo (Mukund)

1. Copy `integration/cv/cv_export.py` into that repo.
2. After a detection, call it (see the example at the top of the file). Pass fuel coordinates in cm, not pixels.
   Optional fields: `fuel_source`, `flame_volume_cm3` and `distance_from_sensor_cm` (depth model), `smoke_flow` (optical flow).
   Leave out anything you did not measure; never type a number in by hand.
3. It writes `cv_latest.json` and refuses to write a file the site would reject.

## In Vulcan_Orbit_v1

```
python scripts/import_cv.py path/to/cv_latest.json --owner "Mukund"
```
It checks the file with the same rules as the site, copies it to `data/cv_latest.json`, adds its manifest line and refreshes the
checksums. Then commit `data/cv_latest.json`, `data/manifest.json` and `data/SHA256SUMS.txt` together.

## The detection score (precision)

The model card shows no accuracy until it is measured. For the headline precision, Mukund needs to send:
the metric (precision), the value, its range (low, high), how many test images, and how the test images were held out
(e.g. whole videos the model never saw). Then it goes on the model card with status `model`. Do not use "86.3 or 86.7";
use the number from the evaluation run.
