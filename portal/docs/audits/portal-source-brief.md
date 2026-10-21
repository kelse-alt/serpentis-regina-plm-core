# Three-head website portal: source-based implementation brief

Status: source-based specification grounded in the accessible Notion blueprint, current Squarespace site, two code repositories, reviewed Drive documents and three actual GLB models. October 21, 2026. This is the master website entrance, not merely a client-account dashboard. Client-account features are a separate potential future workflow and must not substitute for the actual portal requested here.

## Controlling sources

- Founder: the current Squarespace website is the Serpentis Regina head, built out as a segment to begin getting customers. It remains a work in progress.
- Notion master blueprint: https://app.notion.com/p/SERPENTIS-REGINA-COM-255bab06d9b4802fb8dcfc4d396f6446
- Root blueprint text and expanded content captured under /workspace/audit-sources/blueprint-expanded.txt.
- Current Serpentis Regina experience: https://www.serpentisregina.com/; read-only findings in /workspace/website-audit.md.
- Existing code: /workspace/serpentis-regina-plm-core and /workspace/serpentis-regina-tech-design-lab; findings in /workspace/project-audit.md.
- Both Drive folders are now accessible. Model structure and browser rendering were inspected; /workspace/drive-audit.md records results. The founder confirmed Mother → Amaya Kelsea, Maiden → Serpentis Regina, Crown → KLS. Original names, source URLs, hashes and local paths are in /workspace/portal-assets.json. Three neutral-material GLBs are available; the separate colorful reference artwork is not embedded in their materials.

## Entrance requirements explicitly found in the blueprint

One main website houses three fully distinct sub-brands, each accessed through a 3D sculpted head. Heads rest on marble plinths/altars against soft spotlights and warm blush tones. The blueprint specifies 360-degree spin interaction, tap/click entry, smooth portal transitions and “Enter the World of ___” micro-animations. Another note describes slight head enlargement, a soft swirl, then a fade into the mini-site.

These are design requirements, not evidence that the supplied models already contain rotation or transition animations. Rotation and camera/transition effects may be implemented in the website once the assets are inspected. Marble plinths, lights and background treatment must be checked against any remaining visual-identity references.

## World 1: Amaya Kelsea — The Designer

Purpose: professional identity and portfolio, technical and creative work, fashion/business projects, freelance and contracting opportunities, industry credibility, grants, funding and residencies. The blueprint describes this as a much richer professional profile.

The identity emphasizes craftsmanship, material innovation, systems-level fashion thinking, exclusivity, intention and artistic luxury. The proposed hero is a full-screen braided-hair-look video with a centered logo and “Designer - System Architect - Founder.” Main sections are Portfolio, Technical, Designer, Services and Contact.

Portfolio inventory named by the source: hair collection, latex collection, orange look collection and MC Quilter Jacket. Collection structure: concept, material exploration, development and final editorial looks. Technical inventory: CAD/flats for womenswear, menswear, swimwear and bridal; tech-pack examples; 3D work including Corso Como; graded measurement sheets, measurement sheets and fit comments.

Services named include freelance fashion design, technical design/CAD, creative direction, mentorship/portfolio review, fashion business consulting, government contracting consulting, small-scale made-to-order design systems consulting and project management. Contact includes portfolio review booking, freelance inquiry, LinkedIn and email.

The blueprint also lists education and employer history. Treat these as founder-provided content requiring editorial confirmation before public publication; they have not been independently credential-verified by this audit. The actual portfolio images, videos, tech packs and project files named here are not supplied by merely reading their titles.

Existing reusable work: the two JavaScript repositories demonstrate measurement systems and learning/professional progress. Decide their placement within technical work and portfolio storytelling from the source documents, while keeping synthetic lab examples distinct from approved house records.

## World 2: Serpentis Regina — The Bespoke

Purpose: consumer-facing bespoke atelier, collections/editorials, commerce and invitation into one-to-one commissions. The blueprint specifies an exclusive, slow, intentional, sacred and luxurious experience with transformation and craftsmanship at its center.

Named pages match the launched segment: The Threshold, The Mirror, The Collections, The Archive, The Ritual and The Initiate.

