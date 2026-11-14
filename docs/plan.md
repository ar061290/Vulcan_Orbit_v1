# Vulcan Orbit

#### Fire safety for worlds without "up". Product plan for NASA Space Apps 2026, challenge: Flame in Freefall.

## 1. The product in one page

Vulcan Orbit is a fire-safety system for spacecraft cabins that locates a fire, predicts how it will behave, and responds to it, with every step grounded in NASA's microgravity combustion data and shown in one web dashboard.

Mukund's build is the MVP: a sensor dome with a machine-learning locator, a spread and flow predictor, and two response methods (ion wind and fine water mist). Everything else in this document is layered on top of that core.

The challenge brief asks for a web dashboard that summarises, ranks and interprets NASA's combustion investigations. The rig is our proof; the dashboard and the NASA data are what get scored for Relevance. Both have to ship.

**Stage MVP (Mukund's core) NASA data that drives it What the dashboard shows**

Locate Sensor dome + ML model that estimates where a heat or smoke source is in 3D

Saffire-III 1 Hz telemetry (radiometers, smoke detector); SAME / SAME-R smoke particle sizes

When each sensor type would have alarmed; where the source is, with error

Predict Model of flame spread rate and BASS-II (spread over PMMA vs flow Spread and extinction predictions smoke/heat flow and O2); FLEX (extinction, burning with ranges rate); station ventilation speeds

Respond Ion wind; ultrasonic fine water mist ACME E-FIELD Flames (electric fields

on microgravity flames); FLEX (CO2, He suppression)

Which response the evidence supports for this fire, and what is untested

Why this can win: most public entries for this challenge are dashboards over the same tables. In the partial scan we ran this morning, none modelled detection from NASA's Saffire and SAME data, and none closed the loop from locating a fire to responding to it. That is our lane.

## 2. The MVP in detail

### 2.1 Locate: find the source

##### What it is. Sensors on a dome report heat (and optionally smoke). A model estimates the source position.

Sensors. A PIR sensor only senses changes in heat, such as flicker, so it cannot give position. A single-point IR thermometer gives one averaged reading. To locate a source you need thermopile array sensors (AMG8833, 8 x 8 pixels, or MLX90640, 32 x 24). Two arrays a known distance apart give direction and range.

Model. Build two and compare them: a physics model (heat falls off with the square of distance; solve for position by least squares) and a small neural network. On small data the physics model usually wins, and showing that comparison is a Validity point.

NASA link. NASA's Saffire experiments watched real fires in orbit with a handful of radiometers and smoke detectors. Our dome is a bench-top version of that sparse-sensor problem. Scale the test source to Saffire's measured radiance and say plainly that it is an emulation.

##### Done means. Source placed at 25 known grid positions; mean and worst error reported in cm; a chart of error against number of sensors (2 to 6).

### 2.2 Predict: spread and flow

##### What it is. Given material, oxygen level and airflow, predict how fast flame spreads and whether it goes out; given ventilation, predict where smoke and heat drift.

Keep it small. A full combustion simulation is weeks of work. Fit small models to NASA tables instead, and always compare with the textbook formula (de Ris theory for spread, the d-squared law for droplets). The

2

##### strongest competitor reached about R 0.6 to 0.7 on spread and burning rate, which is close to the noise limit of the data, so do not promise more.

Flow. In orbit hot gas does not rise. Smoke goes where the ventilation carries it, at roughly 0.05 to 0.2 m/s on the station. A simple drift model on a grid is enough; label it a model, not validated fluid dynamics.

##### Done means. Two models with grouped cross-validation and prediction ranges; a drift animation for one cabin layout.

### 2.3 Respond: ion wind and fine mist

Ion wind (Mukund has the hardware). A high-voltage electrode drives a stream of charged air that can push or deflect a flame. NASA studied electric fields on microgravity flames in the ACME E-FIELD Flames experiment, so this has a direct NASA dataset behind it. Show our bench result next to NASA's, and state that ours is at Earth gravity.

##### Fine water mist. The challenge brief itself names water mist. An ultrasonic humidifier disc makes a fine mist safely and cheaply. This is also the sensible use of "ultrasound" in the project.

Ultrasound aimed at the flame. Park this. From memory, the sound-based extinguisher demos use deep bass moving a lot of air, not ultrasound, and small 40 kHz transducers will not move a flame. We know of no NASA dataset on it. Check before spending hours here.

##### Done means. One filmed trial per method on a small, safe source, with what changed measured by the dome's own sensors (before and after), not judged by eye.

### 2.4 MVP finish line: Saturday 23:30

##### • Dome reads sensors and logs to a file.

##### • Locator returns a position with measured error on the grid.

##### • One spread or extinction model trained on a NASA table, with ranges.

##### • One response trial filmed and measured.

##### • Dashboard live on a public link, showing the NASA investigations and the three stages with real numbers.

## 3. Baseline features (everyone has these; we must match them)

##### These come from the brief and from the competitor scan. None will win points on their own, but missing ones lose Relevance.

###### # Feature Why it is needed

B1 Explorer of NASA PSI combustion investigations with search and The brief's core ask filters

B2 Ranking of investigations by relevance to a mission type (station, Brief objective (a) lunar base, Mars base, rover, suit)

B3 Attributes per investigation: goals, fuels and sample shape, O and Brief consideration 2

2

airflow, variables, sensors

B4 Side-by-side comparison of investigations Brief consideration 3

B5 Grouping by hardware family (CIR, MDCA, MSG and flow duct) Brief consideration 5

B6 O and pressure sliders, including the 34% O exploration Common; brief consideration 6

2 2

atmosphere

###### # Feature Why it is needed

B7 A FLEX extinction or burning-rate model Most-used dataset across competitors

B8 An assistant that answers with citations "SI-powered" is in the title

B9 Earth applications tab (water mist, smoke detection, firefighter gear) Optional in the brief

B10 Public link, English text, sources list, SI-use statement Submission rules

## 4. Twenty-five features on top of the MVP

"Seen elsewhere" is from this morning's research pass, which opened roughly 15 of the public repos, so treat "none found" as "not found in what we checked". Hours assume one person driving one coding agent.

### Locate

###### # Feature What the user sees Data Hrs Seen elsewhere

1 Blind Spot timeline For each Saffire burn, when the radiometer, Saffire-III telemetry 5 None found smoke obscuration and smoke scatter channels would each have alarmed

2 Smoke miss map Which materials make smoke too fine for the SAME, SAME-R 4 None found station's detector to catch

3 Flicker test A flicker-based sensor stays silent on a Rig 3 None found steady hot source while the thermopile array finds it

4 Error vs sensor How location error shrinks from 2 to 6 Rig + simulation 2 None found count sensors

5 Physics vs neural Both locators on the same test points, Rig 3 None found net scored side by side

6 Detector placement Best spots for detectors when smoke follows Ventilation speeds 4 One, literature-based ventilation, not the ceiling

7 Dust or smoke? Why dust causes false alarms and how DAFT 2 None found

detectors tell them apart

8 Smoke drift view Animated drift of smoke with no buoyancy in Model 3 Rare

a cabin layout

### Predict

###### # Feature What the user sees Data Hrs Seen elsewhere

9 Spread predictor Spread rate vs airflow and O , next to the BASS-II 3 One strong entry

2

with baseline textbook formula

10 Extinction predictor Chance a droplet flame goes out, with a FLEX 2 Several

range

11 Cool-flame warning Conditions where a fire looks out but keeps CFI-G, FLEX 2 Rare burning invisibly

12 Moon and Mars Microgravity and Earth results shown as the PSI + 1 g tests 2 Several bounds two ends, with no invented in-between number

13 Ranges on Every prediction carries an honest All models 2 Rare everything plus-or-minus

14 Evidence gap map Conditions NASA has never tested, and the PSI tables 3 One or two

next experiment worth running

### Respond

###### # Feature What the user sees Data Hrs Seen elsewhere

15 Ion wind vs NASA Our bench trial beside NASA's electric-field E-FIELD Flames + 3 None found flame results rig

16 Ultrasonic mist trial Fine mist on a small source, measured by Rig 3 None found the dome

17 Suppressant CO2 vs helium vs nitrogen: which put flames FLEX 2 Rare comparison out at what level

18 Response evidence For a given fire, what the data supports and All 3 Rare card what is untested. A summary of evidence, not a flight procedure

19 Closed loop The locator's answer steers the mist nozzle Rig 5 None found to the source on its own

### Evidence and assistant

###### # Feature What the user sees Data Hrs Seen elsewhere

20 Traced answers Every number the assistant gives links to a PSI, NTRS 4 Several, partly dataset row or model output; otherwise it says "no NASA evidence"

21 Assistant scorecard 30 test questions with known answers; Gold set 3 None found accuracy and refusal rate published in the app

22 Rules written first Pass limits for the rig and models committed Repo 1 None found before testing; a check shown failing on purpose

23 Model cards with One plain page per model: data, method, Models 3 One strong entry "why" error, limits, and which inputs drove each prediction

24 Saffire replay A timeline of one orbital burn: ignition, Saffire 3 None found spread, each sensor's first alarm

### Story

###### # Feature What the user sees Data Hrs Seen elsewhere

25 India angle Framing for Gaganyaan and India's planned Framing only 3 None found

station; Telugu and Hindi summaries

Build order if time runs short: 1, 3, 15, 20, 2, 16, 9, 21, 4, 22, 24, 19, then the rest. Total for all 25 is about 73 hours of lane time; four lanes have about 80 between now and the Sunday freeze, shared with the MVP and the baseline. Expect to finish 10 to 14 of these.

## 5. Best ideas from other teams, folded in

##### We take the strongest idea from each public project we reviewed and either match it, beat it, or skip it on purpose. We borrow ideas, never code, and every team named here is credited in References.

###### Team Their best feature Verdict Where it lands in our build Owner

AstraFlame Five trained models with honest Take Features 9, 10, 13 Karthikeya error ranges

AstraFlame Habitat map at the 34% O Take Baseline B6 Dashboard

2

exploration atmosphere

###### Team Their best feature Verdict Where it lands in our build Owner

AstraFlame Recommender for the next Take Feature 14 Karthikeya experiment NASA should run

AstraFlame Shows which inputs drove each Take (new) Feature 23, model cards Karthikeya prediction

AstraFlame ESP32 rig reading O2, pressure, Beat Our rig also locates the source and Mukund, Chris airflow responds to it

SPICA Coverage verdicts, such as solids Take Feature 14: one headline verdict per gap Karthikeya never tested above 22.2% O2

SPICA 3D space-station glovebox view Skip High effort, low score

FlameAtlas Evidence cards with confidence Take Features 18, 20 Assistant lane and gap flags

FlameAtlas Flammability map Take Baseline B6 Dashboard

Faruk042 Smoke-detector digital twin: Beat alarm time by detector position

Features 1 and 6, driven by NASA Karthikeya, telemetry instead of textbook values Mukund

Faruk042 Monte Carlo runs of many what-if Take if fast Feature 26: run Mukund's drift model a Mukund fires (new) few hundred times with varied start point and airflow; report the share of fires caught in time

samuelakosa Hidden-risk zone: passes on Take Baseline B6, as a highlighted band Dashboard Earth, may burn in the habitat atmosphere

samuelakosa Offline app with on-device Q&A Skip Saved demo answers already cover

reliability

AFAQ Pipeline over the whole PSI Skip We need about six tables, not the archive archive (about 8 million rows)

AFAQ 270 automated tests Take a slice Feature 22: a dozen checks that matter Evidence lane

Fire-X 3D-printed sensor enclosure Skip A cardboard or acrylic dome is enough

Several Compare and network views of Take Baseline B4 Dashboard investigations

Net effect: two additions (the "why" on each prediction, and feature 26, the what-if runs), four deliberate skips, and two head-to-head overlaps where our version has to be visibly better. Roughly ten more public repos were not opened, so this table is not the whole field.

## 6. Models to train

### Which data trains which model

##### Dome data and NASA data do different jobs. The dome is our experiment at Earth gravity; NASA's data is the record of real fires in orbit. Neither can stand in for the other.

###### Model or result Trained or measured on Why

Source locator Dome data (Mukund) It must learn from the actual sensors it will run on

Ion wind and mist trials Dome data (Mukund) Before and after readings exist only on the rig

Smoke drift and what-if runs Model, set with NASA ventilation speeds; A simulation, not a fit to either dataset

checked against the dome where possible

Detection latency NASA Saffire-III telemetry Real fires burned in orbit; cannot be recreated on a bench

###### Model or result Trained or measured on Why

Smoke miss risk NASA SAME, SAME-R Real smoke measured on the station

Flame spread NASA BASS-II Flames behave differently without gravity; an Earth flame teaches the wrong answer

Extinction, cool flames NASA FLEX, CFI-G Same reason

Why not train everything on the dome: the dome sits at Earth gravity, so a spread or extinction model trained on it predicts Earth fires; NASA data must be used to be eligible for a Global Award, and the brief is about interpreting NASA's investigations; and the dome's data does not exist until the rig is built, while the NASA tables can be downloaded now.

Where the two meet: one screen showing the dome's bench result beside NASA's orbital result for the same question (feature 15 for ion wind, feature 3 for detection), with a plain note on where they agree and where they differ. That comparison is the point of having both.

### Model list

Every usable NASA table has between 13 and about 270 rows. Small data is easy to overfit, so every model is tested on groups it never saw (a whole burn or test session held out) and reported with a range.

###### Model Question it answers Data Method Honest expectation

Source locator Where is the fire? Rig grid + simulated Least squares on an

readings inverse-square model; small neural net as comparison

A few cm on a 30 to 50 cm bench; measure, do not assume

Detection latency Which sensor alarms Saffire-III telemetry first, and when?

Change detection per channel; Descriptive; few burns, compare by burn so report each one

Smoke miss risk Will the detector see this SAME, SAME-R material's smoke?

Classifier: below the detector's A competitor's size sensitive size or not regression only reached R2 0.43, so classify instead

Flame spread How fast does it spread BASS-II Physics formula plus a learned R2 around 0.6

at this flow and O2? correction

Extinction Will the flame go out? FLEX Logistic or Gaussian-process AUC around 0.8 to 0.87 classifier

Smoke drift Where does smoke go? Ventilation speeds Drift-and-spread grid model Illustrative only

Traps to avoid: a deep network on 270 rows; any Moon or Mars gravity prediction (NASA's archive has no partial-gravity data); a single "fire risk score" with no published formula; training the locator on a flickering Earth candle and calling it space-ready.

## 7. The assistant (LLM)

##### Its job is to explain and to point at evidence. It never does arithmetic or invents a value.

##### • Library. 40 to 80 NASA reports and the PSI investigation pages, split into passages with page numbers.

##### • Rule. Any number in an answer must come from a lookup of a dataset row or a model output, shown with its source. If there is nothing, it says "no NASA evidence".

##### • Scorecard. 30 questions with known answers, scored for correct numbers, valid citations and correct refusals, shown in the app.

##### • Model. Claude Haiku 5.5 for answers (about $0.10 per million input tokens and $0.50 per million output at the time of writing; check the live price). A weekend of demo use costs cents.

##### • Key safety. The site is public, so the API key sits in a small Cloudflare Worker with a rate limit and a spend cap, never in the page.

##### • Never fails on stage. Answers to the scorecard and demo questions are saved as static files, so the demo works with no live call.

## 8. Who does what

##### Suggested split. Swap names to fit skills, but keep one owner per lane.

**Lane Owner Owns First deliverable (suggested)**

A. Rig and firmware Chris Dome, sensors, wiring, logging, response Sensor readings in a file by hardware 13:00

B. Models Mukund Locator, spread and extinction models, drift Locator error on the grid by model 18:00

C. Data and dashboard Karthikeya NASA tables, investigation explorer, charts, Public link with the explorer by deploy 13:00

D. Evidence, assistant, Fourth teammate Report library, assistant, scorecard, model 30 test questions drafted by story cards, video, project page 13:00

###### When (IST) Milestone

Sat 13:00 Live link shows NASA investigations; sensors logging; NASA tables downloaded

Sat 18:00 Locator works on the grid; Blind Spot timeline (feature 1) on the dashboard

Sat 23:30 MVP complete (section 2.4). Decide cuts.

Sun 12:00 Response trials filmed and measured; assistant scored; features 2, 3, 15, 16 in

Sun 16:00 Feature freeze

Sun 16:00 to 20:00 30-second video, project page, final number check

Sun 21:00 Submit (deadline is 23:59)

## 9. Safety and rules

### Safety (the team are under 18)

##### • Ion wind is high voltage. Keep it enclosed, run it only with an adult present, keep it away from anything flammable, and ventilate (it makes ozone). Never touch it while powered.

##### • Heat sources. Prefer a soldering-iron tip in a holder, a 12 V bulb or a heated resistor in a metal can. A tea light only on a metal tray, with an adult and an extinguisher or wet towel at hand.

##### • Ask the Hyderabad Local Lead before any open flame or high-voltage demo at the venue.

##### • No taser or spark-gap build. It adds hazard and nothing the judges score.

### Rules that can disqualify us

##### • Demo is a video of 30 seconds or less, or 7 slides or fewer.

##### • No faces, voices or recognisable names of anyone under 18 in the video or page. Film hands and hardware only; use subtitles.

##### • NASA data must be used to be eligible for a Global Award.

##### • Disclose all SI use: which agents wrote what, and that the idea is the team's. Watermark any SI-made images or video. No NASA logos in SI-made content.

##### • Live site, repo and video must open in a private window with no login.

##### • List every dataset, paper, library and outside idea in References.

##### • Re-read the 2026 Project Submission Guide and Judging and Awards Guide yourselves; parts of what we could fetch were older editions.

## 10. Claims we must not make

##### • That the rig detects or fights microgravity fires. It tests Earth-gravity assumptions on a bench.

##### • Any prediction for Moon or Mars gravity. Only bounds between microgravity and Earth are honest.

##### • That ion wind or mist "works in space" because it worked on our bench.

##### • That a model certifies a material as safe.

##### • A 3D accuracy figure we have not measured on the grid.

##### • That station smoke detectors fail in general. The documented weakness is with very fine smoke from specific materials.

##### • "First ever". Say "not found in the public projects we reviewed".

## 11. Check before relying on these

##### • Row counts and dataset IDs come from competitor READMEs via the research report; confirm on the PSI site.

##### • Whether PSI downloads need an account: sources disagree, so register one now.

##### • The exact contents of the E-FIELD Flames table (reported as 32 rows).

##### • Sound-based fire suppression details and the station's water-mist extinguisher: stated from memory, not verified today.

##### • How many projects the Hyderabad event can nominate: ask the Local Lead.

## Sources

Challenge text (mirror of the official page): hackathlone.com/challenges/flame-in-freefall NASA PSI combustion search: psi.nasa.gov/physci/repo/search?q=combustion SAME smoke detector analysis: pmc.ncbi.nlm.nih.gov/articles/PMC7918997 Station ventilation requirement: ntrs.nasa.gov/api/citations/20150009509 Flame detection with PIR sensors (Toreyin et al.): semanticscholar.org, paper aec3b7c8 Fire localisation with sensor arrays: ieeexplore.ieee.org/document/10853407 Ideas credited to other teams: AstraFlame (github.com/Dumbo-programmer/NASA-Space-Apps-2026), SPICA (github.com/eres0045/spica-firelab), FlameAtlas (github.com/syedmehedihussain/FlameAtlas), Faruk042 (github.com/Faruk042/NASA\_Flame\_In\_Freefall\_2026), samuelakosaonyejekwe (github.com/samuelakosaonyejekwe/flame-in-freefall), AFAQ (github.com/YoussefHegazy74/flame-in-freefall), Fire-X (github.com/Hekimovraiz/Fire-X\_Prototype)

Space Apps guides: spaceappschallenge.org/resources (participant FAQs, submission guide, judging guide)

Claude pricing: anthropic.com/api Full detail and more links: the deep-research report in the project chat, 14 Nov 2026.
