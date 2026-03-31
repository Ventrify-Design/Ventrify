import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox']
});

const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
await page.goto('http://localhost:3000/decks/ventrify-investor-overview.html', {
  waitUntil: 'networkidle0',
  timeout: 30000
});

// Wait for fonts to load
await page.evaluate(() => document.fonts.ready);
await new Promise(r => setTimeout(r, 2000));

const outputPath = path.join(__dirname, 'decks', 'Ventrify-Investor-Overview.pdf');

await page.pdf({
  path: outputPath,
  width: '1280px',
  height: '720px',
  printBackground: true,
  preferCSSPageSize: false,
  margin: { top: 0, right: 0, bottom: 0, left: 0 }
});

console.log(`PDF saved to: ${outputPath}`);
await browser.close();
