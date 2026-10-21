# Serpentis Regina website audit

Initial read-only review, October 21, 2026. Source: https://www.serpentisregina.com/ and linked public pages. This captures the current customer-facing segment; the founder's full master blueprint governs the future scope. No live edits or form submissions were made.

## What the current site establishes

The site presents an expressive fashion house built around transformation, silhouette, discipline, intimacy and ritual. The homepage combines a pink sculpted head logo, editorial photographic collage, red serif lettering, a dark photographic background, a green Mirror call to action and a red footer. These observations come from a rendered desktop screenshot, not inferred palette rules for future pages.

The main navigation leads through The Archive, The Collection, The Mirror, The Ritual and The Initiate. The public journey combines editorial discovery, garment browsing, bespoke process information and consultation booking. It supplies customer-facing context for a future portal; the precise portal requirements remain dependent on the blueprint and related project documents.

| Page | Observed content and function | Validation |
|---|---|---|
| / | Editorial collage; “You're not here by accident”; “Step Into The Mirror”; newsletter and footer | HTTP 200 and rendered desktop review |
| /the-archive | Miss Thang, Praise Thee, Tangled Up, Distorted Reality, Heated Nature and Pyramid project links | HTTP 200; project detail pages not yet audited |
| /collections | Six garment listings; category filters for bodysuits, skirts, editorial looks, sculptural tailoring, collections and dresses | HTTP 200; filtering, product details and checkout not exercised |
| /themirror | Brand narrative: beauty as discipline, devotion and deliberate power | HTTP 200 |
| /services-store | Bespoke process, price guidance, inclusions, payment terms and FAQ | HTTP 200 |
| /appointments | “Request Initiation”; private atelier consultations; Acuity scheduling markup | HTTP 200; scheduler booking not tested |
| /privacy-policy | Standard page-not-found content | HTTP 404 |
| /terms | Standard page-not-found content | HTTP 404 |

## Existing business workflow to account for

The Ritual describes a $500 consultation credited toward a commission, design conception, fitting and delivery. It lists a 50% deposit and 50% final payment. Starting prices shown are $2,500 cocktail dress, $5,000 evening gown, $10,000 bridal and $3,500 suiting. These are observed public website statements, not new pricing recommendations.

The appointments page includes an Acuity scheduling component with calendar and appointment-type identifiers. Preserve awareness of this existing integration when deciding future consultation, payment or intake workflows; do not assume a booking system must be rebuilt. No reservation or payment was attempted.

Potential integration sequence, still a proposal pending the blueprint: consultation discovery and booking could connect to client intake, a commission record, fitting milestones and delivery. Existing code currently implements local measurement records and intake, not this complete sequence.

## Findings and priorities

1. **Repair the two linked policy destinations.** Privacy Policy and Terms of Service links return HTTP 404. Decide their approved content and correct destination before changing links. This audit does not supply legal terms or assess legal compliance.
2. **Verify newsletter storage configuration.** Retrieved public HTML contains Squarespace's “This newsletter signup form needs a storage option” warning. It was not visible in the rendered desktop page, so it may be an editor/status element. Inspect the block's storage integration and verify actual delivery with an authorized test; no email submission was performed in this review.
3. **Clarify collection purchasing intent.** All six retrieved listings display $0.00; five also show “Sold out.” Determine whether the collection is an archive, inquiry catalogue or transactional shop, then make price, availability and calls to action consistent with that choice. Do not infer that zero prices are intended or that checkout works.
4. **Review the service page's content order and timing language.** Source/reading order exposes stage I, then III, then II and IV. This may reflect a multi-column layout; verify mobile and assistive-technology reading order. The total is described as 10–16 weeks in one place and 12–16 weeks in the FAQ; reconcile the intended customer promise.
5. **Add a purposeful homepage search description.** The retrieved homepage meta description is empty. Use approved house language and the actual service proposition. Search-ranking effects were not measured.
6. **Review text contrast and interactive clarity.** The desktop screenshot shows small red navigation on dark imagery and low-contrast small footer text on red. Measure computed color contrast and test focus/keyboard states before claiming accessibility conformance. No quantitative WCAG pass/fail claim is made here.
7. **Audit route consistency without overstating rate-limit results.** Header links use /themirror, /services-store and /appointments; footer links use /the-mirror, /the-ritual and /the-initiate. Requests to aliases and /the-contract encountered HTTP 429 during this crawl. Some aliases redirected before the limit; their final functionality remains unverified. Retest slowly rather than treating 429 as a missing page.

## Limits and evidence

Source HTML and extracted text are stored under /workspace/audit-sources/. A rendered homepage capture is website.png. Chromium initially failed to read the environment's certificate trust in the restricted execution context; a scoped browser run using the existing trust database succeeded with TLS verification enabled. No certificate validation bypass was used.

The crawl stopped expanding after rate limits appeared. No authenticated Squarespace editor access, checkout, booking submission, newsletter submission, mobile interaction test, full performance measurement or exhaustive accessibility audit was performed. The blueprint contains a reference to an earlier dated website audit; that linked source must be read separately before reconciling its claims with this current review.
