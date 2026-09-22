---
description: Design an Article or content Page from the shared brief and finished copy, with a designed header, readable content column, and one contextual CTA.
---

# Design an Article or content Page

Use this after `interview.md`, `writing/copywriting.md`, and `designing.md`. This leaf owns only the Article anatomy and starter Design; `designing.md` owns the shared visual process, Dent Designer vocabulary, anti-slop bans, the Design contract, and render verification.

## Process

1. Read the shared brief and finished copy before changing the starter.

   - Confirm `surface` is Article or content Page and `page_job` is understanding before conversion.
   - Use the finished copy to decide heading hierarchy; do not invent sections to make the layout busier.
   - Use `audience`, `reader_awareness_stage`, and `objections` to place one contextual CTA where it helps the reader continue.
   - Keep the body column readable with `max-w-[65ch]` and `prose` when the content is long-form.
   - Use one CTA. It should match the Article's context, not hijack the piece.

   ### Let reading be the main interaction
   The Article should feel designed without interrupting comprehension.
   Never: turn each paragraph into a card, add repeated section eyebrows, or break the reading column with decorative grids.

2. Shape the Article anatomy.

   - Header: designed title area, summary, author or context note when useful.
   - Body: readable content column using semantic headings, text, quotes, lists, and optional callouts.
   - Contextual CTA: one relevant next action, placed after the argument or next to a practical takeaway.

   ### Use prose styling for the article body
   The `prose` utility is the Dent-supported content reading affordance. Keep the body to `max-w-[65ch]` and avoid full-width paragraphs.
   Never: stretch long-form text across `max-w-6xl` because the page has room.

3. Clone and adapt this starter.

   Replace the title, summary, body, and CTA. A button that navigates is `"tag": "a"` with `attributes.href`, the shape Dent's own tests use. Keep the anti-slop structure: no repeated tracked uppercase eyebrows, no border plus `shadow-elevated` decoration on one element, no radius above `rounded-2xl`, and no body text wider than `max-w-[65ch]`.

   ```json
   {
     "version": 1,
     "elements": [
       {
         "key": "article-header",
         "type": "section",
         "utilities": ["bg-muted", "px-4", "py-16", "font-sans", "text-foreground", "antialiased", "sm:px-6", "md:py-24", "lg:px-8", "lg:py-28"],
         "children": [
           {
             "key": "article-header-wrap",
             "type": "container",
             "utilities": ["mx-auto", "grid", "max-w-7xl", "gap-10", "md:grid-cols-[0.75fr_1.25fr]", "items-end", "lg:gap-16"],
             "children": [
               {"key": "article-meta", "type": "text", "tag": "p", "text": "Field note for course operators", "utilities": ["text-sm", "font-bold", "text-primary", "md:text-base"]},
               {"key": "article-title-block", "type": "container", "utilities": ["flex", "max-w-[65ch]", "flex-col", "gap-6"], "children": [
                 {"key": "article-title", "type": "heading", "tag": "h1", "text": "The Funnel Step to build when your course launch feels random", "utilities": ["text-4xl", "font-black", "leading-none", "tracking-tight", "md:text-6xl", "lg:text-7xl"]},
                 {"key": "article-summary", "type": "text", "tag": "p", "text": "A practical way to choose the next sales surface by buyer commitment, not by what everyone else seems to be publishing.", "utilities": ["text-lg", "leading-relaxed", "md:text-xl", "lg:text-2xl"]}
               ]}
             ]
           }
         ]
       },
       {
         "key": "article-body",
         "type": "section",
         "utilities": ["bg-background", "px-4", "py-16", "font-sans", "text-foreground", "sm:px-6", "md:py-24", "lg:px-8"],
         "children": [
           {"key": "article-body-wrap", "type": "container", "utilities": ["mx-auto", "grid", "max-w-7xl", "gap-10", "md:grid-cols-[minmax(0,65ch)_minmax(280px,0.5fr)]", "items-start", "lg:gap-16"], "children": [
             {"key": "article-content", "type": "container", "utilities": ["prose", "max-w-[65ch]", "text-lg", "leading-relaxed", "md:text-xl"], "children": [
               {"key": "article-p1", "type": "text", "tag": "p", "text": "A random launch usually starts with a reasonable question: should you write more emails, improve the sales Page, add a webinar, or rebuild Checkout? The options all sound productive, which is why they are hard to prioritize."},
               {"key": "article-h2-1", "type": "heading", "tag": "h2", "text": "Start where the buyer gets stuck", "utilities": ["text-3xl", "font-black", "tracking-tight", "md:text-4xl"]},
               {"key": "article-p2", "type": "text", "tag": "p", "text": "If people understand the promise but do not buy, the problem is probably the Offer or Checkout. If they do not understand why the course matters, the sales Page needs clearer proof before you touch payment."},
               {"key": "article-quote", "type": "quote", "text": "Build the next Funnel Step at the exact point where buyer commitment drops.", "utilities": ["rounded-2xl", "bg-muted", "p-6", "text-xl", "font-bold", "leading-snug", "tracking-tight", "md:text-2xl"]},
               {"key": "article-h2-2", "type": "heading", "tag": "h2", "text": "Use one diagnostic before adding a new asset", "utilities": ["text-3xl", "font-black", "tracking-tight", "md:text-4xl"]},
               {"key": "article-list", "type": "list", "utilities": ["grid", "gap-3"], "children": [
                 {"key": "article-li-1", "type": "list-item", "text": "No opt-ins: sharpen the promise and lead magnet."},
                 {"key": "article-li-2", "type": "list-item", "text": "No Checkout starts: improve proof and Offer clarity."},
                 {"key": "article-li-3", "type": "list-item", "text": "Checkout starts but no Orders: remove payment uncertainty."}
               ]}
             ]},
             {"key": "article-cta", "type": "container", "utilities": ["rounded-2xl", "bg-card", "text-card-foreground", "p-6", "shadow-elevated", "md:sticky", "md:top-6", "lg:p-8"], "children": [
               {"key": "article-cta-heading", "type": "heading", "tag": "h2", "text": "Choose your next step", "utilities": ["text-3xl", "font-black", "tracking-tight"]},
               {"key": "article-cta-copy", "type": "text", "tag": "p", "text": "Get the launch map and identify which Funnel Step has the most leverage right now.", "utilities": ["mt-3", "text-base", "leading-relaxed", "md:text-lg"]},
               {"key": "article-cta-button", "type": "button", "tag": "a", "attributes": {"href": "/"}, "text": "Get the launch map", "utilities": ["mt-6", "inline-flex", "h-14", "w-full", "items-center", "justify-center", "rounded-2xl", "bg-primary", "px-6", "text-base", "font-bold", "text-primary-foreground", "shadow-elevated", "md:text-lg"]}
             ]}
           ]}
         ]
       }
     ]
   }
   ```

4. Render through Dent and inspect the screenshots.

   - Confirm the header feels designed and distinct from a bare title.
   - Confirm the body column is readable at desktop and mobile widths.
   - Confirm there is one contextual CTA.
   - Confirm the starter still passes the bans inherited from `designing.md`.
