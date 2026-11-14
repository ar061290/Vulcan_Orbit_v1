"""Build data/india.json: the India angle, every fact with its verification level and source.
Facts come from research_notes/Flame in Free Fall research/india.md (checked 14 Nov 2026). Run: python scripts/build_india.py"""
import json
from pathlib import Path
R = Path(__file__).resolve().parents[1]
F = [
 dict(topic='Bharatiya Antariksh Station', level='official', text='The Union Cabinet approved the first module, BAS-1, for launch by December 2028, and an operational Bharatiya Antariksh Station by 2035.',
      source='Press Information Bureau, Government of India, 18 Sep 2024', url='https://pib.gov.in/PressReleasePage.aspx?PRID=2055992'),
 dict(topic='Indian microgravity smoke research', level='official', text='ISRO funds an IIT Madras project to build an experimental setup that characterises smoke and soot from flaming and smouldering materials in microgravity (Phase II, listed as under development).',
      source='India Science, Technology & Innovation portal, Government of India', url='https://www.indiascienceandtechnology.gov.in/technologies/smoke-characteristation-flaming-and-smouldering-materials-micro-gravity-phase-ii'),
 dict(topic='Gaganyaan schedule', level='official via news', text='In a 29 Jul 2026 Lok Sabha reply the government said work towards the first uncrewed mission, G1, is in progress. In September 2026 the ISRO chairman said G1 is being readied for launch this year, with crewed flight in 2027 if all three uncrewed missions succeed. No Gaganyaan flight had launched as of 14 Nov 2026.',
      source='CXO Digital Pulse (Lok Sabha reply); Starlust, 6 Sep 2026', url='https://starlust.org/indias-uncrewed-gaganyaan-test-mission-getting-ready-for-launch-in-late-2026-isro-chief-confirms/'),
 dict(topic='Gaganyaan fire hardware', level='news only', text='According to a May 2026 report in The Hindu, the Gaganyaan crew module carries smoke detectors and fine water-mist fire extinguishers. We found no ISRO document confirming this.',
      source='Drishti IAS summary of The Hindu, 22 May 2026', url='https://www.drishtiias.com/daily-updates/daily-news-analysis/gaganyaans-environmental-control-and-life-support-system/print_manually'),
]
NOT = ['The oxygen fraction of the Gaganyaan cabin air: no official or press source gives it, so this site does not state one.',
       'The planned atmosphere (oxygen and pressure) or fire-safety design of the Bharatiya Antariksh Station.',
       'Any Indian combustion experiment flown in orbit. The Axiom-4 experiments selected by ISRO were not combustion studies.']
out = dict(status='reported', checked='2026-11-14',
  source='Public Indian government pages and news reports, collected 14 Nov 2026; see each fact. None of these were measured by us.',
  levels={'official': 'Read on a Government of India page', 'official via news': 'An official statement we saw only as reported by news', 'news only': 'Press report; no official document found'},
  facts=F, not_found=NOT,
  link='Why it matters here: a long-stay Indian station will face the same problems the NASA data shows: fine smoke that light-scattering detectors see weakly, and flames carried by ventilation airflow. That link is our reading, not an ISRO statement.')
(R / 'data/india.json').write_text(json.dumps(out, indent=1, ensure_ascii=False)); print('facts', len(F))
