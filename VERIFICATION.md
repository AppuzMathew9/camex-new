# v27 verification report

## Passed in the available local environment
- `node --check script.js` — JavaScript parses successfully.
- BeautifulSoup HTML parse — page parsed; no duplicate element IDs found.
- Skip-link target exists and is focusable.
- Loader fallback canvas exists.
- Four scroll-story stage controls remain in the markup.
- Source-library Show All Feeds button retains its `aria-controls` target.
- CSS stylesheet parses with `tinycss2` without top-level syntax errors.
- 29 source-feed entries remain in the source-library data array.
- Debounced story video switching and stale-stage recheck remain in place.
- Reduced-motion rules remain present.
- HTML cache-busting versions match the updated stylesheet and script.

## Not verified here
- Full browser rendering/screenshot and interactive click/scroll test: the available headless Chromium process did not return a DOM before timeout in this environment.
- Actual video decoding, the 7.25-second loader-to-homepage cut, GPU/WebGL behavior, remote CDN/model loading, and scroll performance on your machine.
- Source-feed playback requires your original `assets/video/` directory; the patch ZIP intentionally does not contain those video files.

## Local acceptance test
1. Copy `index.html`, `styles.css`, `script.js`, `DESIGN.md`, and `VERIFICATION.md` into the existing `camex-redesign` folder; keep `assets/video/` unchanged.
2. Run `python -m http.server 8000` in that folder and open `http://localhost:8000`.
3. Confirm the loader hands off to the supplied `all.mp4` clip, then reveals the hero without a black gap.
4. Scroll through all four pipeline stages. Confirm each title, caption, progress marker, and video changes once per stage without repeated reloads while pausing near a boundary.
5. Confirm the library starts with 3 cards, expands to 29 feeds, and collapses to 3; confirm only visible/nearby clips begin loading.
6. Repeat with browser reduced-motion enabled and at a mobile viewport.


## v28 source-library update
- Reordered the existing 29-feed list so the initial three cards are People detection, Entry and exit count, and Security incident.
- The previous Overhead crowd, Perimeter driveway, and Retail crowd feeds remain in the library immediately after them; no clip was removed and the feed count is unchanged.
- Browser playback depends on the user's existing `assets/video/` files and still needs a local browser check.


## V32 use-case expansion checks
- JavaScript syntax: passed with `node --check`.
- HTML parsing: passed; no duplicate HTML IDs found.
- CSS parsing: passed.
- Scenario switcher: 9 tabs; each key maps to a scene definition and a local video source.
- Use-case grid: 9 cards; each card key maps to a scene definition.
- Browser runtime test: not completed. Playwright is installed, but the browser executable is not available in this environment, so interactive video playback and visual layout still require verification in the user's local browser.
- Keep `assets/video/` from the existing project. The patch archive contains project source files only.


## V33 loader recovery checks
- Independent loader-progress recovery added for the specific stuck-at-03% symptom.
- Cache-busting versions updated to `usecase-v33`.
- JavaScript syntax rechecked with `node --check`.
- Visual/browser verification remains unavailable in this environment because the headless browser navigation was blocked by the environment; verify locally after replacing the files.


## V35 asset mapping checks
- Source library no longer lists the two-thieves clip or camera-rotates/follows-subject clip.
- Motion scenario maps to `assets/video/garden_camera_feed.mp4`.
- ANPR scenario maps to `assets/video/number_plate_dectection.mp4`.
- Source library contains 28 unique feed entries.
- Browser playback still depends on the local files existing and has not been verified in this environment.


## V37 section order checks
- Use-case intro and grid now appear before the demo video layout in document order.
- All nine use-case cards remain present.
- JavaScript syntax and ZIP integrity checked; visual browser verification remains outstanding.


## V39 accessibility and grouping checks
- JavaScript syntax and HTML parse: checked.
- Nine use-case cards remain, with the expected scene keys.
- Internal grid scroll is disabled by CSS overrides; document scrolling remains the page-level scroll.
- Motion analysis workflow card present with three steps.
- Visual/browser interaction still needs confirmation in the local browser; no claim of full browser verification.


## V40 equal layout and interaction checks
- Desktop CSS explicitly sets 50/50 columns for video and right-side analytics panel.
- View footage action uses delegated click handling and native button semantics.
- Initial scenario observer now reads the active use-case card, not the removed demo-tab selector.
- JavaScript syntax, HTML parsing, mapping consistency, and archive integrity checked; browser click/playback verification remains outstanding.


## V42 compact trust section checks
- Added one combined cloud + partners section before the contact CTA.
- Cloud and partner rows use text wordmarks, avoiding unverified external logo URLs.
- Responsive CSS switches to a single-column heading/content layout.
- Static syntax and structure checks pass; browser visual verification remains outstanding.


