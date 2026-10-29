CAMEX V78 — TARGETED PATCH ONLY (NO MEDIA FILES)

IMPORTANT: Do NOT use this as a replacement project folder. This patch intentionally contains only script.js and styles.css so your existing assets/video folder stays intact.

Apply it to your ORIGINAL working project:
Camex_Motion_Storytelling_Website/camex-redesign/

1. Make a backup of the current script.js and styles.css.
2. Copy these two files over the matching files in the original camex-redesign folder.
3. Confirm the original video files remain in camex-redesign/assets/video/.
4. Keep these filenames unchanged (the current code references them):
   - construction_site_camera_feed.mp4
   - garden_camera_feed.mp4
   - overhead-crowd.mp4
   - workspace_camera_feed.mp4
   - perimeter-driveway.mp4
   - heat_sensor.mp4
   - mixkit-two-thieves-recorded-on-a-security-camera-31372-hd-ready.mp4
   - number_plate_dectection.mp4
   - highway_camera_feed.mp4
   - people_detection_hero.mp4
   - security-incident.mp4
   - mixkit-security-camera-rotates-and-follow-the-object-48922-hd-ready.mp4
5. Start the local server from the original project folder and hard-refresh the browser (Ctrl+F5).

Changes in this patch:
- Mobile scenario video and selector share the same row. The selector has its own vertical scrolling area, so the video stays visible while scenarios change.
- Video muted/inline/autoplay properties are set before assigning/loading the source.
- The selected video is revealed on loadeddata/canplay and play() is requested after a decoded frame is available.
- Missing clips are logged with the exact expected path; a still background should not be mistaken for a playing video.

This patch does not include MP4 binaries. The video files must remain in your original assets/video folder. If the files are missing from the folder currently served by localhost:8000, no HTML/CSS/JS patch can make those clips play.
