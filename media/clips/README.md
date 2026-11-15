# Demo clips

Drop screen recordings here with these exact names and the demo page shows them automatically
(muted, looping). Keep each under ~15 MB (H.264 .mp4, 720p is plenty):

| File | Demo |
|---|---|
| `detect.mp4` | 01 Flame detection: YOLO boxes on a live camera feed |
| `depth.mp4` | 02 3D location and volume: the app's 3D view with distance and volume |
| `smoke.mp4` | 03 Smoke sensor: the optical sensor reacting to smoke (this demo stays hidden until the clip exists) |
| `risk.mp4` | 04 Risk: the LLM risk assessment running (optional) |

Re-encode a phone/OBS clip: `ffmpeg -i in.mov -vf scale=-2:720 -c:v libx264 -crf 26 -an -movflags +faststart detect.mp4`
