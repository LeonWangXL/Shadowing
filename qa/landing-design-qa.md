# Shadowing landing page — option 2

Selected source: `qa/landing-option2.png`, displayed ideation option 2.
Source dimensions: 877 × 1793; implementation desktop viewport: 1440 × 970, deviceScaleFactor 1, full page approximately 2970 px tall.
Comparison normalizes both artifacts to 720 px wide without changing aspect ratio.

## Initial comparison

Evidence: `qa/landing-comparison.png` (reference left, implementation right).

- P2: Chinese hero and section headings rendered thinner than the source. Corrected the landing-only stack to prefer the already installed open-source Noto Serif SC and allowed weight synthesis for fallback H1/H2. Trainer typography is preserved.
- Expected product constraint: use an authentic screenshot of the eight-cue built-in trainer instead of the mock's invented two-cue preview. Existing Focus Studio identity, actual group controls and source caption remain truthful.
- Expected product constraint: supported speed range is 0.6–1.2x, not the mock's 0.5–2.0x. User-selected controls carry into practice; unmodified controls preserve prior practice settings.
- P3: the decorative gold underline in the mock is omitted. It has no interaction or product meaning.

## Verification

Browser checks cover desktop 1440 px, tablet 768 px and mobile 390 px; no horizontal overflow, image loaded, real practice and return navigation, anchor links, expandable FAQ, switch and settings carry-over, no page JavaScript errors.

Required fidelity surfaces: centered serif headline with Chinese serif fallback; warm-white/forest-green existing tokens; roomy hero and four-step rhythm; authentic crisp application image; source headline, section order and truthful product copy. More FAQ content is an explicit interactive expansion, initially collapsed.

## Final post-fix comparison

Opened `qa/landing-comparison-final.png` (reference left, rendered page right) and `qa/landing-hero-comparison.png` for readable headline detail. The earlier P2 title weight is resolved. Centered hero, preview frame, four-step workflow, two feature columns, FAQ, CTA and footer preserve the selected composition. Full-page height approximately 2970 px corresponds closely to the reference's proportional height at 1440 px width. Native mobile/tablet reflow passes without horizontal overflow.

Colors: existing forest green, warm white and pale sage preserved. Typography: Chinese serif headline now retains source weight and hierarchy, with platform fallbacks. Spacing: generous hero, aligned preview and balanced section intervals preserved. Image: real 1440 × 970 screenshot, no invented scores. Copy: headline and order match; speed range and privacy/service boundaries reflect actual functionality. Remaining P3: decorative gold underline omitted; generated texture and exact glyph shapes differ across platforms.

No outstanding P0/P1/P2 findings. Build, 28 unit/API tests, four Sites packaging tests, landing browser and article browser checks pass.

final result: passed
