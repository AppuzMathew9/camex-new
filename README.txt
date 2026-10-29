CAMEX V78 — TARGETED PATCH ONLY (NO MEDIA FILES)

IMPORTANT: Do NOT use this as a replacement project folder. This patch intentionally contains only script.js and styles.css so your existing assets/video folder stays intact.


Changes in this patch:
- Mobile scenario video and selector share the same row. The selector has its own vertical scrolling area, so the video stays visible while scenarios change.
- Video muted/inline/autoplay properties are set before assigning/loading the source.
- The selected video is revealed on loadeddata/canplay and play() is requested after a decoded frame is available.
- Missing clips are logged with the exact expected path; a still background should not be mistaken for a playing video.

This patch does not include MP4 binaries. The video files must remain in your original assets/video folder. If the files are missing from the folder currently served by localhost:8000, no HTML/CSS/JS patch can make those clips play.
