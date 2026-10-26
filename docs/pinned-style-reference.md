# Pinned style reference — v0.7.1

The workroom keeps a reference image panel beside all six worksheet tabs. Front/back images sit above the Shared Style Record, Pattern Card details and piece lists, working-pack controls, and Named Revisions & Restore. The picture header stays in place while the information underneath scrolls independently.

## Use the panel

- **Hide style** in the bottom action bar hides the complete panel and gives the worksheet its full available width. **Show style** brings it back. This device remembers that view preference; hiding the panel never removes or changes pack values.
- The panel heading collapses or expands its information. On a phone, the collapsed heading retains a compact image pair and style summary above the selected worksheet. Tap the heading to edit the complete information, then collapse it to return to the worksheet. Save, Hide/Show style, Undo, Redo and Export remain available.
- **Shared style record** keeps the existing ten shared fields and garment unit. **Pattern card · details & pieces** contains the original Pattern Card metadata, image attachment and all 32 piece/lining/template/grading rows. **Named revisions & restore** keeps the existing snapshot, comparison and restoration workflow.
- The full-width Pattern Card tab remains available. Its fields and the pinned Pattern Card are synchronized views of the same saved values. Editing the sidebar while another worksheet is selected updates the Pattern Card rather than that worksheet. Autosave, undo, JSON transfers and revision restoration use the existing pack record.
- Tap an image to inspect its original proportions in the enlarged viewer. Close or Escape returns to the reference panel.

## Images and the example

New blank packs show the original front/back SR-FORM-001 mannequin photographs with **Example reference · SR-FORM-001** clearly stated. These are example reference images; they do not fill garment measurements or grant a garment approval.

If the working pack already contains front/back images in the Measurement Master's existing Front Flat/Back Flat attachment slots, those images appear in the pinned panel. Otherwise, a supplied Pattern Card reference image appears there. If neither exists, the mannequin example pair remains. With only one supplied reference, the panel displays that supplied image rather than mixing it with a different form's example photo. Changing/removing images, undoing, opening packs and restoring revisions refreshes this preview from the current pack.

The original image bytes are preserved. Sidebar frames display complete silhouettes, and original artwork colors are unchanged. Existing house interface colors and assignments, fonts, neutral borders, the seal, source methods, calculations and approved measurements remain unchanged.

## Saving, validation and printing

Panel visibility and expansion are view controls. They do not create edits or named revisions. Tab switches preserve the reference panel, its scroll/open state and unfinished named-revision text.

Invalid sidebar entries remain visible as errors and block saving/updating. If the panel is hidden or nested controls are collapsed, Save reveals the panel and opens the enclosing sections before focusing the invalid field. Attaching or removing an image refreshes only the attachment display; it preserves unrelated in-progress or invalid input.

Complete worksheet printing still uses the original source sections: 190 table rows across all six sheets, with no extra copies from the sidebar. Search, comparison columns and panel visibility do not remove data from the full printout or JSON.

The change keeps tech-pack schema 2 and the existing IndexedDB identity. Previous drafts, original image Blobs, named revisions and pack migration remain available. It introduces no account, synchronization or project upload.

## Update your installed iPhone app

Open the existing **SR Workroom** app while online, then choose **Export → Install & app info**. When the update is ready, choose **Save & update app**. The information screen should show **Workroom v0.7.1** after reopening. Continue using the same Home Screen app and its local records.

[Open the Workroom](https://kelse-alt.github.io/serpentis-regina-plm-core/workroom/).

## Verification

The v0.7.1 build passes 86 Node tests, 36 sidebar/viewport checks and 16 focused sidebar workflows, the existing 36 workroom layouts and 38 daily workflows, and 19 Chromium offline/update workflows. The focused checks include two-way Pattern Card editing, persistent pane state, hidden invalid-entry recovery, image refresh without losing invalid text, revision restore, JSON, and all 190 printed rows. See [validation evidence](validation/pinned-style-reference.json). Browser emulation does not verify physical iPhone Share-menu or native keyboard behavior.

[Desktop preview](previews/pinned-style-desktop.png) · [Phone preview](previews/pinned-style-mobile.png) · [Expanded phone details](previews/pinned-style-mobile-expanded.png) · [Hidden panel](previews/pinned-style-desktop-hidden.png).

The v0.7.1 update is published at the same Workroom URL. [Live verification](validation/pinned-style-live.json) confirms all eight HTTPS application files match the tested build and all existing portal files remain unchanged. [Pages deployment](https://github.com/kelse-alt/serpentis-regina-plm-core/actions/runs/40368417443) completed successfully.
