# Live Print Sheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make only the live anesthesia record's printed output match the provided paper reference more closely.

**Architecture:** Add print-only template sections inside `AnesthesiaLiveSheet.vue`, backed by small computed summaries from existing record data. Use `@media print` in `anesthesia-record-sheet.css` to switch to portrait A4 and hide normal interactive UI without changing the live screen.

**Tech Stack:** Vue 3 single-file components, Vite, CSS print media, Node native test runner.

---

### Task 1: Add Print-Only Paper Sections

**Files:**
- Modify: `src/views/anesthesia/AnesthesiaLiveSheet.vue`

- [ ] **Step 1: Add print header before the live sheet header**

Insert a `.print-sheet-title` block and `.print-patient-ruled` block inside `.live-paper-card.print-area`, before `.live-sheet-header`. Bind fields from `patient` and `record`.

- [ ] **Step 2: Add print footer after the live sheet board**

Insert `.print-bottom-panel` after `.live-sheet-scroll`. Fill it from computed summaries: medication notes, high alert notes, key operations, recovery text, fluid totals, outputs, staff names, and timeline times.

- [ ] **Step 3: Add small computed helpers**

Add computed values in the script section for printed ASA text, preoperative fasting text, operation position fallback, identity number fallback, first output row, and formatted handover text.

### Task 2: Print CSS

**Files:**
- Modify: `src/styles/anesthesia-record-sheet.css`

- [ ] **Step 1: Add default hidden print-only classes**

Add `.print-sheet-title`, `.print-patient-ruled`, and `.print-bottom-panel` as hidden outside print.

- [ ] **Step 2: Update print media**

Change `@page` to portrait A4, show print-only sections, hide the normal live header/time buttons/bottom ruler, and make live grid rows denser with black ruled lines.

- [ ] **Step 3: Keep screen UI unchanged**

Ensure all new print-only blocks are `display: none` outside print and existing screen selectors retain their current behavior.

### Task 3: Verify

**Files:**
- Test: existing `src/views/anesthesia/anesthesiaRecordHelpers.test.mjs`

- [ ] **Step 1: Run tests**

Run: `npm.cmd test`
Expected: all 13 tests pass.

- [ ] **Step 2: Run production build**

Run: `npm.cmd run build`
Expected: Vite build completes successfully.

- [ ] **Step 3: Browser verification**

Start Vite locally, open the live tab, emulate print CSS or inspect print-only DOM, and check that normal screen UI remains unchanged while print-only paper sections exist.
