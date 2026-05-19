# Live Print Sheet Design

## Goal

Adjust only the printed live anesthesia record sheet so it resembles the provided paper reference. The ordinary live editing screen, archive preview, data model, and interaction behavior stay unchanged.

## Scope

- Target: `src/views/anesthesia/AnesthesiaLiveSheet.vue` and print-specific CSS in `src/styles/anesthesia-record-sheet.css`.
- Non-targets: patient workbench, archive preview, right-side quality panel, editors, context menus, business rules, and stored data shape.
- Print orientation: portrait A4, using a dense hospital record layout.

## Design

The live sheet gets print-only blocks:

- A hospital title/header with number, page, grade mark, department/ward/bed/admission/date/payment metadata.
- Patient and operation rows matching the reference's ruled-line style.
- A bottom print section with large ruled boxes for induction medication, auxiliary/special medication, key operations, postoperative analgesia, and a compact summary/signature table.

The existing timeline grid remains the center of the print page, but print CSS restyles it to be denser and closer to the reference:

- Hide interactive toolbar, browser scroll framing, action buttons, live tips, context menus, and editing dialogs.
- Use black grid lines, serif Chinese print fonts, smaller row heights, and stable left columns.
- Hide duplicate bottom time ruler and interactive time buttons in print.

## Data Mapping

- Header uses existing patient fields plus record anesthesia/recovery/signature fields.
- Bottom text uses existing medication, high-alert medication, key event, recovery, fluid balance, outputs, and staff fields.
- Missing values display as blanks or short fallback text.

## Verification

- Run `npm.cmd test`.
- Run `npm.cmd run build`.
- Start local Vite and visually verify the live print DOM/print media in browser tooling.
