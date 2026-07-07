---
description: Process for designing conversion-ready Dent Pages and Funnel Steps with Designer elements, theme-aware classes, and proven anatomy.
---

# Designing beautiful pages

Use this when a Page, Article, Funnel Step, Template, or Component needs a Design. The failure it prevents: an operator asks for a funnel or Page and gets wireframe boxes instead of a polished, brand-aware Site surface.

## Process

1. Choose the conversion job before writing JSON.

   - One Design gets one primary job: opt in, buy the Offer, accept the upsell, confirm the next step, or read the content.
   - Write the headline around the outcome, not the mechanism.
   - Use one high-contrast primary CTA. Repeat the same CTA on long sales Designs; do not introduce a second competing action.
   - Put proof near the claim it supports: testimonials, numbers, guarantees, logos, or trust notes.
   - Mobile comes first: stack on small screens, split into columns only at `md:` and above.
   - Default section rhythm is `py-16 md:py-24` with `px-4`. Use `py-12 md:py-20` for Checkout. Do not use `min-h-dvh` as a default; it creates dead whitespace on normal content.

2. Use Dent Designer vocabulary precisely.

   Every element has a `key`, a `type`, optional `tag`, `text`, `classes`, `attributes`, `config`, `behaviors`, and `children`.

   - `section`: full-width page band. Use `classes` such as `bg-background px-4 py-16 md:py-24 font-sans text-foreground`.
   - `container`: width and layout wrapper. Use `mx-auto max-w-6xl`, `grid gap-8 md:grid-cols-2`, or `max-w-[65ch]` for readable text.
   - `heading`: headline or subheading. Use `text`, optional `tag` (`h1`, `h2`, `h3`), and classes such as `text-4xl md:text-6xl font-black tracking-tight leading-tight`.
   - `text`: paragraphs, eyebrow text, captions, CTA notes. Use `tag` (`p`, `span`, `div`) and readable classes such as `text-lg leading-relaxed text-muted-foreground`.
   - `button`: CTA. Use `tag: "a"` with `attributes.href` for Links or plain button behavior inside forms. Use `inline-flex h-12 md:h-14 items-center justify-center rounded-2xl bg-primary px-6 font-bold text-primary-foreground shadow-elevated`.
   - `image`: visual proof or hero asset. Use `attributes.src` and `attributes.alt`; add `rounded-2xl shadow-elevated object-cover`.
   - `list` and `list-item`: benefits, bullets, inclusions, FAQs. Keep each item outcome-focused.
   - `quote`: testimonial or proof. Pair the quote with attribution text when possible.
   - `form`: opt-in or capture form. Add submit behaviors and make every `{{ fields.* }}` referenced by a behavior match a child input `config.name`.
   - `text-input`: field. Important `config`: `name`, `binding`, `kind` (`email`, `text`, `tel`, `number`, `url`, `password`, `hidden`), `label`, `placeholder`, `required`, `value`.
   - `form-submit`: form CTA. Important `config`: `label`.

   Checkout family:

   - `checkout`: root Checkout form. Important `config`: `showLabels`, `requiredAsterisk`. Add a `checkout` behavior whose config binds `billing` and `gateway` from `{{ checkout.* }}` values.
   - `checkout-payment`: gateway selector. Important `config`: `gateways`.
   - `checkout-summary`: Cart / Order summary. Usually no config.
   - `checkout-submit`: Checkout CTA. Important `config`: `label`.
   - `checkout-offer`: Offer presentation on Checkout or Upsell. Important `config`: `offer`, `showImage`, `showName`, `showDescription`, `showPrice`, `showStrikethrough`.
   - `checkout-bump`: Order bump. Important `config`: `offer`, `label`, `description`, `prechecked`.
   - `checkout-timer`: urgency. Important `config`: `format` (`hms` or `verbose`), `expiry` (`redirect` or `hide`).
   - `checkout-terms`: terms acknowledgment. Important `config`: `label`.

3. Make the tenant theme do the branding work.

   - Put Tailwind utilities in each element's `classes` array.
   - Prefer theme-aware classes so the same Design adapts to the operator's brand: `bg-background`, `bg-primary`, `text-foreground`, `text-muted-foreground`, `bg-muted`, `bg-card`, `border-border`, `shadow-elevated`, `rounded-2xl`, `font-sans`, `tracking-tight`.
   - Theme presets and fonts exist; do not hard-code a brand palette unless the operator asks for exact colors.
   - Use neutral structure plus theme tokens: cards use `bg-card border border-border shadow-elevated rounded-2xl`; quiet bands use `bg-muted`; CTAs use `bg-primary`.
   - Keep type scales intentional: hero `text-4xl md:text-6xl`, section headings `text-3xl md:text-5xl`, body `text-base md:text-lg`, captions `text-sm`.
   - Keep text readable: use `max-w-xl` or `max-w-[65ch]`; do not stretch paragraphs across the full viewport.

