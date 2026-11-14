# Submission kit (draft for the team to check and edit)

Checked against the newest guides we could open (2022 submission guide, 2024 judging guide). **Confirm the 2026 rules and the
Hyderabad deadline on the event page before relying on any limit below.**

## Before submitting

- [ ] Hyderabad deadline confirmed: ______ (one 2026 event, Seoul, closes 23:59 local on 15 Nov)
- [ ] 2026 demo limit confirmed (2022 guide: video up to 30 s **or** up to 7 slides; judges may stop at the limit)
- [ ] Site, repo and video open in a private window, with no login
- [ ] Every number in the video appears on the site with the same value
- [ ] No faces, voices or names of anyone under 18 in the video or on the page
- [ ] Bench rig: only shown if real readings exist (status `dome`); otherwise it stays "No data yet" and out of the video

## Summary (short field)

Vulcan Orbit asks one question of NASA's orbital fire data: when would a spacecraft's sensors notice a fire? On NASA's
Saffire-III fires in a Cygnus cargo ship, a flame light sensor crossed our stated alarm rule 7 s after ignition; the cabin
smoke detector took 92-127 s and its second channel never alarmed. NASA's later Saffire VI test found much of the hazardous gas
already released by the time smoke reached its alarm level. Around that finding we model where smoke drifts with no buoyancy,
which droplet flames go out, and what NASA has not yet tested. Every figure says what made it and how much to trust it.

## Space agency data

| Dataset | Used for |
|---|---|
| NASA PSI-100 Saffire-III, doi:10.60555/040q-4h36 | Alarm timing, replay, smoke-drift tuning, rate-of-rise test |
| NASA PSI-69 FLEX, doi:10.60555/mbq8-0451 | Droplet extinction and burning-rate models; flame simulator checks; suppression counts |
| NASA PSI-39 CFI, doi:10.60555/m6pj-a914 | Cool-flame model |
| NASA PSI-25 BASS-II, doi:10.60555/4qc4-de67; NTRS 20210011385 | Flame-spread checks; gap map |
| NASA PSI-159 CFI-G, PSI-10 Flame Design, PSI-22 E-FIELD (doi:10.60555/se5a-8c73), PSI-47 DAFT (doi:10.60555/ztgj-d202) | Gap map, electric-field table, dust-counter card |
| NASA SAME-2, Urban et al. 2012, AIAA 2012-3536 (NTRS 20130000422) | Smoke particle sizes |
| Saffire VI, Urban et al., ICES-2024-365 (NTRS 20240002981) | Cabin gas rise vs crew limits (reported) |
| ISS airflow, NTRS 20150009509 | Cabin airflow range |

Full list with every paper and library: `REFERENCES.md`.

## Use of AI (state it plainly)

AI tools were used, and every session is logged in `AI_LOG.md` with the date, the tool, the feature and what it wrote.
Claude (Anthropic) wrote most of the code for the site, the data-processing scripts and several models, under the rules in
`AGENTS.md`: no invented numbers, a status label on every data file, pass rules committed before training, and failures
kept on the site. The team chose the questions, ran the builds, checked the numbers against the NASA sources and decided what
to claim. The flame and Earth images are computer illustrations, labelled as such, not photos or data.
*(Edit this to say who did what on the team.)*

## 30-second video (screen capture with captions, no faces)

| Time | On screen | Caption |
|---|---|---|
| 0-4 s | Home page title and porthole flame | "When would a spacecraft's sensors notice a fire? Built on NASA's orbital fire data." |
| 4-16 s | Replay, Sample 1 burn, press Play | "Real NASA telemetry. Flame sensor: 7 s. Smoke detector: 92 s. Alarm rule is ours, stated." |
| 16-23 s | "The alarm can come after the gas" figure | "In NASA's Saffire VI test, much of the toxic gas was out before the smoke alarm." |
| 23-28 s | Open a "Made by" box: credibility strip, a failed pass rule | "Every figure says what made it and how much to trust it, failures included." |
| 28-30 s | Gap map | "Microgravity and Earth only. No Moon or Mars guesses." |

Backup: a 60 s screen capture of the same path, in case the 2026 limit is longer.

## Claims to avoid (from AGENTS.md and the research)

- Smoke drift R² 0.90 is the fit to the burn it was tuned on, not validation (held-out puff: shape R² 0.05).
- Smoke miss failed its pass rule (AUC 0.746, range 0.44-1.00). Say "16 flight tests are not enough", not "it works".
- Rate-of-rise alarm failed its pass rule on Saffire-III. Say so if asked.
- Alarm times use our rule, not the Cygnus detector's setpoint.
- No Moon or Mars predictions; no "safe"; no "first ever" (say "not found in the public projects we reviewed").
