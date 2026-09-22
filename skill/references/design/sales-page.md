---
description: Design a brand-led sales Page or sales Funnel Step from the shared brief and finished copy, including the sales anatomy and the product-trust Checkout Funnel Step starter.
---

# Design a sales Page or sales Funnel Step

Use this after `interview.md`, `writing/copywriting.md`, and `designing.md`. This leaf owns sales anatomy and the Checkout Funnel Step starter because Checkout is part of the sales path; `designing.md` owns the shared visual process, Dent Designer vocabulary, register rules, anti-slop bans, the Design contract, and render verification.

## Process

1. Read the shared brief and finished copy before changing the starter.

   - Confirm `page_job` is to sell the Offer or move the visitor into Checkout.
   - Treat the sales Page as brand-led: the page may use stronger color, weight, proof, and offer focus than a product-trust surface.
   - Pull the hero claim from `promise`, the mechanism from `differentiation`, and the Offer stack from `offer`.
   - Use only proof the brief names in `proof_points`; move unsupported claims to `proof_gaps` instead of decorating them.
   - Repeat one CTA on long pages. Each button should point to the same Checkout or sales action.
   - Use the Checkout starter in this file when the sales path needs a Checkout Funnel Step; Checkout itself stays product-trust and restrained.

   ### Make the argument visible before the Offer
   The reader should see why the current way fails, why this mechanism works, and what changes for them before the price block asks for commitment.
   Never: jump from hero to price with a row of identical benefit cards as the whole argument.

2. Shape the sales anatomy.

   - Hero: promise, outcome subhead, one CTA, one reassurance line, and a strong offer/price preview when the brief has a concrete price.
   - Problem: named cost of staying where the reader is.
   - Mechanism: why this approach works differently.
   - Benefit section: a varied layout, sequence, comparison, proof-backed bullets, or before/after rows; not identical icon cards and not plain pill bullets.
   - Proof: quote, story, demo, credible result, or guarantee near the claim it supports, with enough visual weight to be believed.
   - Offer stack: Product, included value, bonuses, delivery, access, price, guarantee. The price is a focal point, not a small line buried in a card.
   - FAQ: real objections from the brief.
   - Repeated CTA: same action, no competing path.

   ### Use impact without slop
   A sales Page can have a richer hero, deliberate color, a prominent price block, and heavier proof. The bans still apply: no repeated tracked-uppercase eyebrows, invisible CTA, over-tight display letter-spacing, overlong prose, dead whitespace bands, or divider-only hierarchy.
   Never: force product-minimal restraint onto a brand-led marketing Page.

