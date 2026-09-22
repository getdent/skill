---
description: Design Dent Pages and Funnel Steps after copy is finished, using Designer JSON, tenant theme utilities, and page-type leaves.
---

# Design the Page

Use this after `writing/copywriting.md` has produced finished copy. The failure it prevents: building visual scaffolding before the argument exists, or writing frontend code instead of a Dent Designer element tree.

## The Design contract

A design document is `{ "version": 1, "elements": [...] }`. Allowed document keys:
`version`, `elements`, `stylesheets`, `scripts`, `builders`
(DesignerService::validatedDocument). `version` must be 1. `elements` must be a list.

Allowed element keys: `key`, `type`, `tag`, `id`, `styles`, `utilities`,
`attributes`, `text`, `content`, `config`, `behaviors`, `children`; a `component`
element adds `component`, `variant`, `properties`, `slots`
(DesignerService::validateElementShapes).

`classes` is not a key. It is a 422 `Unknown key: classes.`

`utilities` is the Tailwind list. `styles` is a list of Style keys, never Tailwind.

`key` must match `[a-z0-9][a-z0-9_-]*` and be unique across the whole document.

`text` and `content` cannot both be present on one element.

Revision: read `GET /api/v1/{owner}/{id}/design` → `{revision, design, owner}`; write
`POST /api/v1/{owner}/{id}/replace-design` with `{"revision": <the string just read>, "design": {...}}`.
A stale revision is a 409: re-read and re-apply. Owners: pages, articles,
funnels/{f}/steps, templates, components, settings.

`svg` config is `{ "tree": { "tag", "attributes", "content" }, "alt", "decorative" }` plus the optional `channels` (paint colors), `media` (an uploaded SVG file), `width`, `height`, `preserveAspectRatio`, `opacity`, and `link`
(Elements/Svg.php). An `id` on an svg is rewritten to `key` at save.

Publish rules (422 on a published owner, warning on a draft): every `form` needs a
non-empty unique `id`, a `form-submit` descendant, and named unique fields; an
`optin` behavior needs `config.email`; a `branch` needs `routes` plus a numeric
`fallback`; expressions must parse; a named script key must exist. A `checkout`
element needs the `checkout` behavior, `billing.email`, `billing.first_name`,
`billing.last_name` bound fields, a `checkout-payment`, and a `checkout-submit`
(DesignerService::validateCheckout).

An unknown `type` is kept with the warning `element.type_unknown`.

## Process

1. Establish the visual vision from the brief and finished copy.

   - Read the interview brief and the finished copy before authoring any JSON.
   - Use the brief's `register` field first, then `mood`, `visual_direction`, `audience`, `promise`, `proof_points`, and `objections` to choose one intentional direction.
   - `brand-led` means marketing and persuasion surfaces: opt-in Pages, sales Pages, upsells, landing Pages, homepages, and campaign Pages. Use the bold/brand register: one memorable direction, a richer hero when earned, stronger proof presentation, deliberate visual weight, color commitment, imagery when useful, and a prominent Offer or form focal point.
   - `product-trust` means task and completion surfaces: Checkout, account, login, admin, settings, confirmation, support, and dense product UI. Use the product register: restraint, predictability, clear controls, familiar type, strong labels, and no decorative surprise.
   - Do not ask the operator to choose internal design labels. If more direction is needed, ask for plain examples, feelings, or things to avoid.

   ### Apply the register before applying bans
   The anti-slop tells are not a mandate for product-minimal marketing. Ban genuine tells everywhere: tracked-uppercase kickers on every section, invisible or low-contrast CTAs, display letter-spacing tighter than `-0.04em`, body measure over about `75ch`, dead whitespace bands or `min-h-dvh` as the default section shape, and hierarchy made from divider lines.
   Allow brand-led impact that converts: a clear price or Offer focal block, a designed hero, proof with visual weight, deliberate color, contrast, scale, and section rhythm. Keep Checkout or account steps product-trust even when they sit inside a brand-led sales path.

   ### Name one remembered idea
   The visual direction should have one dominant memory: a strong proof demo, a calm trust panel, an editorial proof sequence, a product screenshot, a decisive photo, or a clear Checkout shell.
   Never: mix several visual ideas because each sounds attractive.

   ### Let the copy set the hierarchy
   The headline, proof, Offer, form, and CTA decide the layout order. Design amplifies the written argument; it does not rearrange it into a generic card grid.

2. Create only a Dent Designer tree.

   Dent output is the bare document `{"version": 1, "elements": [...]}` — no `design` wrapper, no `revision` inside. Each element uses the Designer vocabulary: `section`, `container`, `heading`, `text`, `button`, `image`, `svg`, `list`, `list-item`, `quote`, `form`, fields, Checkout elements, components, repeaters, slots, and the eleven behaviors.

   ### Use element structure plus theme-aware utilities
   Put Tailwind utility strings in each element's `utilities` array. Resolve the design against the fixed tenant theme with utilities such as `bg-background`, `bg-primary`, `text-foreground`, `text-muted-foreground`, `bg-muted`, `bg-card`, `text-card-foreground`, `border-border`, `shadow-elevated`, `rounded-2xl`, `font-sans`, and `tracking-tight`.
   Never: `classes` (a 422), write CSS files, React components, BEM selectors, container-query code, motion-library code, raw theme variables, or OKLCH color declarations for this task.

   ### Use the real behavior vocabulary
   Forms use `form` with an `id`, matching field `config.name` values, and the eleven behaviors: `branch`, `checkout`, `interaction`, `invoke-action`, `lightbox`, `optin`, `send-login-code`, `sign-out`, `unlock-link`, `validate-email`, `verify-login-code`. A behavior's `config` keys are that behavior's inputs and nothing else — `optin` takes `email`, `name`, `event` (`Behaviors/Optin.php`); `validate-email` takes `email`, `blockDisposable`, `blockRoles` (`Behaviors/ValidateEmail.php`); `checkout` takes `billing`, `gateway`, `note` (`Behaviors/Checkout.php`). Checkout uses `checkout`, `checkout-payment`, `checkout-summary`, `checkout-submit`, `checkout-offer`, `checkout-bump`, `checkout-timer`, and `checkout-terms` as required.
   Never: invent a generic redirect behavior or a new element type because a layout would be easier with it.

   ### Bound values are values, never markup or code
   A `{{ ... }}` binding resolves to a value. In text, headings, utilities, and ordinary attributes it renders as escaped display text; in URL slots it must resolve to a real navigable URL or the render fails. In raw-html, script, and style positions it renders as an inert literal — a quoted value the surrounding parser reads as data — so it cannot drive display or styling there. Put human-readable dynamic text in text or heading elements, and drive dynamic styling with a class binding, never a bound raw CSS value.
   Never: rely on a `{{ }}` binding inside a raw CSS `style` value or a raw-html body to show readable text.

