# Pattern reference gallery — v0.7.2

Pattern Card references now keep several sketches or photographs in one slot.
Adding another image preserves the current photo instead of replacing it.

## Use the gallery

1. Open **Pattern card → Drawings & photographic references** or the same
   section under the pinned **Pattern card · details & pieces**.
2. Under **Pattern reference / sketch**, use **Add photos**. Select several
   files together, or add more later. PNG, JPEG and WebP are accepted, up to
   5 MB each and 12 photographs across the complete pack.
3. Use **Previous / Next** or **Displayed photo** to choose the visible image.
   The pinned style panel also has Previous/Next controls, available across
   worksheets and when its details are collapsed on a phone.
4. Save. **Remove displayed photo** removes only that photo; Undo restores it.

The gallery shows one full image at a time without cropping its original
proportions. A gallery takes priority in the pinned preview, while Measurement
Master front/back attachments remain saved in their original worksheet slots.
Existing single-image packs retain their original preview behavior until another
photo is added. Without a gallery or single reference, the original Master or
clearly labelled house-example images remain available.

## Saving and updates

Local drafts, JSON backups, undo/redo and named revisions retain every gallery
image in its original bytes, order and selected position. Comparisons identify
gallery membership and selection changes. Print/PDF shows the selected photo;
JSON includes the whole gallery. Named revision history remains local and is
not included in the current-pack JSON.

Existing drafts and single-image imports still open. Gallery packs require
Workroom v0.7.2 or newer. The pack schema and IndexedDB identity remain at v2;
no working projects or uploaded artwork are included in the static app build.

Open the existing app online and choose **Export → Install & app info →
Save & update app** when an update is ready. Updates preserve the active draft
and wait for file operations and invalid entries to be resolved. Check the
information screen reports **Workroom v0.7.2**. Continue in the same browser or
installed app to use its existing local records.

## Validation

The focused model and browser checks cover multi-file append, one-image
display, saved selection, legacy images, Blob persistence and deduplication,
JSON transfers, undo/redo, revision restoration, failed batches, phone controls
and selected-image printing. Browser viewport checks do not establish native
iPhone picker or physical-device behavior.

Validation: 92 Node tests, [15 focused gallery checks](validation/reference-gallery.json),
[14 pinned-panel workflows](validation/reference-gallery-pinned-regression.json),
and the [Chromium offline/update suite](validation/reference-gallery-pwa.json) pass.
