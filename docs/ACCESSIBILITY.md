# Accessibility notes

Target: WCAG 2.1 AA for the recruiter UI. Checked with axe-core (through `@axe-core/playwright` in `apps/web/e2e/demo.spec.ts`), a keyboard walk-through, and contrast ratios computed from the palette. 0.1.0 pass on 2026-10-19; 0.2.0 pass (dark theme, settings tabs, skip link) on 2026-10-21.

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

## Dark theme (0.2.0)

`[data-theme=dark]` in `apps/web/src/index.css` redefines the shadcn tokens. Ratios computed with the WCAG 2.x relative-luminance formula (sRGB); `color-mix` borders resolved in sRGB.

| Token                           | Value                                   | Against              | Ratio          | AA                          |
| ------------------------------- | --------------------------------------- | -------------------- | -------------- | --------------------------- |
| foreground `#F5F7FA`            | body text                               | background `#0B0F14` | 17.9:1         | pass                        |
| foreground                      | card text                               | card `#151B23`       | 16.1:1         | pass                        |
| primary = brand `#F26B1D`       | headings, links, selected tab, h1       | background           | 6.3:1          | pass                        |
| brand                           | links inside cards, AI badge border     | card                 | 5.7:1          | pass                        |
| primary-foreground = ink        | text on primary buttons, badges, banner | brand                | 4.8:1          | pass                        |
| white                           | not used on brand in dark               | brand                | 3.1:1          | fails, hence ink on brand   |
| muted-foreground `#B8C0CC`      | hints, secondary text                   | background / card    | 10.5:1 / 9.4:1 | pass                        |
| destructive = red-400 `#F87171` | errors                                  | background / card    | 7.0:1 / 6.3:1  | pass                        |
| border (35 % white) `#606366`   | card and input outlines                 | background           | 3.2:1          | pass (non-text, 3:1)        |
| border                          | outlines inside cards                   | card                 | 2.9:1          | below 3:1, decorative only  |
| input (45 % white) `#797B7E`    | input outlines in cards                 | card                 | 4.1:1          | pass (non-text)             |
| brand-dark `#C2410C`            | rejected for dark text                  | background           | 3.7:1          | fails, so dark uses `brand` |

Decisions: `primary` is `brand-dark` in light and `brand` in dark, so components use `text-primary` / `bg-primary text-primary-foreground` instead of raw palette classes and get the right pair in both themes. The primary button hover in dark is `brand` at 85 % (ink text stays above 4.5:1). `color-scheme: dark` makes native selects, inputs and scrollbars follow. The theme is written to `<html data-theme>` by an inline script before first paint; `system` follows `prefers-color-scheme` and updates on change.

axe on `/settings/general` in both themes: 0 violations of any impact (asserted at critical/serious in the e2e).

## axe results (0.1.0)

Pages: landing, jobs list, kanban with the candidate drawer open, settings. Before the pass axe reported one moderate rule, `page-has-heading-one`, on the app pages (the header title was a plain link). The header is now the page's `h1`. After the fix: **0 violations of any impact** on all four pages. The e2e test fails CI on any critical or serious violation.

## Keyboard

Map (0.2.0):

| Where                       | Keys                                                                                                                                                                               |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Every page                  | Tab once from the page start: "Skip to content", visible on focus, moves focus to `<main>`                                                                                         |
| Header                      | Tab through HRmit, Jobs, Settings; the current page has `aria-current="page"`                                                                                                      |
| Settings sidebar (tab list) | Tab lands on the selected tab; ArrowDown / ArrowUp (and Right / Left) move and activate, wrapping; Home / End jump to first / last; focus ring 3 px in brand orange in both themes |
| Settings forms              | Native selects (language, theme), inputs and buttons in DOM order                                                                                                                  |
| Kanban                      | Tab over the cards, Enter / Space opens the drawer; stage change through the "Move to stage" select                                                                                |
| Dialogs and drawer          | Focus trapped, Escape closes, focus returns to the opener                                                                                                                          |

- Kanban cards are `<button>`s: Tab reaches every card in column order, Enter or Space opens the drawer. The focus ring is `focus-visible:ring-3 ring-ring/50` in brand orange on every card, job card, button and the language switch.
- Drag-and-drop is pointer-only (dnd-kit `PointerSensor`). The keyboard path is the native `<select>` "Move to stage" in the drawer, which the e2e test exercises. dnd-kit's own keyboard sensor is a possible later addition.
- The drawer is a Radix `Dialog`: focus moves in on open, is trapped, Escape closes and focus returns to the card.
- Scorecard scores are a native radio group per question; the "Blind screening" toggle is a labelled Radix `Switch`; delete confirmations use the native `confirm()` dialog.
- Tab order follows the DOM: skip link, header links, page actions, cards, drawer.

## Labels and roles

- Icon-only buttons (edit job, move up / move down) carry `aria-label`s from the i18n files.
- The demo banner is `role="status"`; move and delete failures are `role="alert"`; the "Asking the model…" line is `aria-live="polite"`.
- Kanban columns are `<section aria-label="<stage>">`, which screen readers list as regions.
- The landing-page language switch uses `aria-pressed`; the pipeline / interview guide switch and the settings sidebar use `role="tablist"` with `aria-selected`, the sidebar with `aria-orientation="vertical"`, `aria-controls` and a roving `tabindex`.
- The logo `<img>` has an empty `alt`: the `h1` next to it already says "HRmit".

## Known limits

- Hover on primary buttons drops to 3.1:1 (white on `#F26B1D`); only the hover state, the resting state passes.
- The typing effect on fresh AI results reveals text progressively; with `prefers-reduced-motion: reduce` it shows everything at once. A screen reader that reads the region while it is typing hears partial text; the "Regenerate" button re-reads it complete.
- In dark, outlines of nested boxes inside cards are 2.9:1 against the card, just under the 3:1 non-text target; they are decorative (the content is readable without them).