- Threshold: full-bleed looping video, minimal text and entry language such as “Step into the mirror.” The launched page currently uses an editorial collage; do not treat the difference as an accidental defect without considering the site's staged development.
- Mirror: mythic, experiential brand voice, speaking as Serpentis Regina; structured around selectivity, beauty as discipline and invitation. It is distinct from Amaya's professional biography.
- Collections: lookbook-focused presentation, collection name/concept, editorial imagery and inquiry. Materials, techniques and commission options reveal progressively. Miss Thang and Tangled Up are explicitly named.
- Archive: full-screen editorial storytelling and creative direction, with credits and optional short concept text.
- Ritual: bespoke definitions, process and contract; current site supplies detailed pricing and commission stages.
- Initiate: booking; current site already contains an Acuity scheduling component.

Existing reusable work: approved 20-POM reference data, new measurement sessions and the 34-POM workbook-based intake. These are operational tools that may support a later customer/staff workflow; the portal entrance does not itself require exposing private client data. Preserve current business operations while planning any migration.

## World 3: KLS — The Procurement

The accessible blueprint identifies KLS as procurement and consulting. Its detailed section has not yet been established from accessible content. Do not reuse Amaya's service list as an assumed complete KLS offering or invent its audience, workflows or commercial terms. Its source notes remain required before detailed implementation can be finalized. The founder explicitly assigned Crown Head.glb to KLS, and that model loaded successfully in the browser review.

## Shared material and unresolved access

The root includes Brand Foundations with Typography, Colour System and Visual Identity, a Social Mirror with The Look/The World/The Signal, a live Instagram grid concept, a site-wide footer, Linked Active Project and a prior website audit reference. Some linked/database content displays “No access.” Missing typography/palette/database values must not be invented from the pink styling of the Notion document or the intake workbook.

The Social Mirror is described as a living window into editorials, atelier process, transformation, launches and women in the world. Determine its actual media sources and update workflow from the linked sources before building a live integration.

## Engineering recommendations, distinct from blueprint instructions

1. Implement the entrance as a presentation/routing layer that can preserve the working Serpentis Regina destination while other worlds are built. Exact routes, hosting and domain structure remain to be selected from the complete source set and platform constraints.
2. Supply text links and a static fallback for all three worlds. Ensure keyboard entry and visible focus; do not make the only route depend on dragging a 3D object or successful WebGL initialization.
3. Resolve click versus drag interaction so rotating a head does not accidentally navigate. Support reduced motion and a direct transition alternative.
4. Inspect asset size, triangle counts, textures, transforms and extensions before selecting a viewer, compression approach and mobile loading budget. Preserve the original GLBs; optimize derivatives separately.
5. Test desktop/mobile layout, all three destinations, loading/failure states, reduced motion and representative real-device rendering. Do not claim a model viewer works from placeholder geometry or a screenshot alone.
6. Treat future hosted client records as a separate authenticated data boundary. The current loopback servers are not ready to become public multiuser APIs without additional design and implementation.

## Current completion boundary

The core three-world information architecture is grounded in source text, and the actual models have been downloaded, mapped and rendered in a local asset-inspection implementation. They are ready to serve as geometry sources for the entrance; material styling, device performance and detailed linked brand/project content remain to be resolved during implementation. The review viewer is not the finished portal. No Squarespace edits, deployments, modified originals or invented brand copy have been published.

## Entrance implementation milestone

The founder subsequently requested coding the entrance and chose a reflective, colorful finish, pointing specifically to the head in the live site's top-left corner. A separate Vite/Three.js project now exists at /workspace/serpentis-portal. It implements the three original models, warm blush setting, marble plinths, rotation-versus-click distinction, world selection transitions, keyboard/modal behavior, mobile layout, reduced motion, finish switching and text-control fallback. Serpentis Regina links to the real atelier; Amaya and KLS open introductory panels pending full mini-sites. Presentation materials and short display copy are review-stage interpretations. No live website was edited or deployment performed.

Frozen-lockfile installation, production build and seven functional browser check groups passed. Model copies match source hashes. Screenshots and result evidence are under serpentis-portal/artifacts; source and model copies are packaged in /workspace/serpentis-portal-v0.1.0.zip. Original portfolio documents and client data are excluded from the app.
