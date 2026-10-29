# Camex visual system and motion notes

## Visual direction
- Keep the existing charcoal/navy surfaces and electric-blue/cyan signal colors.
- Use Manrope for interface/headline typography and DM Mono for telemetry labels.
- Prefer a single strong focal media frame, restrained HUD overlays, and readable copy over extra decoration.
- Preserve the existing loader, supplied footage, 4-stage scroll story, source library, scenario tabs, and real COCO-SSD-only detection overlays.

## Motion rules
- Scroll progress updates remain requestAnimationFrame-throttled.
- Story video swaps stay debounced and re-check the active stage before loading.
- Stage copy transitions use opacity/transform; do not animate layout dimensions.
- Source library videos remain lazy-loaded and hidden feeds remain dormant until expanded.
- Reduced-motion users receive near-instant UI transitions and no cinematic video zoom.

## Accessibility and interaction
- Keyboard users get a visible Skip to content link.
- Existing focus-visible states are retained and extended.
- Buttons retain semantic button elements; navigation remains links.
- Dark color-scheme matches the product's visual theme.

## Design references applied
- Taste Skill: audit-first visual refinement, intentional type/spacing/color/motion.
- Vercel Web Interface Guidelines: focus states, reduced motion, readable headings, touch behavior, and compositor-friendly animation.
- Image-to-Code workflow: preserve the supplied visual direction and implement a focused delta rather than rebuilding the page.
- Awesome DESIGN.md: document explicit design tokens and reusable visual rules rather than importing an unrelated brand identity.
- Playwright CLI: use browser-level regression checks when available; the included project itself does not require the CLI at runtime.
