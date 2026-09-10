import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

async function generateScreenshots() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });

  const htmlContent = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <title>Prediction Distribution QA</title>
    <link rel="stylesheet" href="./dist/rtichoke-viz.css">
    <script type="module">
      import { renderPredictionDistribution } from './dist/rtichoke-viz.js';

      const singleSpec = JSON.parse(fs.readFileSync('./fixtures/v2/prediction-distribution-single.json', 'utf8'));
      const multiSpec = JSON.parse(fs.readFileSync('./fixtures/v2/prediction-distribution-multi.json', 'utf8'));

      window.renderPD = function(spec, options, containerId) {
        const el = document.getElementById(containerId);
        el.replaceChildren(renderPredictionDistribution(spec, options));
      };
      window.singleSpec = singleSpec;
      window.multiSpec = multiSpec;
    </script>
  </head>
  <body style="background: #f9fafb; padding: 20px; font-family: sans-serif;">
    <div id="app"></div>
  </body>
  </html>
  `;

  // Serve demo site via local server or static html evaluation
  // Let's use Playwright with static HTML injection
  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>${fs.readFileSync('./dist/rtichoke-viz.css', 'utf8')}</style>
    </head>
    <body style="background: #f9fafb; padding: 20px; font-family: sans-serif;">
      <div id="container"></div>
    </body>
    </html>
  `);

  await page.addScriptTag({ path: './dist/rtichoke-viz.js', type: 'module' });

  const singleSpec = JSON.parse(fs.readFileSync('./fixtures/v2/prediction-distribution-single.json', 'utf8'));
  const multiSpec = JSON.parse(fs.readFileSync('./fixtures/v2/prediction-distribution-multi.json', 'utf8'));

  // Helper to render spec
  const render = async (spec, dim = 'ppcr', val = 0.5, cond = 'all_observations', display = 'stacked', color = 'confusion_matrix_cell') => {
    await page.evaluate(({ spec, dim, val, cond, display, color }) => {
      const container = document.getElementById('container');
      const pdSpec = JSON.parse(JSON.stringify(spec));
      pdSpec.operatingPoint = { dimension: dim };
      const el = window.rtichokeViz.renderPredictionDistribution(pdSpec);
      container.replaceChildren(el);

      // Set state via UI inputs
      if (dim) {
        const dimRadios = el.querySelectorAll('input[name^="pd-dim-"]');
        for (const r of dimRadios) {
          if (r.value === dim) { r.checked = true; r.dispatchEvent(new Event('change')); }
        }
      }
      if (display) {
        const dispRadios = el.querySelectorAll('input[name^="pd-display-"]');
        for (const r of dispRadios) {
          if (r.value === display) { r.checked = true; r.dispatchEvent(new Event('change')); }
        }
      }
      if (color) {
        const colRadios = el.querySelectorAll('input[name^="pd-color-"]');
        for (const r of colRadios) {
          if (r.value === color) { r.checked = true; r.dispatchEvent(new Event('change')); }
        }
      }
      if (cond) {
        const condRadios = el.querySelectorAll('input[name^="pd-cond-"]');
        for (const r of condRadios) {
          if (r.value === cond) { r.checked = true; r.dispatchEvent(new Event('change')); }
        }
      }
      if (val !== undefined) {
        const slider = el.querySelector('.rtichoke-operating-point-slider');
        if (slider) {
          slider.value = String(Math.round(val * 100));
          slider.dispatchEvent(new Event('input'));
        }
      }
    }, { spec, dim, val, cond, display, color });
  };

  // 1. Stacked PPCR at PPCR = 0.20
  await render(singleSpec, 'ppcr', 0.20, 'all_observations', 'stacked', 'confusion_matrix_cell');
  await page.screenshot({ path: 'qa_stacked_ppcr_020.png', fullPage: true });

  // 2. Stacked PPCR at PPCR = 0.50
  await render(singleSpec, 'ppcr', 0.50, 'all_observations', 'stacked', 'confusion_matrix_cell');
  await page.screenshot({ path: 'qa_stacked_ppcr_050.png', fullPage: true });

  // 3. Stacked PPCR at PPCR = 0.80
  await render(singleSpec, 'ppcr', 0.80, 'all_observations', 'stacked', 'confusion_matrix_cell');
  await page.screenshot({ path: 'qa_stacked_ppcr_080.png', fullPage: true });

  // 4. Mirrored PPCR at PPCR = 0.20
  await render(singleSpec, 'ppcr', 0.20, 'all_observations', 'mirrored', 'confusion_matrix_cell');
  await page.screenshot({ path: 'qa_mirrored_ppcr_020.png', fullPage: true });

  // 5. Mirrored PPCR at PPCR = 0.50
  await render(singleSpec, 'ppcr', 0.50, 'all_observations', 'mirrored', 'confusion_matrix_cell');
  await page.screenshot({ path: 'qa_mirrored_ppcr_050.png', fullPage: true });

  // 6. Mirrored PPCR at PPCR = 0.80
  await render(singleSpec, 'ppcr', 0.80, 'all_observations', 'mirrored', 'confusion_matrix_cell');
  await page.screenshot({ path: 'qa_mirrored_ppcr_080.png', fullPage: true });

  // 7. Observed Outcome coloring
  await render(singleSpec, 'ppcr', 0.50, 'all_observations', 'stacked', 'observed_outcome');
  await page.screenshot({ path: 'qa_ppcr_observed_outcome.png', fullPage: true });

  // 8. Confusion Matrix Cell coloring
  await render(singleSpec, 'ppcr', 0.50, 'all_observations', 'stacked', 'confusion_matrix_cell');
  await page.screenshot({ path: 'qa_ppcr_cm_cell.png', fullPage: true });

  // 9. Predicted Positives conditioning
  await render(singleSpec, 'ppcr', 0.50, 'predicted_positives', 'stacked', 'confusion_matrix_cell');
  await page.screenshot({ path: 'qa_ppcr_cond_pred_pos.png', fullPage: true });

  await browser.close();
  console.log('Successfully generated QA screenshots!');
}

generateScreenshots().catch(console.error);