3. Clone and adapt this sales starter.

   Keep the anti-slop structure: no tracked uppercase eyebrow on every section, no border plus `shadow-elevated` decoration on one element, no radius above `rounded-2xl`, no body text wider than `max-w-[65ch]`, and no divider-driven hierarchy.

   A button that navigates is `"tag": "a"` with `attributes.href` — the shape Dent's own tests use.

   ```json
   {
     "version": 1,
     "elements": [
       {
         "key": "sales-hero",
         "type": "section",
         "utilities": ["bg-primary", "px-4", "py-14", "font-sans", "text-primary-foreground", "antialiased", "sm:px-6", "md:py-24", "lg:px-8", "lg:py-32"],
         "children": [
           {
             "key": "sales-hero-wrap",
             "type": "container",
             "utilities": ["mx-auto", "grid", "max-w-7xl", "items-center", "gap-10", "md:grid-cols-[minmax(0,1fr)_minmax(340px,0.9fr)]", "lg:gap-16"],
             "children": [
               {
                 "key": "sales-copy",
                 "type": "container",
                 "utilities": ["flex", "max-w-3xl", "flex-col", "gap-6", "lg:gap-8"],
                 "children": [
                   {"key": "sales-kicker", "type": "text", "tag": "p", "text": "Course launch operating system", "utilities": ["text-sm", "font-bold", "text-primary-foreground", "md:text-base"]},
                   {"key": "sales-headline", "type": "heading", "tag": "h1", "text": "Turn your expertise into a course funnel that can sell this week", "utilities": ["text-4xl", "font-black", "leading-none", "tracking-tight", "text-primary-foreground", "md:text-6xl", "lg:text-7xl"]},
                   {"key": "sales-subhead", "type": "text", "tag": "p", "text": "Package the Offer, publish the sales Page, and launch Checkout with a revenue path you can see instead of a launch plan you hope works.", "utilities": ["max-w-[65ch]", "text-lg", "leading-relaxed", "text-primary-foreground", "md:text-xl", "lg:text-2xl"]},
                   {"key": "sales-cta", "type": "button", "tag": "a", "attributes": {"href": "#checkout"}, "text": "Enroll now", "utilities": ["inline-flex", "h-14", "w-full", "items-center", "justify-center", "rounded-2xl", "bg-background", "px-8", "text-base", "font-bold", "text-foreground", "shadow-elevated", "md:h-16", "md:w-fit", "md:text-lg"]},
                   {"key": "sales-note", "type": "text", "tag": "p", "text": "Includes templates, launch calendar, and the first revenue dashboard.", "utilities": ["text-sm", "leading-relaxed", "text-primary-foreground", "md:text-base"]}
                 ]
               },
               {
                 "key": "sales-offer-snapshot",
                 "type": "container",
                 "utilities": ["rounded-2xl", "bg-card", "p-6", "text-card-foreground", "shadow-elevated", "md:p-8", "lg:p-10"],
                 "children": [
                   {"key": "sales-snapshot-title", "type": "heading", "tag": "h2", "text": "Course Launch OS", "utilities": ["text-3xl", "font-black", "tracking-tight", "md:text-4xl"]},
                   {"key": "sales-snapshot-copy", "type": "text", "tag": "p", "text": "The complete sales path: promise, Offer, Checkout, delivery, and the revenue review that tells you what to improve next.", "utilities": ["mt-3", "text-base", "leading-relaxed", "md:text-lg"]},
                   {"key": "sales-snapshot-price", "type": "text", "tag": "p", "text": "$297", "utilities": ["mt-6", "text-6xl", "font-black", "leading-none", "tracking-tight", "text-primary", "md:text-7xl"]},
                   {"key": "sales-snapshot-price-note", "type": "text", "tag": "p", "text": "Today. Instant access. 30-day guarantee.", "utilities": ["mt-2", "text-base", "font-bold", "leading-relaxed"]}
                 ]
               }
             ]
           }
         ]
       },
       {
         "key": "sales-problem",
         "type": "section",
         "utilities": ["bg-background", "px-4", "py-16", "font-sans", "text-foreground", "sm:px-6", "md:py-24", "lg:px-8"],
         "children": [
           {"key": "sales-problem-wrap", "type": "container", "utilities": ["mx-auto", "grid", "max-w-7xl", "gap-10", "items-start", "md:grid-cols-[0.8fr_1.2fr]", "lg:gap-16"], "children": [
             {"key": "problem-heading", "type": "heading", "tag": "h2", "text": "The painful part is not making the course. It is knowing what has to sell it.", "utilities": ["text-4xl", "font-black", "tracking-tight", "md:text-5xl", "lg:text-6xl"]},
             {"key": "problem-copy", "type": "container", "utilities": ["flex", "max-w-[65ch]", "flex-col", "gap-5", "text-lg", "leading-relaxed", "md:text-xl"], "children": [
               {"key": "problem-p1", "type": "text", "tag": "p", "text": "Most launches stall because the operator is still choosing between a sales Page, a webinar, another freebie, and a new email sequence."},
               {"key": "problem-p2", "type": "text", "tag": "p", "text": "This course gives you the order: promise, Offer, Checkout, delivery, and the revenue signals that tell you what to improve next."}
             ]}
           ]}
         ]
       },
       {
         "key": "sales-mechanism",
         "type": "section",
         "utilities": ["bg-muted", "px-4", "py-16", "font-sans", "text-foreground", "sm:px-6", "md:py-24", "lg:px-8"],
         "children": [
           {"key": "mechanism-wrap", "type": "container", "utilities": ["mx-auto", "grid", "max-w-7xl", "gap-10", "items-start", "md:grid-cols-[0.9fr_1.1fr]", "lg:gap-16"], "children": [
             {"key": "mechanism-copy", "type": "container", "utilities": ["flex", "max-w-[65ch]", "flex-col", "gap-5"], "children": [
               {"key": "mechanism-heading", "type": "heading", "tag": "h2", "text": "A launch system ordered by buyer commitment", "utilities": ["text-4xl", "font-black", "tracking-tight", "md:text-5xl", "lg:text-6xl"]},
               {"key": "mechanism-text", "type": "text", "tag": "p", "text": "You build the moments in the order a buyer experiences them: belief, decision, payment, access, and next action.", "utilities": ["text-lg", "leading-relaxed", "md:text-xl"]}
             ]},
             {"key": "mechanism-flow", "type": "container", "utilities": ["grid", "gap-4"], "children": [
               {"key": "mechanism-1", "type": "container", "utilities": ["rounded-2xl", "bg-card", "text-card-foreground", "p-5", "md:p-6"], "children": [
                 {"key": "mechanism-1-heading", "type": "heading", "tag": "h3", "text": "Belief", "utilities": ["text-3xl", "font-black", "tracking-tight", "md:text-4xl"]},
                 {"key": "mechanism-1-copy", "type": "text", "tag": "p", "text": "Sharpen the claim until the visitor can repeat it.", "utilities": ["mt-2", "text-base", "leading-relaxed", "md:text-lg"]}
               ]},
               {"key": "mechanism-2", "type": "container", "utilities": ["rounded-2xl", "bg-primary", "p-5", "text-primary-foreground", "md:p-6"], "children": [
                 {"key": "mechanism-2-heading", "type": "heading", "tag": "h3", "text": "Decision", "utilities": ["text-2xl", "font-black", "tracking-tight"]},
                 {"key": "mechanism-2-copy", "type": "text", "tag": "p", "text": "Make the Offer stack concrete, scoped, and safe.", "utilities": ["mt-2", "text-base", "leading-relaxed", "md:text-lg"]}
               ]},
               {"key": "mechanism-3", "type": "container", "utilities": ["rounded-2xl", "bg-card", "text-card-foreground", "p-5", "md:p-6"], "children": [
                 {"key": "mechanism-3-heading", "type": "heading", "tag": "h3", "text": "Payment", "utilities": ["text-3xl", "font-black", "tracking-tight", "md:text-4xl"]},
                 {"key": "mechanism-3-copy", "type": "text", "tag": "p", "text": "Remove Checkout uncertainty and keep the buyer moving.", "utilities": ["mt-2", "text-base", "leading-relaxed", "md:text-lg"]}
               ]}
             ]}
           ]}
         ]
       },
       {
         "key": "sales-benefits-proof",
         "type": "section",
         "utilities": ["bg-background", "px-4", "py-16", "font-sans", "text-foreground", "sm:px-6", "md:py-24", "lg:px-8"],
         "children": [
           {"key": "benefits-proof-wrap", "type": "container", "utilities": ["mx-auto", "grid", "max-w-7xl", "gap-10", "items-start", "md:grid-cols-[1.05fr_0.95fr]", "lg:gap-16"], "children": [
             {"key": "benefit-stack", "type": "container", "utilities": ["grid", "gap-6"], "children": [
               {"key": "benefit-heading", "type": "heading", "tag": "h2", "text": "What changes after the build", "utilities": ["text-4xl", "font-black", "tracking-tight", "md:text-5xl", "lg:text-6xl"]},
               {"key": "benefit-1", "type": "container", "utilities": ["grid", "gap-3", "rounded-2xl", "bg-muted", "p-5", "md:grid-cols-[11ch_1fr]", "md:p-6"], "children": [
                 {"key": "benefit-1-label", "type": "text", "tag": "p", "text": "Offer", "utilities": ["text-base", "font-black", "text-primary", "md:text-lg"]},
                 {"key": "benefit-1-copy", "type": "text", "tag": "p", "text": "You can explain what is included, who it is for, and why buying now makes sense.", "utilities": ["text-base", "leading-relaxed", "md:text-lg"]}
               ]},
               {"key": "benefit-2", "type": "container", "utilities": ["grid", "gap-3", "rounded-2xl", "bg-muted", "p-5", "md:grid-cols-[11ch_1fr]", "md:p-6"], "children": [
                 {"key": "benefit-2-label", "type": "text", "tag": "p", "text": "Checkout", "utilities": ["text-base", "font-black", "text-primary", "md:text-lg"]},
                 {"key": "benefit-2-copy", "type": "text", "tag": "p", "text": "The buyer sees the Order, bump, payment step, guarantee, and access expectation without friction.", "utilities": ["text-base", "leading-relaxed", "md:text-lg"]}
               ]},
               {"key": "benefit-3", "type": "container", "utilities": ["grid", "gap-3", "rounded-2xl", "bg-muted", "p-5", "md:grid-cols-[11ch_1fr]", "md:p-6"], "children": [
                 {"key": "benefit-3-label", "type": "text", "tag": "p", "text": "Review", "utilities": ["text-base", "font-black", "text-primary", "md:text-lg"]},
                 {"key": "benefit-3-copy", "type": "text", "tag": "p", "text": "You know which revenue signal to improve next instead of relaunching from scratch.", "utilities": ["text-base", "leading-relaxed", "md:text-lg"]}
               ]}
             ]},
             {"key": "proof-panel", "type": "container", "utilities": ["rounded-2xl", "bg-card", "text-card-foreground", "p-6", "shadow-elevated", "md:p-8", "lg:p-10"], "children": [
               {"key": "proof-quote", "type": "quote", "text": "The first time I knew exactly what to build next, the whole launch got calmer.", "utilities": ["text-3xl", "font-black", "leading-tight", "tracking-tight", "md:text-5xl"]},
               {"key": "proof-author", "type": "text", "tag": "p", "text": "Solo course operator after replacing a scattered launch plan with one measured Funnel path.", "utilities": ["mt-5", "text-base", "font-semibold", "leading-relaxed", "md:text-lg"]}
             ]}
           ]}
         ]
       },
       {
         "key": "sales-offer",
         "type": "section",
         "utilities": ["bg-muted", "px-4", "py-16", "font-sans", "text-foreground", "sm:px-6", "md:py-24", "lg:px-8"],
         "children": [
           {"key": "offer-wrap", "type": "container", "utilities": ["mx-auto", "grid", "max-w-7xl", "gap-10", "items-stretch", "md:grid-cols-[0.78fr_1.22fr]", "lg:gap-16"], "children": [
             {"key": "offer-includes", "type": "container", "utilities": ["rounded-2xl", "bg-card", "text-card-foreground", "p-6", "md:p-8", "lg:p-10"], "children": [
               {"key": "offer-includes-heading", "type": "heading", "tag": "h2", "text": "Everything in the implementation path", "utilities": ["text-3xl", "font-black", "tracking-tight"]},
               {"key": "offer-includes-list", "type": "container", "utilities": ["mt-6", "grid", "gap-4", "text-base", "leading-relaxed", "md:text-lg"], "children": [
                 {"key": "offer-include-1", "type": "text", "tag": "p", "text": "Course lessons for promise, Offer, sales Page, Checkout, and thank-you.", "utilities": ["font-semibold"]},
                 {"key": "offer-include-2", "type": "text", "tag": "p", "text": "Launch templates and a calendar for the first implementation week.", "utilities": ["font-semibold"]},
                 {"key": "offer-include-3", "type": "text", "tag": "p", "text": "Revenue dashboard review so the next improvement is obvious.", "utilities": ["font-semibold"]}
               ]}
             ]},
             {"key": "offer-card", "type": "container", "utilities": ["rounded-2xl", "bg-primary", "p-6", "text-primary-foreground", "shadow-elevated", "md:p-8", "lg:p-10"], "children": [
               {"key": "offer-heading", "type": "heading", "tag": "h2", "text": "Course Launch OS", "utilities": ["text-3xl", "font-black", "tracking-tight", "md:text-5xl"]},
               {"key": "offer-copy", "type": "text", "tag": "p", "text": "Build the sales path in order, then improve it from revenue signals instead of guesswork.", "utilities": ["mt-4", "max-w-[65ch]", "text-lg", "leading-relaxed", "md:text-xl"]},
               {"key": "offer-price", "type": "text", "tag": "p", "text": "$297 today", "utilities": ["mt-7", "text-6xl", "font-black", "leading-none", "tracking-tight", "md:text-7xl"]},
               {"key": "offer-guarantee", "type": "text", "tag": "p", "text": "30-day guarantee. Instant access after Checkout.", "utilities": ["mt-4", "text-base", "font-bold", "leading-relaxed", "md:text-lg"]},
               {"key": "offer-cta", "type": "button", "tag": "a", "attributes": {"href": "#checkout"}, "text": "Start the course", "utilities": ["mt-8", "inline-flex", "h-14", "w-full", "items-center", "justify-center", "rounded-2xl", "bg-background", "px-8", "font-bold", "text-foreground", "shadow-elevated", "md:w-fit"]}
             ]}
           ]}
         ]
       },
       {
         "key": "sales-faq",
         "type": "section",
         "utilities": ["bg-background", "px-4", "py-16", "font-sans", "text-foreground", "sm:px-6", "md:py-24", "lg:px-8"],
         "children": [
           {"key": "faq-wrap", "type": "container", "utilities": ["mx-auto", "grid", "max-w-5xl", "gap-8"], "children": [
             {"key": "faq-heading", "type": "heading", "tag": "h2", "text": "Questions before you enroll", "utilities": ["text-4xl", "font-black", "tracking-tight", "md:text-5xl", "lg:text-6xl"]},
             {"key": "faq-list", "type": "container", "utilities": ["grid", "gap-5", "text-base", "leading-relaxed", "md:text-xl"], "children": [
               {"key": "faq-1", "type": "text", "tag": "p", "text": "Is this for a small audience? Yes. The system assumes a solo operator with a practical list, not a giant launch team."},
               {"key": "faq-2", "type": "text", "tag": "p", "text": "Do I need to rebuild my whole Site? No. You build the Funnel pieces that make the Offer clear and purchasable."},
               {"key": "faq-3", "type": "text", "tag": "p", "text": "What happens after Checkout? You get instant access and a first implementation sequence."}
             ]},
             {"key": "faq-cta", "type": "button", "tag": "a", "attributes": {"href": "#checkout"}, "text": "Enroll now", "utilities": ["inline-flex", "h-14", "w-full", "items-center", "justify-center", "rounded-2xl", "bg-primary", "px-8", "font-bold", "text-primary-foreground", "shadow-elevated", "md:w-fit"]}
           ]}
         ]
       }
     ]
   }
   ```