3. Lay out the argument.

   - Mobile comes first. Stack by default and add `md:` columns only when the content benefits.
   - Desktop funnels must use a large type scale and fill the width: widen wrappers toward `max-w-7xl` or `max-w-[90rem]`, use two-column layouts when proof, Offer, form, or CTA support can sit beside the claim, and never leave a narrow centered column with tiny text and broad empty margins on desktop.
   - Use `section` for full-width bands and `container` for max-width layout wrappers.
   - Use grid or flex classes with `gap-*` for sibling spacing.
   - Cap long prose with `max-w-[65ch]` or a narrower readable width.
   - Put proof beside the claim or CTA it supports.
   - Use images only when they are real assets, credible generated assets, product screenshots, or meaningful proof. Do not use empty decorative boxes as image substitutes.

   ### Cards earn their affordance
   Use cards for distinct selectable, purchasable, comparable, or trust-bearing objects. Use spacing, type, and background bands for ordinary grouping.
   Never: repeat identical icon-heading-text cards across every section, nest cards inside cards, or wrap every paragraph in a card.

   ### Rhythm beats dividers
   Separate sections with spacing, scale, weight, and background. Use divider elements only when the content semantically needs a divider.
   Never: add divider lines between marketing sections because the hierarchy is weak.

4. Apply visual craft within Dent constraints.

   - Body text must meet at least 4.5:1 contrast against its background. Large text and UI elements need at least 3:1.
   - Keep display letter spacing no tighter than `-0.04em`; `tracking-tight` is enough for most headings.
   - Push brand-led desktop display type toward `lg:text-7xl` and primary section headings toward `lg:text-6xl`; this stays well under the 6rem display ceiling while making dense Funnel copy feel intentional.
   - Use comfortable heavy-copy body sizes on desktop: lead paragraphs should reach `md:text-xl` and can reach `lg:text-2xl` when paired with a wide two-column layout; supporting body copy should generally reach `md:text-lg` or `md:text-xl` with `leading-relaxed`.
   - Keep hero display size bounded; if a heading wraps badly on mobile or tablet, reduce the scale or rewrite with the copy process.
   - Keep body line length at or below 65ch.
   - Prefer `rounded-2xl` for cards and panels. Do not use `rounded-[2rem]` on cards, sections, forms, or inputs.
   - Pick either a visible border or elevation for ordinary cards. Do not pair `border border-border` with `shadow-elevated` as decoration.
   - Use `bg-primary` for the main CTA and scarce proof accents, not as random decoration.
   - Use `bg-muted` for quiet bands and `bg-card` for true surfaces.
   - Use `font-sans` unless the tenant theme already supplies a brand font choice.

   ### Reject AI visual grammar before output
   Remove repeated tiny uppercase tracked eyebrows, numbered section markers that are not a real sequence, purple-blue-pink gradients, decorative grid backgrounds, hand-drawn sketch SVG stand-ins, glassmorphism as default, hero-metric templates, side-stripe accents, gradient text, and over-rounded cards.

5. Use the page-type design leaf for anatomy.

   These leaves own page-specific Designer structure, required elements, and block order. The overarching process does not duplicate their recipes.

   - Designing an opt-in Funnel Step → `design/optin-page.md`
   - Designing a sales Page or sales Funnel Step → `design/sales-page.md`
   - Designing a Checkout Funnel Step → the Checkout starter inside `design/sales-page.md`
   - Designing an upsell Funnel Step → `design/upsell-page.md`
   - Designing a thank-you Page or Funnel Step → `design/thank-you-page.md`
   - Designing an Article or content Page → `design/article.md`

6. Verify by rendering.

   - Save through the owner's two design routes, never a blind write. Read first, send the revision you just read, re-read on a 409:

     ```
     dent api pages <id> design                    # -> {"revision": "...", "design": {...}}
     dent api pages <id> replace-design --data @design-write.json
     ```

     `design-write.json` is `{"revision": "<the string just read>", "design": {"version": 1, "elements": [...]}}`. A 409 means another writer moved the owner first: re-read the design, re-apply your elements onto what came back, and send again with the new revision.
   - Read the `warnings` array the write returns. A draft owner reports publish problems as warnings; a published owner rejects the same problems with a 422.
   - Render the public or preview URL, not just the JSON.
   - Check mobile and desktop widths.
   - Confirm the first screen communicates the promise and next action.
   - Confirm forms and Checkout controls are visible, labeled, and bound to the behavior fields they reference.
   - Confirm contrast, line length, card use, radii, proof placement, and CTA hierarchy.
   - If the render exposes a design failure, revise the JSON and render again before reporting done.
