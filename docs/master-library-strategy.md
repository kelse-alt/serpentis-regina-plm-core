# Master library strategy

**Future strategy.** The daily-workflow build does not implement a master library,
structured fitting rounds, a bill of materials, or production release approvals.
See the [daily-workflow guide](workroom-daily-workflow.md) for the current app.

## Start with one garment and a few house definitions

Review a few terms and permitted examples from one past project privately. Compare
what they actually mean, then write the Serpentis Regina definition in the
founder’s working language. A past job’s label is evidence, not an automatic house
standard. Pilot a small POM set, its diagrams, and a few construction details with
a pattern maker and maker before expanding to another garment category.

## Separate the library categories

| Category | Reusable definition | Style/sample-specific information |
|---|---|---|
| Garment POMs, methods and diagrams | Code, name, landmarks, path, state and diagram | Finished specs, measured samples and selected critical flags |
| Pattern blocks | Identity, scope, file version, reference size and permitted use | Style adaptations, piece changes and pattern revision |
| Construction details | Applicable seam, stitch, allowance, finish or assembly detail | Selected detail, exceptions and numbered callouts |
| Materials/components | Article, composition, weight, usable width and units | Colorway, consumption, quote and cost |
| Tolerance rules | Reviewed plus/minus limits with POM/material/method context | Selected limits and measured sample results |
| Grade rules | Reviewed POM/size-interval increments and base-size assumptions | Chosen size run, values and deliberate overrides |

A pattern block, body measurement, finished garment spec and grade increment are
different concepts. Do not invent master measurements, ease, tolerances or grade
increments to populate a catalog. Bespoke work need not use a graded size run.

## Match context before matching names

Each garment POM needs a stable ID/version, preferred house name, garment category,
method, landmarks, diagram/version, equipment or preparation, provenance and
review decision. Record flat width versus circumference, straight versus contoured
path, relaxed versus stretched, before/after wash, and fastened/open where relevant.

For example, “half chest,” “bust” and “chest width” cannot be merged from their names
alone. Confirm object, landmarks, path and state. Keep genuinely different methods
as separate definitions or explicitly versioned relationships. Job-specific aliases
remain contextual; suggest a match for review rather than silently renaming data.

Keep **BF mannequin references**, **RC client measurements** and **garment POMs**
separate. Do not renumber approved records or resolve RC-12/RC-13 and other source
questions through guessed mappings.

## Private terminology intake

| Candidate phrase | Source/reference | Context | House-preferred term | Method/diagram evidence | Decision | Permission |
|---|---|---|---|---|---|---|
| Term supplied for review | Private ID/version/location | Object, landmarks, path, state, units | Proposed term or keep distinct | Description/permitted reference | Pending/clarify/accept/reject; reviewer/date | Access/reuse/publication separately |

This is a review template, not an imported job record. The founder approves house
terms and methods. Past employer files, client details, values, artwork and diagrams
remain private unless the specific reuse/publication is authorized. Access alone
does not permit copying a source into public Git. Prefer original house descriptions
and newly created house diagrams. Keep source files and identifying review evidence
outside public Git; publish only approved house content authorized for publication.
Do not import past-job folders as public fixtures or screenshots.

## Version definitions independently of style values

Use stable category-specific IDs with versioned definitions and reviewed aliases.
Explain retired terms and replacements. A different measurement context may need
a separate ID; a material method change requires explicit version review.

Dimensional garment values use canonical CM with explicit CM/IN entry/display.
Retain entered units and source landmarks as provenance; display rounding must not
rewrite canonical values or an established method. Quantities, stitch density,
thread specifications, material weights and costs require their own units.

A style pins the definition version it uses and holds its own specs, observations
and deliberate overrides. Preview/review a library update before applying it to
existing styles, retaining a migration/change record. Earlier named snapshots stay
unchanged. Future released packs must pin their reviewed definitions and rules.
Definition review does not approve a style or sample. Current offline snapshots
are working revisions, not authenticated production releases.

## Pilot before expansion

1. Collect a few terms/permitted examples privately; complete context and permissions.
2. Have the founder review house terminology, methods and diagrams; leave uncertainty open.
3. Build a small versioned catalog with aliases and provenance, without historical values.
4. Select reviewed definitions into one new style; keep spec/wash/fit/grade stage values
   and their formulas separate while reusing the applicable definitions.
5. Test a real measurement and maker clarification; revise before expanding the catalog.

Preserve current house colors/assignments, Barlow Condensed, seal and artwork.
Material colors are product specifications and do not change the interface palette.
Structured fittings, BOM/construction modules and maker releases remain future work
in the [workroom roadmap](tech-pack-usability-review.md).