## V43 homepage reduction and interaction checks
- Removed redundant `#platform` and `#stories` sections.
- Replaced the large multi-card `#pricing` section with a compact CTA section preserving `id=pricing`.
- Confirmed the key interactive sections remain: `#feed-wall`, `#live-demo`, `#industries`, FAQ, cloud/partners, and `#contact`.
- Added pointer spotlight/hover states with reduced-motion and touch safeguards.
- Browser visual and pointer testing remains required in the local browser.


## V44 CTA and moving logos checks
- CTA uses an inline SVG arrow and pointer event updates CSS variables for the glow position.
- Cloud and partner tracks each contain a duplicated aria-hidden set to support continuous marquee motion.
- Hover/focus pauses marquees; reduced-motion media query disables marquee animation.
- Top border removed from CTA band to avoid adjacent double horizontal rules.
- JavaScript syntax and archive integrity checked; browser visual QA not performed.


## V45 marquee motion checks
- Cloud animation duration is 20s; partner duration is 16s.
- No hover/focus pause rule remains.
- Reduced-motion mode uses a slower 90s animation.
- JavaScript syntax and archive integrity checked; live browser animation still needs visual confirmation.


## V46 seamless marquee layout checks
- Logo sets use flex-basis/width/min-width 100% with border-box sizing.
- Track remains a two-set continuous strip; translating -50% advances exactly one set width.
- Logo items do not shrink; mobile layout keeps the logo sequence aligned from the left.
- Static checks pass; visual browser confirmation remains outstanding.


## V47 loop seam checks
- Track uses max-content width; transform -50% therefore targets one half of the full two-set track.
- Each set receives the actual marquee viewport width via JavaScript and updates on resize/font readiness.
- JavaScript syntax and ZIP integrity checked. Live visual seam test still requires browser confirmation.


## V48 checks
- Static CSS no longer uses `justify-content: space-between` for logo sets.
- JS fills each set to exceed the marquee viewport, then copies it identically into the twin set.
- `node --check` and ZIP integrity are checked; actual live-browser seam still requires confirmation.


## V49 speed checks
- Cloud duration is 48s; partner duration is 40s.
- Opposite partner direction rule is preserved.
- Reduced-motion duration is 120s.
- Static CSS checks and archive integrity checked; browser motion not visually tested.


## V50 checks
- Final contact CTA section removed; footer preserved.
- Footer Contact link points to the sales email rather than a removed #contact target.
- Cloud/Partners ecosystem section has reduced bottom spacing and slide-up animation rules.
- Static source checks and ZIP integrity passed; browser visual verification still required.


## V51 correction checks
- `#contact.contact-section` absent.
- "Ready to see" CTA text absent from HTML.
- Footer retained.
- JavaScript syntax and ZIP integrity checked.


## V52 checks
- Section order: cloud ecosystem -> FAQ -> use-case CTA -> footer.
- 'Ready to see what you're missing?' heading absent.
- CTA retains .glow-cta and the cursor-position handler for --glow-x / --glow-y.
- JavaScript syntax and ZIP integrity checked; visual browser rendering still needs confirmation.


## V53 checks
- Transparent CTA background override is present.
- Cursor-position glow variables remain in CSS and existing JavaScript handler.
- JavaScript syntax and ZIP integrity checked; live browser appearance remains unverified.


## V54 checks
- Reference-style muted green/graphite CTA rules added.
- Existing cursor position handler remains in script.js.
- JavaScript syntax and ZIP integrity checked; actual browser rendering still needs confirmation.


## V55 CTA interaction checks
- CTA slide/blur entrance animation present.
- Cursor glow custom properties and existing pointer handler preserved.
- Hover/focus underline expansion and arrow translation present.
- Reduced-motion override present.
- Browser visual playback has not been independently verified in this environment.


## V56 checks
- Local radial-gradient glow rules present.
- Broad pseudo-element gradient replaced for .glow-cta.
- JavaScript syntax and ZIP integrity checked; live browser pointer behavior remains unverified.


## V57 checks
- CTA pointer handler initializes the glow hidden and updates coordinates on pointerenter/pointermove.
- CSS uses cursor-local radial gradient and opacity controlled by --glow-strength.
- JavaScript syntax and ZIP integrity checked; live browser rendering remains unverified.


## V58 checks
- Cursor coordinates update on pointerenter/pointermove and mouseenter/mousemove.
- Dynamic radial gradient uses the live --glow-x/--glow-y coordinates on the CTA background.
- JavaScript syntax and ZIP integrity checked; live browser rendering still requires user-side confirmation.