4. Apply the right page anatomy.

   - Opt-in Funnel Step: outcome headline, short subhead, hero visual or value preview, compact form, one CTA, privacy/trust note, 2-3 trust signals or benefits.
   - Sales Funnel Step or sales Page: hero, pain/problem, mechanism/solution, benefit cards, proof, Offer stack, price/guarantee, FAQ, repeated same CTA.
   - Checkout Funnel Step: concise reassurance headline, two-column Checkout card on desktop, billing/payment on the left, summary/bump/trust on the right, no competing navigation.
   - Upsell Funnel Step: purchase confirmation, one relevant upgrade, why now, 3-5 benefits, proof, dominant accept CTA, quiet decline Link.
   - Thank-you Funnel Step or Page: confirmation, what happens next, one primary next action, support reassurance, optional bridge to the next best Offer or Course.
   - Article or content Page: designed header, readable content column, optional callout card, one contextual CTA. Never ship only a bare `section` plus `heading`; design it.

5. Start from a proven Design and adapt the copy.

   Clone these compact starters, then change copy, ids, Offer bindings, form keys, and Links. Keep the rhythm, theme classes, and mobile-first structure.

   ### Opt-in landing starter

   ```json
   {
     "design": {
       "version": 1,
       "elements": [{
         "key": "optin-hero",
         "type": "section",
         "classes": ["w-full", "bg-background", "px-4", "py-16", "md:py-24", "font-sans", "text-foreground", "antialiased"],
         "children": [{
           "key": "optin-hero-wrap",
           "type": "container",
           "classes": ["mx-auto", "grid", "max-w-6xl", "gap-10", "md:grid-cols-2", "items-center"],
           "children": [{
             "key": "optin-copy",
             "type": "container",
             "classes": ["flex", "max-w-xl", "flex-col", "gap-6"],
             "children": [
               {"key": "optin-eyebrow", "type": "text", "tag": "p", "text": "FREE PLAYBOOK", "classes": ["text-sm", "font-bold", "uppercase", "tracking-[0.22em]", "text-primary"], "children": []},
               {"key": "optin-headline", "type": "heading", "tag": "h1", "text": "Launch a profitable funnel without guessing what to build next", "classes": ["text-4xl", "font-black", "tracking-tight", "leading-tight", "text-foreground", "md:text-6xl"], "children": []},
               {"key": "optin-subhead", "type": "text", "tag": "p", "text": "Get the 7-step launch map operators use to turn a lead magnet, checkout, and follow-up sequence into measurable revenue.", "classes": ["max-w-xl", "text-lg", "leading-relaxed", "text-muted-foreground", "md:text-xl"], "children": []},
               {"key": "optin-form", "type": "form", "classes": ["rounded-2xl", "border", "border-border", "bg-card", "p-5", "shadow-elevated", "md:p-6", "flex", "flex-col", "gap-4"], "behaviors": [{"behavior": "validate-email", "event": "submit", "config": {"email": "{{ fields.email }}"}}, {"behavior": "optin", "event": "submit", "config": {"email": "{{ fields.email }}", "firstName": "{{ fields.first_name }}", "nameMode": "split"}}], "children": [
                 {"key": "optin-name", "type": "text-input", "config": {"kind": "text", "name": "first_name", "label": "First name", "placeholder": "Avery", "required": false}, "children": []},
                 {"key": "optin-email", "type": "text-input", "config": {"kind": "email", "name": "email", "label": "Email", "placeholder": "you@example.com", "required": true}, "children": []},
                 {"key": "optin-submit", "type": "form-submit", "config": {"label": "Send me the launch map"}, "children": []}
               ]},
               {"key": "optin-note", "type": "text", "tag": "p", "text": "No spam. Just the checklist and the follow-up lesson.", "classes": ["text-sm", "text-muted-foreground"], "children": []}
             ]
           }, {
             "key": "optin-visual",
             "type": "container",
             "classes": ["rounded-[2rem]", "border", "border-border", "bg-card", "p-6", "shadow-elevated", "md:p-8"],
             "children": [
               {"key": "visual-label", "type": "text", "tag": "p", "text": "Inside the playbook", "classes": ["text-sm", "font-bold", "uppercase", "tracking-[0.2em]", "text-primary"], "children": []},
               {"key": "visual-title", "type": "heading", "tag": "h2", "text": "The launch map", "classes": ["mt-3", "text-3xl", "font-black", "tracking-tight", "text-foreground"], "children": []},
               {"key": "visual-list", "type": "list", "classes": ["mt-6", "grid", "gap-3"], "children": [
                 {"key": "visual-item-1", "type": "list-item", "text": "A landing section that earns the opt-in", "classes": ["rounded-2xl", "bg-muted", "p-4", "font-semibold"], "children": []},
                 {"key": "visual-item-2", "type": "list-item", "text": "The Checkout and Offer stack that closes", "classes": ["rounded-2xl", "bg-muted", "p-4", "font-semibold"], "children": []},
                 {"key": "visual-item-3", "type": "list-item", "text": "The numbers to watch after launch", "classes": ["rounded-2xl", "bg-muted", "p-4", "font-semibold"], "children": []}
               ]}
             ]
           }]
         }]
       }, {
         "key": "optin-trust",
         "type": "section",
         "classes": ["bg-background", "px-4", "pb-16", "font-sans"],
         "children": [{
           "key": "trust-wrap",
           "type": "container",
           "classes": ["mx-auto", "grid", "max-w-6xl", "gap-4", "md:grid-cols-3"],
           "children": [
             {"key": "trust-1", "type": "text", "tag": "p", "text": "Built for solo operators", "classes": ["rounded-2xl", "border", "border-border", "bg-card", "p-5", "font-bold", "shadow-elevated"], "children": []},
             {"key": "trust-2", "type": "text", "tag": "p", "text": "15-minute implementation path", "classes": ["rounded-2xl", "border", "border-border", "bg-card", "p-5", "font-bold", "shadow-elevated"], "children": []},
             {"key": "trust-3", "type": "text", "tag": "p", "text": "Revenue-first examples", "classes": ["rounded-2xl", "border", "border-border", "bg-card", "p-5", "font-bold", "shadow-elevated"], "children": []}
           ]
         }]
       }]
     }
   }
   ```

   ### Sales page starter structure

   ```json
   {
     "design": {
       "version": 1,
       "elements": [{
         "key": "sales-hero",
         "type": "section",
         "classes": ["bg-background", "px-4", "py-16", "md:py-24", "font-sans", "text-foreground"],
         "children": [{
           "key": "sales-hero-wrap",
           "type": "container",
           "classes": ["mx-auto", "grid", "max-w-6xl", "gap-10", "md:grid-cols-2", "items-center"],
           "children": [{
             "key": "sales-copy",
             "type": "container",
             "classes": ["flex", "max-w-xl", "flex-col", "gap-6"],
             "children": [
               {"key": "sales-eyebrow", "type": "text", "tag": "p", "text": "COURSE LAUNCH OS", "classes": ["text-sm", "font-bold", "uppercase", "tracking-[0.22em]", "text-primary"], "children": []},
               {"key": "sales-headline", "type": "heading", "tag": "h1", "text": "Turn your expertise into a selling course funnel this week", "classes": ["text-4xl", "font-black", "tracking-tight", "leading-tight", "md:text-6xl"], "children": []},
               {"key": "sales-subhead", "type": "text", "tag": "p", "text": "A practical system for packaging the Offer, publishing the sales Page, and launching Checkout with confidence.", "classes": ["text-lg", "leading-relaxed", "text-muted-foreground", "md:text-xl"], "children": []},
               {"key": "sales-cta", "type": "button", "tag": "a", "attributes": {"href": "#checkout"}, "text": "Enroll now", "classes": ["inline-flex", "h-14", "items-center", "justify-center", "rounded-2xl", "bg-primary", "px-8", "font-bold", "text-primary-foreground", "shadow-elevated"], "children": []},
               {"key": "sales-note", "type": "text", "tag": "p", "text": "Includes templates, launch calendar, and the first revenue dashboard.", "classes": ["text-sm", "text-muted-foreground"], "children": []}
             ]
           }, {
             "key": "sales-card",
             "type": "container",
             "classes": ["rounded-[2rem]", "border", "border-border", "bg-card", "p-6", "shadow-elevated", "md:p-8"],
             "children": [
               {"key": "sales-card-title", "type": "heading", "tag": "h2", "text": "What you build", "classes": ["text-3xl", "font-black", "tracking-tight"], "children": []},
               {"key": "sales-card-list", "type": "list", "classes": ["mt-6", "grid", "gap-3"], "children": [
                 {"key": "sales-card-1", "type": "list-item", "text": "An Offer that is easy to say yes to", "classes": ["rounded-2xl", "bg-muted", "p-4"], "children": []},
                 {"key": "sales-card-2", "type": "list-item", "text": "A Checkout flow with an Order bump", "classes": ["rounded-2xl", "bg-muted", "p-4"], "children": []},
                 {"key": "sales-card-3", "type": "list-item", "text": "A thank-you step that moves buyers forward", "classes": ["rounded-2xl", "bg-muted", "p-4"], "children": []}
               ]}
             ]
           }]
         }]
       }, {
         "key": "sales-proof",
         "type": "section",
         "classes": ["bg-muted", "px-4", "py-16", "md:py-20", "font-sans"],
         "children": [{"key": "proof-wrap", "type": "container", "classes": ["mx-auto", "grid", "max-w-6xl", "gap-6", "md:grid-cols-3"], "children": [
           {"key": "benefit-1", "type": "text", "tag": "p", "text": "Clarify the buyer promise", "classes": ["rounded-2xl", "bg-card", "p-6", "shadow-elevated", "font-bold"], "children": []},
           {"key": "benefit-2", "type": "text", "tag": "p", "text": "Package the Product and Offer", "classes": ["rounded-2xl", "bg-card", "p-6", "shadow-elevated", "font-bold"], "children": []},
           {"key": "benefit-3", "type": "text", "tag": "p", "text": "Launch with revenue attribution", "classes": ["rounded-2xl", "bg-card", "p-6", "shadow-elevated", "font-bold"], "children": []}
         ]}]
       }, {
         "key": "sales-offer",
         "type": "section",
         "classes": ["bg-background", "px-4", "py-16", "md:py-24", "font-sans"],
         "children": [{"key": "offer-card", "type": "container", "classes": ["mx-auto", "max-w-4xl", "rounded-[2rem]", "border", "border-border", "bg-card", "p-8", "text-center", "shadow-elevated"], "children": [
           {"key": "offer-heading", "type": "heading", "tag": "h2", "text": "Everything you need to launch", "classes": ["text-3xl", "font-black", "tracking-tight", "md:text-5xl"], "children": []},
           {"key": "offer-price", "type": "text", "tag": "p", "text": "Today: $297", "classes": ["mt-4", "text-4xl", "font-black", "text-primary"], "children": []},
           {"key": "offer-copy", "type": "text", "tag": "p", "text": "Course, templates, and launch assets in one revenue-focused system.", "classes": ["mx-auto", "mt-4", "max-w-[65ch]", "text-lg", "leading-relaxed", "text-muted-foreground"], "children": []},
           {"key": "offer-cta", "type": "button", "tag": "a", "attributes": {"href": "#checkout"}, "text": "Start the course", "classes": ["mt-8", "inline-flex", "h-14", "items-center", "justify-center", "rounded-2xl", "bg-primary", "px-8", "font-bold", "text-primary-foreground", "shadow-elevated"], "children": []}
         ]}]
       }]
     }
   }
   ```

   ### Checkout Funnel Step starter

   ```json
   {
     "design": {
       "version": 1,
       "elements": [{
         "key": "checkout-page",
         "type": "section",
         "classes": ["bg-muted", "px-4", "py-12", "md:py-20", "font-sans", "text-foreground"],
         "children": [{
           "key": "checkout-wrap",
           "type": "container",
           "classes": ["mx-auto", "max-w-6xl"],
           "children": [
             {"key": "checkout-heading", "type": "heading", "tag": "h1", "text": "Complete enrollment", "classes": ["text-center", "text-4xl", "font-black", "tracking-tight", "md:text-5xl"], "children": []},
             {"key": "checkout-subhead", "type": "text", "tag": "p", "text": "Secure Checkout. Instant access after your Order is complete.", "classes": ["mx-auto", "mt-4", "max-w-[65ch]", "text-center", "text-lg", "text-muted-foreground"], "children": []},
             {"key": "checkout-form", "type": "checkout", "classes": ["mt-10", "grid", "gap-6", "md:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]", "items-start"], "config": {"showLabels": true, "requiredAsterisk": true}, "behaviors": [{"behavior": "checkout", "event": "submit", "config": {"billing": "{{ checkout.billing }}", "gateway": "{{ checkout.payment.gateway }}"}}], "children": [
               {"key": "checkout-billing", "type": "container", "classes": ["rounded-[2rem]", "border", "border-border", "bg-card", "p-6", "shadow-elevated", "md:p-8"], "children": [
                 {"key": "billing-heading", "type": "heading", "tag": "h2", "text": "Billing details", "classes": ["text-2xl", "font-black", "tracking-tight"], "children": []},
                 {"key": "checkout-email", "type": "text-input", "config": {"binding": "billing.email", "kind": "email", "label": "Email", "placeholder": "you@example.com", "required": true}, "children": []},
                 {"key": "checkout-names", "type": "container", "classes": ["grid", "gap-4", "md:grid-cols-2"], "children": [
                   {"key": "checkout-first-name", "type": "text-input", "config": {"binding": "billing.first_name", "kind": "text", "label": "First name", "required": true}, "children": []},
                   {"key": "checkout-last-name", "type": "text-input", "config": {"binding": "billing.last_name", "kind": "text", "label": "Last name", "required": true}, "children": []}
                 ]},
                 {"key": "checkout-payment", "type": "checkout-payment", "config": {"gateways": ["dent_test"]}, "children": []},
                 {"key": "checkout-terms", "type": "checkout-terms", "config": {"label": "I agree to the terms and understand access starts immediately."}, "children": []},
                 {"key": "checkout-submit", "type": "checkout-submit", "config": {"label": "Complete enrollment"}, "children": []}
               ]},
               {"key": "checkout-sidebar", "type": "container", "classes": ["rounded-[2rem]", "border", "border-border", "bg-card", "p-6", "shadow-elevated", "md:sticky", "md:top-6"], "children": [
                 {"key": "checkout-offer", "type": "checkout-offer", "config": {"showImage": false, "showName": true, "showDescription": true, "showPrice": true, "showStrikethrough": true}, "children": []},
                 {"key": "checkout-summary", "type": "checkout-summary", "children": []},
                 {"key": "checkout-bump", "type": "checkout-bump", "config": {"label": "Add the implementation templates for $37", "description": "Swipe files, prompts, and a launch tracker.", "prechecked": false}, "children": []},
                 {"key": "checkout-trust", "type": "text", "tag": "p", "text": "30-day guarantee. Secure payment. Instant access.", "classes": ["mt-4", "text-sm", "text-muted-foreground"], "children": []}
               ]}
             ]}
           ]
         }]
       }]
     }
   }
   ```

   ### Upsell starter

   ```json
   {
     "design": {
       "version": 1,
       "elements": [{
         "key": "upsell-page",
         "type": "section",
         "classes": ["bg-background", "px-4", "py-16", "md:py-24", "font-sans", "text-foreground"],
         "children": [{"key": "upsell-wrap", "type": "container", "classes": ["mx-auto", "max-w-4xl", "rounded-[2rem]", "border", "border-border", "bg-card", "p-8", "text-center", "shadow-elevated", "md:p-10"], "children": [
           {"key": "upsell-eyebrow", "type": "text", "tag": "p", "text": "Your Order is confirmed", "classes": ["text-sm", "font-bold", "uppercase", "tracking-[0.22em]", "text-primary"], "children": []},
           {"key": "upsell-heading", "type": "heading", "tag": "h1", "text": "Add the implementation sprint before you start", "classes": ["mt-4", "text-4xl", "font-black", "tracking-tight", "md:text-5xl"], "children": []},
           {"key": "upsell-copy", "type": "text", "tag": "p", "text": "Get the prompts, templates, and review checklist that make the course faster to execute.", "classes": ["mx-auto", "mt-4", "max-w-[65ch]", "text-lg", "leading-relaxed", "text-muted-foreground"], "children": []},
           {"key": "upsell-offer", "type": "checkout-offer", "config": {"showImage": false, "showName": true, "showDescription": true, "showPrice": true, "showStrikethrough": true}, "children": []},
           {"key": "upsell-accept", "type": "button", "tag": "a", "attributes": {"href": "{{ offer.acceptUrl }}"}, "text": "Yes, add this to my Order", "classes": ["mt-8", "inline-flex", "h-14", "w-full", "items-center", "justify-center", "rounded-2xl", "bg-primary", "px-8", "font-bold", "text-primary-foreground", "shadow-elevated", "md:w-auto"], "children": []},
           {"key": "upsell-decline", "type": "button", "tag": "a", "attributes": {"href": "{{ offer.declineUrl }}"}, "text": "No thanks, continue to my access", "classes": ["mt-4", "inline-flex", "w-full", "items-center", "justify-center", "text-sm", "font-semibold", "text-muted-foreground", "md:w-auto"], "children": []}
         ]}]
       }]
     }
   }
   ```
