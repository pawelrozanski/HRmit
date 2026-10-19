# Accessibility notes for 0.1.0

Target: WCAG 2.1 AA for the recruiter UI. Checked on 2026-10-19 with axe-core (through `@axe-core/playwright` in `apps/web/e2e/demo.spec.ts`), a keyboard walk-through, and contrast ratios computed from the palette.

## Palette contrast

| Text                 | Background      | Ratio         | AA              | Where it is used                                            |
| -------------------- | --------------- | ------------- | --------------- | ----------------------------------------------------------- |
| ink `#1F2937`        | cream `#FFF7F0` | 13.8:1        | pass            | body text                                                   |
| ink                  | white           | 14.7:1        | pass            | cards, drawer                                               |
| brand-dark `#C2410C` | white           | 5.2:1         | pass            | headings, links, job titles                                 |
| brand-dark           | cream           | 4.9:1         | pass            | landing headings, back links                                |
| white                | brand-dark      | 5.2:1         | pass            | primary buttons, badges, demo banner, pressed language      |
| brand `#F26B1D`      | white / cream   | 3.1:1 / 2.9:1 | fails for text  | not used for text; borders, focus ring, drop highlight only |
| white                | brand           | 3.1:1         | large text only | primary button hover state only                             |
| muted-foreground     | cream / white   | ≥ 4.5:1 (axe) | pass            | secondary text, hints                                       |

What changed for the release: the shadcn `primary` token moved from `brand` to `brand-dark`, so every default button, the "AI suggestion" badge, the checked score cell and the pressed language button are white on `#C2410C` (5.2:1) instead of white on `#F26B1D` (3.1:1, below AA for 14 px text). The bright orange stays as the hover colour, border and ring, where it is not carrying text.

## axe results

Pages: landing, jobs list, kanban with the candidate drawer open, settings. Before the pass axe reported one moderate rule, `page-has-heading-one`, on the app pages (the header title was a plain link). The header is now the page's `h1`. After the fix: **0 violations of any impact** on all four pages. The e2e test fails CI on any critical or serious violation.

## Keyboard

- Kanban cards are `<button>`s: Tab reaches every card in column order, Enter or Space opens the drawer. The focus ring is `focus-visible:ring-3 ring-ring/50` in brand orange on every card, job card, button and the language switch.
- Drag-and-drop is pointer-only (dnd-kit `PointerSensor`). The keyboard path is the native `<select>` "Move to stage" in the drawer, which the e2e test exercises. dnd-kit's own keyboard sensor is a possible later addition.
- The drawer is a Radix `Dialog`: focus moves in on open, is trapped, Escape closes and focus returns to the card.
- Scorecard scores are a native radio group per question; the "Blind screening" toggle is a labelled Radix `Switch`; delete confirmations use the native `confirm()` dialog.
- Tab order follows the DOM: header links, language switch, page actions, cards, drawer.

## Labels and roles

- Icon-only buttons (edit job, move up / move down) carry `aria-label`s from the i18n files.
- The demo banner is `role="status"`; move and delete failures are `role="alert"`; the "Asking the model…" line is `aria-live="polite"`.
- Kanban columns are `<section aria-label="<stage>">`, which screen readers list as regions.
- The language switch uses `aria-pressed`; the pipeline / interview guide switch uses `role="tablist"` with `aria-selected`.
- The logo `<img>` has an empty `alt`: the `h1` next to it already says "HRmit".

## Known limits

- Hover on primary buttons drops to 3.1:1 (white on `#F26B1D`); only the hover state, the resting state passes.
- The typing effect on fresh AI results reveals text progressively; with `prefers-reduced-motion: reduce` it shows everything at once. A screen reader that reads the region while it is typing hears partial text; the "Regenerate" button re-reads it complete.
- Light mode only. The palette is not tuned for `prefers-color-scheme: dark`.
