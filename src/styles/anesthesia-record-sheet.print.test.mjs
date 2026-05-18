import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

describe('anesthesia record print stylesheet', () => {
  it('does not hide the section card that is itself the print area', () => {
    const css = readFileSync(new URL('./anesthesia-record-sheet.css', import.meta.url), 'utf8');

    assert.match(css, /\.section-card:not\(\.print-area\):not\(:has\(\.print-area\)\)/);
    assert.doesNotMatch(css, /\.section-card:not\(:has\(\.print-area\)\)/);
  });

  it('uses real print grid line elements instead of print-only background grids', () => {
    const css = readFileSync(new URL('./anesthesia-record-sheet.css', import.meta.url), 'utf8');

    assert.match(css, /\.print-grid-lines/);
    assert.match(css, /\.print-row-lines/);
    assert.match(css, /\.print-chart-horizontal-lines/);
    assert.doesNotMatch(css, /@media print[\s\S]*repeating-linear-gradient/);
  });

  it('keeps the vital chart grid tied to the vital scale instead of generic row divisions', () => {
    const component = readFileSync(new URL('../views/anesthesia/AnesthesiaLiveSheet.vue', import.meta.url), 'utf8');

    assert.match(component, /printVitalGridLines/);
    assert.doesNotMatch(component, /`chart-h-\$\{line\.key\}`/);
  });

  it('aligns print labels and medication lines from row-based coordinates', () => {
    const css = readFileSync(new URL('./anesthesia-record-sheet.css', import.meta.url), 'utf8');
    const component = readFileSync(new URL('../views/anesthesia/AnesthesiaLiveSheet.vue', import.meta.url), 'utf8');

    assert.match(css, /grid-template-rows:\s*repeat\(var\(--print-rows,\s*1\),\s*minmax\(0,\s*1fr\)\)/);
    assert.match(css, /top:\s*calc\(\(var\(--row-index,\s*0\)\s*\+\s*0\.5\)\s*\*\s*100%\s*\/\s*var\(--row-count,\s*1\)\)/);
    assert.match(component, /printIndex:\s*index\s*\+\s*1/);
    assert.match(component, /markerStyle\(row\.time,\s*row\.index,\s*row\.rowCount,\s*row\.printIndex\)/);
    assert.match(component, /'--print-rows'/);
  });

  it('matches the reference print structure for upper bands and surgery status placement', () => {
    const css = readFileSync(new URL('./anesthesia-record-sheet.css', import.meta.url), 'utf8');
    const component = readFileSync(new URL('../views/anesthesia/AnesthesiaLiveSheet.vue', import.meta.url), 'utf8');

    assert.match(component, /printMedicationLabelRows/);
    assert.match(component, /printRowLines\(9\)/);
    assert.match(component, /print-surgery-status-row/);
    assert.match(component, /band-status band-output/);
    assert.match(css, /\.band-medication \.print-grid-lines,\s*\.band-infusion \.print-grid-lines,\s*\.band-transfusion \.print-grid-lines/);
    assert.match(css, /--print-sheet-left-width:\s*35mm/);
    assert.match(css, /\.sheet-time-ruler\s*\{[\s\S]*grid-template-columns:\s*var\(--print-sheet-left-width\) 1fr/);
    assert.match(css, /\.live-vital-chart\s*\{[\s\S]*grid-template-columns:\s*var\(--print-chart-legend-width\) calc\(var\(--print-sheet-left-width\) - var\(--print-chart-legend-width\)\) 1fr/);
    assert.match(css, /\.band-output\s*\{\s*grid-template-columns:\s*var\(--print-sheet-left-width\) 1fr/);
  });

  it('keeps screen time labels above ruler ticks instead of letting ticks cut text', () => {
    const css = readFileSync(new URL('./anesthesia-record-sheet.css', import.meta.url), 'utf8');

    assert.match(css, /\.sheet-time-area\s*\{[\s\S]*background:\s*#fff/);
    assert.match(css, /\.major-tick-label\s*\{[\s\S]*z-index:\s*4/);
    assert.match(css, /\.major-tick-label\s*\{[\s\S]*background:\s*#fff/);
    assert.match(css, /\.major-tick-label\s*\{[\s\S]*box-shadow:\s*0 0 0 2px #fff/);
    assert.match(css, /\.minor-tick\s*\{[\s\S]*top:\s*0;[\s\S]*height:\s*auto;[\s\S]*border-left:\s*1px solid #111/);
    assert.match(css, /@media print[\s\S]*\.sheet-time-area\s*\{[\s\S]*background:\s*none/);
  });

  it('emits numeric print row percentages so row lines render in print', () => {
    const component = readFileSync(new URL('../views/anesthesia/AnesthesiaLiveSheet.vue', import.meta.url), 'utf8');

    assert.match(component, /length:\s*count\s*\+\s*1/);
    assert.match(component, /percent:\s*\(index\s*\/\s*count\)\s*\*\s*100/);
    assert.doesNotMatch(component, /percent:\s*`\$\{\(index\s*\/\s*count\)\s*\*\s*100\}%`/);
    assert.match(component, /top:\s*line\.percent\s*\+\s*'%'/);
  });
});