4. Clone and adapt this Checkout Funnel Step starter when the sales path reaches payment.

   The Checkout starter belongs here because it serves the sales path. It follows the first-party checkout preset (`app/Tenant/Designer/Presets/components/checkout.json`), written out as plain elements so every part is editable in one document. Checkout is product-trust: keep it clear, predictable, and restrained even when the sales Page is brand-led.

   `DesignerService::validateCheckout` requires all five of these inside the `checkout` element, or the write returns warnings on a draft owner and a 422 on a published one: the `checkout` behavior, `billing.email`, `billing.first_name`, `billing.last_name` bound fields, a `checkout-payment`, and a `checkout-submit`.

   Config keys: `checkout` `showLabels`/`requiredAsterisk` (`Elements/Checkout.php`); behavior `checkout` inputs `billing`/`gateway`/`note` (`Behaviors/Checkout.php`); `text-input` `binding` (`Fields/ResolvesFieldValue.php`) and `kind` (`Elements/TextInput.php`); `checkout-payment` `gateways`/`mode` (`Elements/Payment.php`); `checkout-summary` `scope` (`Elements/OrderSummary.php`); `checkout-offer` `offer`/`showImage`/`showName`/`showDescription`/`showPrice`/`showStrikethrough` (`Elements/Offer.php`); `checkout-bump` `offer`/`label`/`description`/`prechecked` (`Elements/OrderBump.php`); `checkout-terms` `label` (`Elements/Terms.php`); `checkout-submit` `label` (`Elements/Submit.php`).

   Never write a gateway list into `checkout-payment.config.gateways`. Omitted, the element renders every gateway the tenant has active; a hard-coded list silently hides the gateway the tenant actually switched on. Leave `checkout-offer.config.offer` and `checkout-bump.config.offer` out too, so both resolve the current step's first offer and first bump.

   ```json
   {
     "version": 1,
     "elements": [
       {
         "key": "checkout-frame",
         "type": "section",
         "utilities": ["flex", "flex-col", "w-full", "bg-background", "px-4", "py-12", "font-sans", "text-foreground", "antialiased", "sm:px-6", "md:py-16", "lg:px-8"],
         "children": [
           {
             "key": "checkout-body",
             "type": "container",
             "utilities": ["mx-auto", "w-full", "max-w-5xl"],
             "children": [
               {
                 "key": "checkout-form",
                 "type": "checkout",
                 "config": {"showLabels": true, "requiredAsterisk": false},
                 "utilities": ["grid", "gap-10", "items-start", "lg:grid-cols-[minmax(0,1fr)_24rem]"],
                 "behaviors": [
                   {"behavior": "checkout", "event": "submit", "config": {"billing": "{{ checkout.billing }}", "gateway": "{{ checkout.payment.gateway }}", "note": "{{ checkout.note }}"}}
                 ],
                 "children": [
                   {
                     "key": "checkout-column",
                     "type": "container",
                     "utilities": ["flex", "flex-col", "gap-8", "min-w-0", "order-last", "lg:order-first"],
                     "children": [
                       {"key": "checkout-title", "type": "heading", "tag": "h1", "text": "Complete your order", "utilities": ["text-2xl", "font-semibold", "tracking-tight", "text-balance"]},
                       {
                         "key": "checkout-contact",
                         "type": "container",
                         "utilities": ["flex", "flex-col", "gap-3.5"],
                         "children": [
                           {"key": "checkout-contact-legend", "type": "heading", "tag": "h2", "text": "Contact information", "utilities": ["text-[0.9375rem]", "font-semibold"]},
                           {"key": "checkout-email", "type": "text-input", "config": {"binding": "billing.email", "kind": "email", "required": true}},
                           {
                             "key": "checkout-names",
                             "type": "container",
                             "utilities": ["grid", "gap-3", "sm:grid-cols-2"],
                             "children": [
                               {"key": "checkout-first-name", "type": "text-input", "config": {"binding": "billing.first_name", "kind": "text", "required": true}},
                               {"key": "checkout-last-name", "type": "text-input", "config": {"binding": "billing.last_name", "kind": "text", "required": true}}
                             ]
                           }
                         ]
                       },
                       {
                         "key": "checkout-payment-set",
                         "type": "container",
                         "utilities": ["flex", "flex-col", "gap-3.5"],
                         "children": [
                           {"key": "checkout-payment-legend", "type": "heading", "tag": "h2", "text": "Payment method", "utilities": ["text-[0.9375rem]", "font-semibold"]},
                           {"key": "checkout-payment", "type": "checkout-payment"}
                         ]
                       },
                       {"key": "checkout-bump", "type": "checkout-bump", "config": {"label": "Add the implementation templates", "description": "Swipe files, prompts, and a launch tracker you can use in the first week.", "prechecked": false}},
                       {
                         "key": "checkout-close",
                         "type": "container",
                         "utilities": ["flex", "flex-col", "gap-3.5"],
                         "children": [
                           {"key": "checkout-terms", "type": "checkout-terms"},
                           {"key": "checkout-submit", "type": "checkout-submit", "config": {"label": "Complete purchase"}},
                           {"key": "checkout-trust", "type": "text", "tag": "p", "text": "Access is emailed to you the moment the payment clears. Card details are held by our payment provider, never on this site.", "utilities": ["text-sm", "text-muted-foreground", "text-pretty"]}
                         ]
                       }
                     ]
                   },
                   {
                     "key": "checkout-rail",
                     "type": "container",
                     "utilities": ["flex", "flex-col", "gap-6", "rounded-2xl", "bg-card", "text-card-foreground", "p-6", "lg:sticky", "lg:top-6"],
                     "children": [
                       {"key": "checkout-offer", "type": "checkout-offer", "config": {"showImage": false, "showName": true, "showDescription": true, "showPrice": true, "showStrikethrough": true}},
                       {"key": "checkout-summary", "type": "checkout-summary", "config": {"scope": "full"}}
                     ]
                   }
                 ]
               }
             ]
           }
         ]
       }
     ]
   }
   ```

5. Render through Dent and inspect the screenshots.

   - Confirm the sales Page has hero, problem, mechanism, varied benefits, weighted proof, Offer stack, prominent price or guarantee, FAQ, and repeated same CTA.
   - Confirm Checkout shows the three billing fields, `checkout-payment`, `checkout-summary`, `checkout-bump`, and `checkout-submit` without brand-led over-decoration.
   - Confirm the write returned no `checkout.*_missing` warning.
   - Confirm the first screen communicates the promise and next action.
   - Confirm the starter still passes the bans inherited from `designing.md`.
