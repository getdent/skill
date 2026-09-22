---
description: Design a brand-led opt-in Funnel Step or Page from the shared brief and finished copy, with one compact form, trust support, and a ban-compliant starter Design.
---

# Design an opt-in Funnel Step or Page

Use this after `interview.md`, `writing/copywriting.md`, and `designing.md`. This leaf owns only the opt-in anatomy and starter Design; `designing.md` owns the shared vision, Dent Designer vocabulary, theme utilities, register rules, anti-slop bans, the Design contract, and render verification.

## Process

1. Read the shared brief and the finished copy before changing the starter.

   - Confirm `surface` is Page or Funnel Step and `page_job` is to trade attention for the opt-in.
   - Treat this as brand-led unless the brief explicitly says product-trust; the opt-in needs a memorable promise area, not a bare utility form.
   - Pull the headline from `promise`, not from the free Offer title alone.
   - Use `audience`, `objections`, and `proof_points` to decide the trust note near the form.
   - Keep one CTA. The form submit is the CTA; do not add a competing button.
   - Keep every behavior binding matched to a child field `config.name`.

   ### Put the form in the first decision area
   The visitor should see the promise, the compact form, and the trust note without needing a second section to understand the action.
   Never: make the first fold a generic brand hero and push the opt-in form below it.

2. Shape the opt-in anatomy.

   - Hero: promise headline, short subhead, compact form, privacy or delivery reassurance.
   - Value preview: 3-4 specific outcomes or pieces inside the free Offer, written as a sequence or checklist rather than identical cards.
   - Trust: one quiet proof row, testimonial, or operator credibility note.
   - CTA: exactly one submit action.

   ### Use a panel only where it behaves like an affordance
   The form can be a `bg-card rounded-2xl shadow-elevated` panel because it is interactive. Brand-led impact can come from the hero color, scale, contrast, proof placement, and one strong form focal area.
   Never: wrap every benefit and proof point in matching icon-heading-text cards.

