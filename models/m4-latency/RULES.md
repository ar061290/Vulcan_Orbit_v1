# M4 detection latency: pass rules (written before any check is run)

Data: Saffire-III flight telemetry, NASA PSI-100 (doi 10.60555/040q-4h36), file
`datasets/psi/PSI-100/PSI-100_Raw Data_Saffire_Data_Table2017.161.00.42.03-EU.csv`.

## Alarm rule (fixed before running)
- Baseline = mean and standard deviation of the channel over the 60 s before that event's igniter (or smoke wire) switches on.
- A channel alarms at the first reading above baseline + k x SD, with SD floored at one quantisation step of the channel
  (0.005 for the smoke channels, 0.01 for radiometers). k = 5 is the headline; k = 3 is reported beside it as the low end.
- Each event's window runs from its own switch-on to the next event's switch-on (or the end of the record).
- Why not a real alarm setpoint: published spacecraft thresholds are in physical units (ISS: 1 %/ft obscuration,
  NTRS 20170000248; about 10 mg/m3, NTRS 20170002629). The PSI-100 smoke channels are raw counts with no calibration,
  so those setpoints cannot be applied. This is stated in the output file.
- Timing resolution: radiometers about 1 s; smoke channels about 10 s (each reading appears twice in the file; the
  first copy is kept). Every alarm time carries plus or minus one reading interval.

## Checks
| Id | Check | Pass rule |
|---|---|---|
| L1 | Negative control: the smoke wire makes smoke but no flame | no radiometer alarms during the smoke-wire window |
| L2 | The rule can fail: replace a channel with its own baseline (flat signal) | that channel reports no alarm |
| L3 | Radiometer alarms are not igniter glow | alarm time counted only after the igniter switches off differs by at most 2 s |
| L4 | Every event is reported on its own | 3 events in the output, no averages across them |
| E3 | Reproduces a published Saffire-III alarm time | within one reading interval; if no published time is found: not run |
| L5 | Threshold sensitivity | reported, no pass rule: k = 3 vs k = 5 alarm times for every channel and event |

## Extension: rate-of-rise alarm (written 14 Nov 2026, before rate_of_rise.py was run)

Question: on the same Saffire-III smoke channels, would an alarm on how fast the signal rises fire earlier than M4's fixed
level alarm? NASA has proposed rate-of-rise logic for light-scattering detectors; we test it, we do not claim it.

- Channels: smoke scatter and smoke obscuration (the radiometers are flame sensors and stay as they are).
- Rise rate at each reading: (x(t) - x(t - 30 s)) / 30 s, using the nearest earlier reading at least 30 s back.
- Baseline: rise rates in the 300 s before the event starts (fewer than 8 values: the event is reported as "not enough baseline").
- Alarm: first reading after the event starts whose rise rate exceeds baseline mean + 5 SD (3 SD reported as the low end).
  SD floor: the M4 smoke floor (0.005) divided by 30 s.
- False alarms: the same rule run over every quiet stretch (more than 120 s before any event and not within 600 s after one);
  every crossing there is counted and reported.
- Pass (stated now): rate-of-rise alarms earlier than the fixed level in at least 2 of the 3 events AND has 0 false alarms in the
  quiet stretches. Each event is reported on its own; no averages. If it fails, the site says so.
