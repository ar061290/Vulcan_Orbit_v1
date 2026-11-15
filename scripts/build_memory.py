"""Build data/memory.json: the 'Sixty years of fire' history page. Every fact carries its source.
Facts were checked against the sources below on 14 Nov 2026 (research report in this conversation). Status: reported.
Rules for this page: lives first, no accident photos, no last words, no blame, every loss paired with what changed,
and no claim that this project would have saved anyone. Run: python scripts/build_memory.py"""
import json
from pathlib import Path
R = Path(__file__).resolve().parents[1]
E = [
 dict(year="1961", date="23 March 1961", title="Valentin Bondarenko", kind="loss", where="On the ground, Moscow: a low-pressure test chamber enriched with oxygen",
      text="A 24-year-old cosmonaut trainee near the end of a long isolation test. A piece of alcohol-soaked cotton landed on a hot plate and the oxygen-rich air let the fire spread fast. He died of his burns hours later, twenty days before Gagarin flew.",
      changed="His death was kept secret for 25 years and made public in April 1986. It is now remembered as the first warning that oxygen-rich air turns a small flame into a disaster.",
      sources=[["UPI, 4 April 1986 (reporting Izvestia)", "https://www.upi.com/Archives/1986/04/04/Soviets-disclose-1961-death-of-cosmonaut/8174512974800/"]],
      note="Some details (the chamber's exact oxygen level, how long he survived) differ between accounts; we give only what they agree on."),
 dict(year="1967", date="27 January 1967", title="Apollo 1: Gus Grissom, Ed White, Roger Chaffee", kind="loss", where="On the ground, Launch Pad 34, during a launch rehearsal",
      text="The cabin held pure oxygen at 16.7 psi. At 6:31 in the evening the crew reported a fire. About fifteen seconds later the cabin ruptured. The review board found no single cause and did not blame any one person.",
      changed="Flammable materials in the cabin were strictly limited, full-scale fire tests became normal, and a new hatch could be opened in about five seconds.",
      quote=["The Apollo team failed to give adequate attention to certain mundane but equally vital questions of crew safety.", "Apollo 204 Review Board"],
      sources=[["Report of the Apollo 204 Review Board (NASA)", "https://www.nasa.gov/missions/apollo/apollo-1/report-of-the-apollo-204-review-board/"], ["NASA: tribute to the Apollo 1 crew, 2017", "https://www.nasa.gov/news-release/nasa-unveils-tribute-to-crew-of-apollo-1"]]),
 dict(year="1970", date="April 1970", title="Apollo 13", kind="survived", where="In flight, on the way to the Moon",
      text="Wiring damaged during ground testing shorted inside an oxygen tank and set its Teflon insulation burning. The tank burst. The crew of three made it home.",
      changed="Teflon was removed from the redesigned tanks and the wiring was sheathed in stainless steel.",
      sources=[["NASA Apollo Flight Journal, post-flight", "https://history.nasa.gov/afj/ap13fj/30postflight.html"]]),
 dict(year="1971", date="30 June 1971", title="Soyuz 11: Georgy Dobrovolsky, Vladislav Volkov, Viktor Patsayev", kind="loss", where="Returning from the first space station, Salyut 1",
      text="Not a fire. A valve jolted open as the modules separated before re-entry, and the cabin lost its air. They are the only people to have died above the atmosphere.",
      changed="Soviet and Russian crews have flown in pressure suits for launch and landing ever since.",
      sources=[["NASA Safety and Mission Assurance: 'Descent into the Void'", "https://sma.nasa.gov/SignificantIncidents/assets/descent-into-the-void.pdf"]],
      note="Included because the cabin's air is life support: the same air a fire would poison."),
 dict(year="1997", date="23-24 February 1997", title="Fire on space station Mir", kind="survived", where="In orbit, six crew aboard",
      text="An oxygen-generating canister caught fire. The crew put on masks and used three extinguishers while smoke filled the station. Everyone survived. Official reports said about 90 seconds; astronaut Jerry Linenger later said the fire burned for about 14 minutes.",
      changed="It showed what our site is about: in orbit, smoke does not rise. It goes wherever the air carries it.",
      quote=["I've never seen smoke spread like it did on Mir.", "Astronaut Jerry Linenger"],
      sources=[["NASA Shuttle-Mir history", "https://spaceflight.nasa.gov/history/shuttle-mir/history/h-f-linenger-fire.htm"], ["NASA APPEL", "https://appel.nasa.gov/?p=279500"]]),
 dict(year="2016-24", date="2016 to 2024", title="Saffire: fires lit on purpose, with no one aboard", kind="research", where="In orbit, inside empty Cygnus cargo ships after they left the space station",
      text="NASA started burning large samples in unmanned cargo ships so no crew ever has to learn the hard way. In the last test, Saffire VI, a smoke monitor reached its alarm level at 981 seconds, after much of the hazardous gas had already been released.",
      changed="This is the data our site is built on.",
      sources=[["Urban et al., ICES-2024-365 (Saffire VI)", "https://ntrs.nasa.gov/citations/20240002981"]]),
 dict(year="2020-21", date="2020 to 2021", title="Saffire IV and V: the flame that came back", kind="research", where="In orbit, inside empty Cygnus cargo ships (NG-13 and NG-14)",
      text="In one cotton-fabric test the fan stayed off for 70 seconds. When the airflow returned, the flame grew back and burned for another 150 seconds. Two other samples showed small explosions from fuel vapour that had built up.",
      changed="A fire that seems to have gone out may not have. This is why our site has a page on cool flames and why the alarm timing matters.",
      sources=[["Urban et al., ICES-2021-266", "https://ntrs.nasa.gov/api/citations/20210011521/downloads/ICES%202021-266%200503-2021%20final.pdf"]]),
 dict(year="Next", date="Artemis and beyond", title="The air the next crews will breathe", kind="future", where="Moon landers, habitats and Gateway",
      text="NASA has studied lower-pressure, oxygen-richer cabin air for exploration, around 8 psi with about a third oxygen. Saffire VI came close, but no large-scale fire test has been run at those conditions yet.",
      changed="Our ask: pair flame-light sensors with smoke detectors in future fire tests, and test that air before crews breathe it.",
      sources=[["NASA/TP-2010-216134, Exploration Atmospheres Working Group", "https://www.nasa.gov/wp-content/uploads/2023/03/henninger-8.2-34-atm-tp216134-2010.pdf"]]),
]
out = dict(status="reported", checked="2026-11-14",
  source="NASA history pages, the Apollo 204 Review Board report, NASA safety case studies, UPI archive and NASA technical papers; see each entry. History, not our measurements.",
  framing="No one has died in a fire in orbit. The fire deaths below happened on the ground, in oxygen-rich air. What was learned from them is why NASA now lights its fires in empty spacecraft.",
  entries=E,
  dedication="Dedicated to Valentin Bondarenko, Gus Grissom, Ed White and Roger Chaffee, lost to fire in oxygen-rich air, and to every member of the spaceflight family who gave their life to exploration. Ad astra per aspera: a rough road leads to the stars.",
  remembrance=["NASA Day of Remembrance", "https://www.nasa.gov/image-article/nasas-day-of-remembrance-2026"])
(R / "data/memory.json").write_text(json.dumps(out, indent=1, ensure_ascii=False))
m = json.loads((R / "data/manifest.json").read_text())
if "memory" not in {f["name"] for f in m["files"]}:
    m["files"].append(dict(name="memory", status="reported", owner="Dashboard", what="Sixty years of fire: history page entries with sources"))
    (R / "data/manifest.json").write_text(json.dumps(m, indent=1, ensure_ascii=False))
print(len(E), "entries")