3. Clone and adapt this starter.

   The hero of this document was accepted live with zero warnings and rendered publicly. Replace copy, field labels, and form behavior fields. Keep the anti-slop structure: no repeated tracked uppercase eyebrows, no `border` plus `shadow-elevated` decoration on the same element, no radius above `rounded-2xl`, no body text wider than `max-w-[65ch]`, and no trailing empty/min-height band after the last section.

   Config keys: `svg` `tree`/`alt`/`decorative` (`Elements/Svg.php`); `text-input` `kind` (`Elements/TextInput.php`) plus `name`/`label`/`placeholder`/`required` (`Fields/ResolvesFieldValue.php`); `form-submit` `label` (`Elements/FormSubmit.php`). Behavior inputs: `validate-email` `email` (`Behaviors/ValidateEmail.php`); `optin` `email`/`name` (`Behaviors/Optin.php`).

   ```json
   {
     "version": 1,
     "elements": [
       {
         "key": "hero",
         "type": "section",
         "utilities": ["bg-primary", "text-primary-foreground", "px-4", "py-16", "font-sans", "antialiased", "sm:px-6", "md:py-24", "lg:px-8"],
         "children": [
           {
             "key": "hero-wrap",
             "type": "container",
             "utilities": ["mx-auto", "grid", "max-w-7xl", "gap-10", "md:grid-cols-2", "items-center", "lg:gap-16"],
             "children": [
               {
                 "key": "copy",
                 "type": "container",
                 "utilities": ["flex", "flex-col", "gap-6", "lg:gap-8"],
                 "children": [
                   {"key": "mark", "type": "svg", "utilities": ["h-10", "w-10"], "config": {"tree": {"tag": "svg", "attributes": {"viewBox": "0 0 24 24", "fill": "none", "stroke": "currentColor", "stroke-width": "2"}, "content": [{"tag": "path", "attributes": {"d": "M5 12h14M13 6l6 6-6 6"}}]}, "alt": "Arrow", "decorative": true}},
                   {"key": "headline", "type": "heading", "tag": "h1", "text": "Know the next step to build", "utilities": ["text-4xl", "font-black", "leading-none", "tracking-tight", "md:text-6xl", "lg:text-7xl"]},
                   {"key": "subhead", "type": "text", "tag": "p", "text": "The launch map for a free Offer, checkout, and follow-up you can measure.", "utilities": ["max-w-[65ch]", "text-lg", "leading-relaxed", "md:text-xl", "lg:text-2xl"]}
                 ]
               },
               {
                 "key": "panel",
                 "type": "container",
                 "utilities": ["rounded-2xl", "bg-card", "text-card-foreground", "p-6", "shadow-elevated", "md:p-8"],
                 "children": [
                   {"key": "panel-title", "type": "heading", "tag": "h2", "text": "Send me the launch map", "utilities": ["text-2xl", "font-bold", "tracking-tight", "md:text-3xl"]},
                   {
                     "key": "optin-form",
                     "type": "form",
                     "id": "optin-form",
                     "utilities": ["mt-4", "flex", "flex-col", "gap-4"],
                     "behaviors": [
                       {"behavior": "validate-email", "event": "submit", "config": {"email": "{{ fields.email }}"}},
                       {"behavior": "optin", "event": "submit", "config": {"email": "{{ fields.email }}", "name": "{{ fields.first_name }}"}}
                     ],
                     "children": [
                       {"key": "first-name", "type": "text-input", "config": {"kind": "name", "name": "first_name", "label": "First name", "placeholder": "Avery"}},
                       {"key": "email", "type": "text-input", "config": {"kind": "email", "name": "email", "label": "Email", "placeholder": "you@example.com", "required": true}},
                       {"key": "submit", "type": "form-submit", "config": {"label": "Send me the launch map"}}
                     ]
                   },
                   {"key": "note", "type": "text", "tag": "p", "text": "No spam. Unsubscribe anytime.", "utilities": ["mt-3", "text-sm", "text-muted-foreground"]}
                 ]
               }
             ]
           }
         ]
       },
       {
         "key": "preview",
         "type": "section",
         "utilities": ["bg-background", "text-foreground", "px-4", "py-16", "font-sans", "sm:px-6", "md:py-24", "lg:px-8"],
         "children": [
           {
             "key": "preview-wrap",
             "type": "container",
             "utilities": ["mx-auto", "grid", "max-w-7xl", "gap-10", "items-start", "md:grid-cols-[0.82fr_1.18fr]", "lg:gap-16"],
             "children": [
               {"key": "preview-heading", "type": "heading", "tag": "h2", "text": "What the checklist clarifies", "utilities": ["text-4xl", "font-black", "tracking-tight", "md:text-5xl", "lg:text-6xl"]},
               {
                 "key": "preview-list",
                 "type": "container",
                 "utilities": ["grid", "gap-4", "text-base", "leading-relaxed", "md:text-xl"],
                 "children": [
                   {"key": "preview-1", "type": "text", "tag": "p", "text": "Which promise belongs on the opt-in step, not buried in follow-up copy.", "utilities": ["rounded-xl", "bg-muted", "p-5", "font-semibold"]},
                   {"key": "preview-2", "type": "text", "tag": "p", "text": "Where checkout, the Offer, and the thank-you step need to connect.", "utilities": ["rounded-xl", "bg-muted", "p-5", "font-semibold"]},
                   {"key": "preview-3", "type": "text", "tag": "p", "text": "Which revenue signals to watch once the Funnel is live.", "utilities": ["rounded-xl", "bg-muted", "p-5", "font-semibold"]}
                 ]
               }
             ]
           }
         ]
       }
     ]
   }
   ```

4. Render through Dent and inspect the screenshots.

   - Confirm the first screen contains the promise, form, and trust note.
   - Confirm there is no second CTA competing with the form submit.
   - Confirm every `{{ fields.* }}` behavior reference has a matching `text-input` `config.name`.
   - Confirm the form carries a non-empty `id` and a `form-submit` child; without them a draft owner returns `form.id_missing` or `form.submit_missing` warnings and a published one is a 422.
   - Confirm there is no trailing empty whitespace band after the last section on desktop or mobile.
   - Confirm the starter still passes the bans inherited from `designing.md`.
