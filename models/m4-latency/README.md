# M4 detection latency (NASA Saffire-III)

**Question.** For each real orbital event in Saffire-III, when would each sensor type have alarmed?

```
python models/m4-latency/build.py     # a few seconds; writes data/saffire_latency.json (status "real") and results.json
```

Pass rules: `RULES.md` (committed before any check ran).

## Data
NASA PSI-100, Saffire-III flight telemetry, doi 10.60555/040q-4h36. Columns used, as named in the file:
- `sfsHk.Radiometer1value` to `Radiometer4value`: flame radiation, logged about once a second but sample-and-hold, so values change only about every 5 s; fill value about -4000.
- `CDH_F2PCM_SMK_DET_SCAT_SENS_P` and `CDH_F2PCM_SMK_DET_OBS_SENS_P`: the Cygnus cabin smoke detector's scatter and
  obscuration channels, raw counts, about every 10 s (each logged twice). The F1 detector channels are zero throughout.
- `SmokeWireCurrent`, `Sample1IgniterCurrent`, `Sample2IgniterCurrent`: when each event was switched on (current above 0.3 A).
- `RelativeSeconds` is in milliseconds (0 to 6,899,845); one corrupt row with a large negative value is dropped.

## Method
Per channel and per event: baseline from the 60 s before switch-on; alarm at the first reading above baseline + 5 SD
(3 SD reported as the low end). Each event's window ends at the next event. No model is fitted.

## Results
| Event | Flame radiometer (first of 4) | Smoke scatter | Smoke obscuration |
|---|---|---|---|
| Smoke wire (smoke, no flame) | no alarm (correct) | 23 s ± 10 | no alarm |
| Sample 2 (opposed flow) | 7 s (radiometers 2 and 4 only) | 127 s ± 10 (27 s at 3 SD) | no alarm |
| Sample 1 (concurrent flow) | 7 s (1 and 3), 22 s (2 and 4) | 92 s ± 10 (72 s at 3 SD) | no alarm |

The flame radiometers saw both burns within about 7 s. The cabin smoke detector's scatter channel took 1 to 2 minutes.
Its obscuration channel never rose. During Sample 1 it fell by at most 0.02 (about 0.5 %), below the 5 SD margin. If a
fall means more obscuration (less light reaching the sensor), that would cross a 3 SD margin. RULES.md, written first,
counts only rises, so it stays "no alarm" here, with this note.

## Decisions and limits
- **No real alarm setpoint.** Published thresholds are physical (ISS 1 %/ft obscuration; about 10 mg/m3), but the PSI
  channels are raw counts with no calibration, so a statistical threshold is used and labelled as such.
- **Sample numbering.** Igniter 1 is taken as Sample 1 (concurrent) and igniter 2 as Sample 2 (opposed), following the
  order of the PSI-100 sample table. This is an inference.
- **Smoke baseline.** For both burns the scatter baseline still carries the tail of the earlier smoke, which is why
  3 SD and 5 SD differ so much for Sample 2 (27 vs 127 s).
- **E3 not run.** No published Saffire-III detector alarm time was found to compare against.
- The radiometers measure the flame inside the Saffire flow unit; the smoke detector sits in the Cygnus cabin. The gap
  between them combines detector type and the distance smoke had to travel.

## Corrections after an independent audit (15 Nov 2026)

The pass rules in RULES.md are unchanged. These are disclosures and bug fixes:

- **Radiometer timing.** The radiometers are logged about once a second, but their values are sample-and-hold and change only
  about every 5 s. "7 s" therefore means the signal crossed the alarm rule somewhere between 2 and 7 s. The data file now reports
  `resolution_s: 5` for the radiometers, and the site shows "7 s ± 5".
- **Smoke baselines.** Before Sample 2 and Sample 1 the cabin smoke detector still reads smoke left from the event before. This raises
  the 60 s baseline and its spread, so the smoke alarm times move a lot with the threshold (Sample 2: 27 s at 3 SD, 127 s at 5 SD).
  We tried a clean baseline from before the smoke wire; the leftover smoke trips it within seconds, so it is not a fair measure either.
  Headlines now give the range, not one number.
- **Placement.** The radiometers look at the sample inside the flow duct; the smoke detector is in the Cygnus cabin. The comparison
  mixes sensor type with position, and the headline says so.
- **3 SD on radiometers.** At 3 SD, radiometer 4 alarms 34 s into the smoke-wire puff, which has no flame. New check L1b reports this
  as a FAIL, and the 3 SD low end is no longer reported for radiometers.
- **Smoke-wire switch-off.** The wire pulses twice in the record; the build now takes the first pulse (on for 11 s), not a capped value.
