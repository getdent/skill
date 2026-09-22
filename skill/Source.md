---
name: dent
description: "Build and run a Dent Site through its first-party API: Funnels, Pages, Offers, Articles, Courses, Spaces, Analytics. Trigger on Dent, funnel, opt-in page, sales page, checkout, course. Do not trigger for WordPress-only work."
license: MIT
metadata:
  version: "{{VERSION}}"
  homepage: "https://getdent.app"
---

# Dent

[Dent](https://getdent.app) spins up marketing Sites that sell and deliver digital Products. Operate it through the first-party schema-driven API. This skill lives at [github.com/getdent/skill](https://github.com/getdent/skill).

The person you are talking to is a course creator or a marketer. They say "put my opt-in page live", "make this the homepage", "switch the theme", "how did last month go". You own every technical step. You report back in their words: what is live, at which URL, what changed, what happens next.

Never put a route, a JSON body, an id, or a status code in a reply to the operator unless they ask for it.

Use Dent's words exactly: Funnel, Funnel Step, Offer, Product, Order, Cart, Checkout, Page, Article, Design, Link, Theme, Space, Course, Contact, Visitor.

## Process

1. Open the session yourself. The operator never touches a terminal.

   <!-- dent:cli:start -->
   - IF `dent` is not on PATH, run each Dent CLI command as `npx @getdent/skill@latest <command>`.
   - Run the check, then the update only when the check printed an update line, then the identity read. You run them; never hand one back to the operator.

     ```bash
     dent check
     dent update   # only after `dent check` printed an update line; then `dent check` again
     dent whoami
     ```

   - `dent check` compares the installed skill and the CLI against the published package. When it prints an update line, run `dent update` and `dent check` again before any write. See `references/updating-the-skill.md`.
   - IF `dent whoami` fails, run `dent login --no-open`. It prints the authorize URL and blocks while it waits for the browser to come back. You cannot open the operator's browser, so give them that URL in one plain line and wait for the command to return.

     ```bash
     dent login --no-open
     ```

     Say it like this: "Open this link and click Authorize. I'll take it from there."
   - IF the browser cannot reach this machine (a remote browser, a locked-down machine, a web agent), use the two-step copy-code login. Start it, hand over the URL, then finish it with the code the operator reads back. The code page shows the code as text that cannot be selected and has no copy button, so ask them to type it out. It works once and for five minutes.

     ```bash
     dent login --copy-code --start
     dent login --copy-code --code <code>
     ```

   - When the account has more than one Dent Site, the authorize screen asks the operator to pick one. Tell them which Site you ended up on, by its address, before you write anything.
   - Never ask the operator to create a personal access token for normal login. Never put a token in argv, a file, a report, or a commit.
   - `dent logout` signs this machine out. It revokes the token on Dent when Dent let the CLI see the token's id at login; otherwise it says so, and you tell the operator to revoke the token in their Dent SPA (the admin surface they log into).
   - `dent setup` and `dent reset` switch between a local Dent repo and the live Site. Use them only when developing against a local Dent.
   <!-- dent:cli:end -->

   <!-- dent:web:start -->
   - Claude web has no local CLI, so ask the operator once to paste a Dent personal access token for this chat. Say it plainly: it is a password-like key, it stays in this chat, and it is the only way this chat can reach their Dent Site.
   - Keep the token in chat memory only. Never write it to a file, a report, or a command line.
   - Confirm it works by reading the catalog before anything else: `GET /api/v1/schema/`.

     ```js
     const siteUrl = 'https://example.com';
     const apiKey = 'paste-token-for-this-chat';
     async function dent(path, options = {}) {
       const response = await fetch(`${siteUrl}${path}`, {
         method: options.method ?? 'GET',
         headers: {
           Authorization: `Bearer ${apiKey}`,
           Accept: options.accept ?? 'application/json',
           ...(options.body ? { 'Content-Type': 'application/json' } : {}),
         },
         body: options.body ? JSON.stringify(options.body) : undefined,
       });
       const text = await response.text();
       const payload = response.headers.get('content-type')?.includes('json') ? JSON.parse(text || 'null') : text;
       if (!response.ok) throw new Error(`${response.status}: ${JSON.stringify(payload)}`);
       return payload;
     }
     ```
   - Claude web cannot update its own skill. IF the instructions here look older than the Site, tell the operator to upload a fresh Dent Claude-web ZIP. See `references/updating-the-skill.md`.
   <!-- dent:web:end -->

2. Read the catalog before you write. Never guess an entity, field, action, or route.

   - The catalog is `GET /api/v1/schema/`. Read the entity you are about to touch and confirm its `fields`, its `actions`, and each action's `mode`, `target`, and `parameters`.
   - `fields` is a list; each entry has `key`, `type`, `readOnly`, and `config`. `parameters` is an object keyed by parameter name.
   - Route grammar the catalog confirms: `GET /api/v1/{entities}` lists, `GET /api/v1/{entities}/{id}` reads one, `POST /api/v1/{entities}` creates, `POST /api/v1/{entities}/{id}` updates, `DELETE /api/v1/{entities}/{id}` deletes. A named action is `/{entities}/{action}` for a collection and `/{entities}/{id}/{action}` for one record. The verb comes from `mode`: `read` is GET, `write` is POST, `remote` is POST, `destroy` is DELETE.
   - The named form of a plain create or update is not a route. `POST /api/v1/pages/{id}/update` returns 404; the update is `POST /api/v1/pages/{id}`. <!-- dent:404 -->
   - Bodies are flat. Send `{"status": "published"}`, never `{"attributes": {"status": "published"}}`.
   - Lists take `page`, `perPage`, `ids`, `search`, `sortBy`, `sortOrder`, and answer `{ items, total, page, pageCount }`.
   - Funnel Steps live under their Funnel: `/api/v1/funnels/{funnelId}/steps`. Sections live under their Course: `/api/v1/courses/{courseId}/sections`. Lessons live under their Section: `/api/v1/sections/{sectionId}/lessons`. A flat `/api/v1/steps` is a 404. <!-- dent:404 -->
   - Settings, Dent, and Account answer only named collection routes. The Settings read is `GET /api/v1/settings/get`; a bare `GET /api/v1/settings` is 404. <!-- dent:404 -->
   - Published means `published`. The status values are `draft`, `review`, `scheduled`, `published`, `archived`. There is no `publish`.

   <!-- dent:cli:start -->
   ```bash
   dent schema funnels
   dent api funnels
   dent api courses 9203 sections
   dent api dent breakdown --param dimension=source --param period=last_month --param limit=5
   ```

   `dent api` reads the catalog once per invocation and takes the HTTP method from the action's `mode`. `dent api pages 15` and `dent api pages/15` are the same call. `--method` is the explicit override. A bare nested collection lists; a create needs `--data`.
   <!-- dent:cli:end -->

   <!-- dent:web:start -->
   ```js
   const catalog = await dent('/api/v1/schema/');
   ```
   <!-- dent:web:end -->

3. Build every Page, Article, and Funnel Step in this order: interview, then copy, then Design. Never skip ahead.

   1. Interview the operator in plain language and write the brief → `references/interview.md`.
   2. Write the finished copy → `references/writing/copywriting.md` plus the matching writing leaf.
   3. Design from the brief and the finished copy → `references/design/designing.md` plus the matching design leaf.

   - Opt-in Page or opt-in Funnel Step → `references/writing/optin-page.md` and `references/design/optin-page.md`.
   - Sales Page or sales Funnel Step → `references/writing/sales-page.md` and `references/design/sales-page.md`.
   - Checkout Funnel Step → `references/writing/sales-page.md` and the Checkout starter in `references/design/sales-page.md`.
   - Upsell Funnel Step → `references/writing/upsell-page.md` and `references/design/upsell-page.md`.
   - Thank-you Page or Funnel Step → `references/writing/thank-you-page.md` and `references/design/thank-you-page.md`.
   - Article or content Page → `references/writing/article.md` and `references/design/article.md`.

   A Funnel Step is not a Page. Never call one the other. A Page renders inside the Site's page Template, so it carries the Site header navigation and footer. A Funnel Step renders inside funnel chrome with no Site navigation. An opt-in, sales, upsell, or thank-you page that must carry no navigation is a Funnel Step, never a Page.

4. Build an opt-in Funnel.

   - Do the interview, copy, and Design for both public Funnel Steps first.
   - Create the Funnel: `POST /api/v1/funnels` with `{"name": "Lead magnet opt-in"}`. Dent creates it `published` and returns `homeStepId`.
   - The Funnel Step at `homeStepId` is the opt-in Funnel Step. Do not create a second one for it.
   - Create the thank-you Funnel Step: `POST /api/v1/funnels/{funnelId}/steps` with `{"title": "Thank You"}`.
   - Before each Design write, read what is there: `GET /api/v1/funnels/{funnelId}/steps/{stepId}/design` returns `{ revision, design }`.
   - Write the Design: `POST /api/v1/funnels/{funnelId}/steps/{stepId}/replace-design` with `{"revision": "<the revision you just read>", "design": {...}}`. A stale `revision` returns 409. Re-read and send again.
   - Do the same for the thank-you Funnel Step so its public URL is never empty.
   - Publish each public Funnel Step: `POST /api/v1/funnels/{funnelId}/steps/{stepId}` with `{"status": "published"}`.
   - Read the Funnel Step back: `GET /api/v1/funnels/{funnelId}/steps/{stepId}`. Confirm `status` and `viewUrl` before you give the operator a link.
   - Verify the opt-in the way a real Visitor does:
     1. `GET` the Funnel Step `viewUrl` with a cookie jar. That renders the form and starts the Visitor session.
     2. With the same cookies, `POST /api/v1/forms/submit` with `{"owner": {"type": "step", "id": stepId}, "form": "optin-form", "fields": {"email": "visitor@example.com", "first_name": "Visitor"}}`. `form` is the `id` on the form element in the Design; each field name is a `config.name` on an input. A form on a Page submits the same way with `{"type": "page", "id": pageId}` as the owner.
     3. `success: true` is the proof.
     4. Find the Contact: `GET /api/v1/contacts?search=visitor@example.com`.
   - Tell the operator: the opt-in page is live at its URL, the thank-you page is live at its URL, a test signup went through, and here is where their new Contacts land.

5. Build a sales Funnel.

   - Do the interview, copy, and Design for the Checkout, upsell, and thank-you Funnel Steps first.
   - Create each Product: `POST /api/v1/products` with `{"name": "Core Course", "value": 97, "status": "published"}`.
   - Create each Offer: `POST /api/v1/offers` with `{"name": "Core Offer", "price": 97, "active": true, "products": [productId]}`. `products` takes plain ids. `[{"productId": ...}]` returns a 500.
   - Create the Funnel with `POST /api/v1/funnels`, then the Funnel Steps with `POST /api/v1/funnels/{funnelId}/steps`.
   - Attach the Offer and the Order bump to the Checkout Funnel Step: `POST /api/v1/funnels/{funnelId}/steps/{stepId}` with `{"offers": [{"offerId": 123}], "bumps": [{"offerId": 456}]}`.
   - Attach the upsell Offer the same way, with `{"offers": [{"offerId": upsellOfferId}]}`.
   - Read each Design, then `POST /api/v1/funnels/{funnelId}/steps/{stepId}/replace-design` with the fresh `revision`.
   - Publish each public Funnel Step with `{"status": "published"}`.
   - Verify Checkout like a real Visitor:
     1. `GET` the Funnel's home `viewUrl` with a cookie jar, then `GET` the Checkout Funnel Step `viewUrl` with the same jar.
     2. In the Checkout page HTML find `dentCheckout = {...};` and read `cartId` and `j` from it.
     3. With the same cookies, `POST /api/v1/checkout/{cartId}/submit?cart_id={cartId}&j={j}` with `{"fields": {"checkout": {"billing": {"first_name": "Test", "last_name": "Buyer", "email": "buyer@example.com"}, "payment": {"gateway": "dent_test"}, "terms": "1"}}}`. `terms` is required when the Design carries a `checkout-terms` element (the starter does); without it Dent answers `result: "failure"` and asks for the terms.
     4. `result: "success"` with a `redirect` carrying `order=` is the proof. Read the Order: `GET /api/v1/orders/{orderId}`.
   - Tell the operator: the checkout page is live at its URL, what it sells and for how much, that the bump and upsell are attached, and that a test purchase went through on the test gateway so no real money moved.

6. Make it live.

   - Publish anything the public must see: `{"status": "published"}` on that record's update route. Funnels and Funnel Steps are created published already.
   - Homepage. Pick the one that matches what the operator pointed at. Body is `{}` for all three.
     - A Page becomes the homepage: `POST /api/v1/pages/{id}/set-homepage`.
     - A whole Funnel becomes the homepage, so its home Funnel Step answers at the root: `POST /api/v1/funnels/{funnelId}/set-homepage`.
     - One specific Funnel Step becomes the homepage: `POST /api/v1/funnels/{funnelId}/steps/{stepId}/set-homepage`.
   - The homepage can only move, never be switched off. The record serving the homepage cannot be deleted until the homepage moves.
   - Theme: read the choices with `GET /api/v1/settings/theme`. It returns `theme` (the current one), `themes` (the available ones, today `atlas`, `echo`, `frame`, `glide`, `mist`, `pulse`, `spire`, with their tokens), `vocabulary`, `fonts`, and `fontFaces`. Use the `themes` it returns, never a list from memory. Describe each to the operator by what its tokens say (colors, type, radius), never by id alone. Save with `POST /api/v1/settings/save-theme` and `{"themeId": "atlas"}`.
   - Business settings: read with `GET /api/v1/settings/get`, write with `POST /api/v1/settings/update` and flat fields such as `businessName`, `addressLine1`, `city`, `country`, `timezone`, `currency`, `email`, `phone`, `refundPolicy`, `footerLegal`.
   - Site icon, three calls:
     1. `POST /api/v1/media/upload-url` with `{"filename": "icon.png"}`.
     2. PUT the file bytes to the URL it returns.
     3. `POST /api/v1/media/process` with `{"key": "<the key from step 1>"}`, then `POST /api/v1/settings/update-icon` with `{"iconId": mediaId}`.

7. Author Articles, Pages, Templates, and Components. Each one owns a Design.

   - Article: `POST /api/v1/articles` with `{"title": "...", "status": "published", "design": {"version": 1, "elements": [...]}}`. The Article carries its Design on create and answers with a `revision`. Later edits go through `GET /api/v1/articles/{id}/design` and `POST /api/v1/articles/{id}/replace-design`.
   - Page: `POST /api/v1/pages` with `{"title": "...", "status": "published"}`, then `GET /api/v1/pages/{id}/design` and `POST /api/v1/pages/{id}/replace-design` with the `revision`. A title already in use is accepted and the Site appends `-2` to the slug, so read `viewUrl` back before you give the operator a link.
   - Template: `POST /api/v1/templates` with `{"name": "...", "type": "single", "entityType": "page", "status": "published"}`, then the same design read and replace.
   - Component: `POST /api/v1/components` with `{"key": "...", "name": "...", "status": "published"}`, then the same design read and replace.
   - The Site document itself is a Design too: `GET /api/v1/settings/design` and `POST /api/v1/settings/replace-design`.

8. Change a Design that already exists.

   - Read it: `GET /api/v1/{entities}/{id}/design` → `{ revision, design, owner }`. The owners are pages, articles, templates, components, settings, and `funnels/{funnelId}/steps`. Send back `revision` and `design` only.
   - Interview the operator about what must be different, rewrite the copy, then redesign, in that order.
   - Write it back: `POST /api/v1/{entities}/{id}/replace-design` with the `revision` you just read.
   - A 409 means someone else saved in between. Read again, reapply your change, send again. Never invent a `revision`.
   - Open the public URL, look at what rendered, and show the operator. Repeat until they say it is right.

9. Set up what is sold and delivered.

   - Course: `POST /api/v1/courses` with `{"title": "...", "slug": "...", "status": "published", "privacy": "secret"}`.
   - Section: `POST /api/v1/courses/{courseId}/sections` with `{"title": "...", "position": 1}`. Sections publish by default.
   - Lesson: `POST /api/v1/sections/{sectionId}/lessons` with `{"title": "...", "body": "...", "contentType": "text", "position": 1}`. Lessons publish by default.
   - Space: `POST /api/v1/spaces` with `{"title": "...", "slug": "...", "privacy": "secret", "status": "published"}`.
   - Product that delivers a Course or a Space: `POST /api/v1/products` with `{"name": "...", "value": 97, "status": "published", "courseIds": [courseId], "spaceIds": [spaceId]}`.
   - Product that sells Dent itself: `"fulfillment": [{"type": "tenant", "plan": "starter", "source": "<the Funnel's name>"}]` on the Product. Plans are `starter`, `normal`, `done_for_you`. Dent provisions the Customer's Site after delivery; nothing else to call.
   - Offer: `POST /api/v1/offers` with `{"name": "...", "price": 97, "active": true, "products": [productId]}`. Customers buy Offers; Products are what an Offer includes.
   - Outbound webhook: `POST /api/v1/webhook-endpoints` with `{"name": "...", "url": "https://...", "sends": [], "enabled": true}`. The response carries `secret` once; give it to the operator once and never store it.
   - Contacts come from opt-in forms and Checkout, not from you. To put an existing Contact in a Space: `POST /api/v1/spaces/{spaceId}/add-member` with `{"contact_id": contactId, "role": "member"}`. Read members with `GET /api/v1/spaces/{spaceId}/list-members`.

10. Answer "how did last month go".

    - Traffic and source breakdowns: `GET /api/v1/dent/breakdown` with `dimension` and `period`. Dimensions are `source`, `referrer`, `campaign`, `country`, `region`, `city`, `device`, `browser`, `entry_pages`. `period` defaults to `last_30_days`.
    - Revenue: `GET /api/v1/orders/revenue-by-date`, `GET /api/v1/orders/revenue-by-product`, `GET /api/v1/orders/revenue-by-source`, `GET /api/v1/orders/revenue-by-campaign`.
    - Report the answer in money, people, and names. "Last month you made $4,120 from 38 orders. Most of it came from the newsletter." Not a table of ids.

    <!-- dent:cli:start -->
    ```bash
    dent api dent breakdown --param dimension=source --param period=last_month --param limit=5
    dent api orders revenue-by-source --param period=last_month
    ```
    <!-- dent:cli:end -->

11. Stay correct.

    - Use Dent's words exactly. Never say Product when you mean Offer. Never say Page when you mean Funnel Step.
    - Read after every write. Read the record back before you tell the operator it is done, and open the public URL before you hand it over.
    - When Dent returns an error, read its status and its body and fix the cause. Never retry with a guess, never invent a fallback, never report success you did not read back.
    - A `422` on publish or on `replace-design` means the Design failed validation and nothing was saved. Fix the Design, not the status. Every form needs a non-empty unique `id`, a `form-submit` child, and uniquely named fields; an `optin` behavior needs `config.email`.
    - Never use WordPress routes: no `/wp/wp-login.php`, no admin-ajax, no Bricks save routes, no WordPress REST. Needing one is a first-party gap to report, not a path to take.
    - Never put a bearer token in argv, a project file, a report, or a commit.

12. Report to the operator in their words.

    - Every reply answers three things, in this order: what is live now, where it is, and what is next.
    - Use the names they use. "Your free checklist page is live at yoursite.com/checklist. Signups land in your Contacts. Next: point your homepage at it, or build the paid offer."
    - Name money, page names, and URLs. Never a route, a JSON body, a record id, or a status code, unless the operator asks for it.
    - When something failed, say what did not work and what you are doing about it, in one plain line. Never paste an error at them.
    - When you need a Decision only they can make (a price, a promise, a name, which page is the homepage), ask one short question and stop.

## Routes and auth

Everything the Process above does not already call.

- Auth is bearer on every request: `Authorization: Bearer <credential>` and `Accept: application/json`. A Dent token starts with `dent_`, expires 365 days after it is minted, and answers 401 after that.
- `GET /platform/api/v1/tokens` lists the account's tokens and `DELETE /platform/api/v1/tokens/{id}` revokes one, on the platform origin, not the Site. Under a CLI token the list carries no ids and `GET /platform/api/v1/tokens/identity` answers an error, so the operator revokes it in the Dent SPA.
- `GET /api/v1/account/details` reads the Account. `DELETE /api/v1/settings/reset-theme` clears theme overrides.
- `GET /api/v1/orders/attributed-revenue` reads revenue by attribution.
- The Cart routes serve the Visitor and need the Visitor session cookies from a `GET` of the public URL first:
   - `GET /api/v1/cart` reads the Cart, and answers 404 when there is none. <!-- dent:404 -->
  - `POST /api/v1/cart` takes `{"action": "add_offer|remove_offer|update_billing", "offer_id": ..., "price": ..., "billing": {...}}`.
  - `POST /api/v1/cart/checkout` takes `{"billing": {"email": "..."}, "gateway": "dent_test", "note": "..."}`.
  - `GET|POST /api/v1/funnel/cart` is the funnel-bound Cart. It needs `step_id` and the Visitor session from a Funnel Step pageview.
  - `POST /api/v1/checkout/{cart}/refresh` re-prices a Cart mid-Checkout.
- A one-click upsell answers `POST /api/v1/offers/{offer}/accept` and `POST /api/v1/offers/{offer}/decline` with `{"order_id": orderId, "step_id": stepId}`. Funnel Step Designs bind `{{ offer.acceptUrl }}` on a button.
- `dent_test` is the test gateway. It moves no real money.

## References (each solves one problem)

- The installed Dent skill is stale → references/updating-the-skill.md
- Resolving a Dent call the Process does not show, or an error Dent returned → references/api.md
- Establishing the Page, Article, or Funnel Step brief in operator language → references/interview.md
- Writing Page, Article, and Funnel Step copy before design → references/writing/copywriting.md
- Writing opt-in Page or opt-in Funnel Step copy → references/writing/optin-page.md
- Writing sales Page, sales Funnel Step, or Checkout copy → references/writing/sales-page.md
- Writing one-click upsell Funnel Step copy → references/writing/upsell-page.md
- Writing thank-you Page or confirmation Funnel Step copy → references/writing/thank-you-page.md
- Writing Article or content Page copy → references/writing/article.md
- Designing Page, Article, and Funnel Step visuals after copy → references/design/designing.md
- Designing opt-in Page or opt-in Funnel Step visuals → references/design/optin-page.md
- Designing sales Page, sales Funnel Step, or Checkout visuals → references/design/sales-page.md
- Designing one-click upsell Funnel Step visuals → references/design/upsell-page.md
- Designing thank-you Page or confirmation Funnel Step visuals → references/design/thank-you-page.md
- Designing Article or content Page visuals → references/design/article.md
