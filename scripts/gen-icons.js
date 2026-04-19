/**
 * scripts/gen-icons.js
 * Rasterizes the master SVG icon into the PNG sizes a PWA needs.
 * Run with: `node scripts/gen-icons.js`
 */
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..', 'public', 'icons');
const SRC = path.join(ROOT, 'icon.svg');
const SRC_MASK = path.join(ROOT, 'icon-maskable.svg');

async function render(svgPath, outName, size) {
  const buf = await sharp(svgPath, { density: 384 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toBuffer();
  fs.writeFileSync(path.join(ROOT, outName), buf);
  // eslint-disable-next-line no-console
  console.log(`wrote ${outName} (${buf.length} bytes)`);
}

async function main() {
  await render(SRC, 'icon-192.png', 192);
  await render(SRC, 'icon-512.png', 512);
  await render(SRC, 'apple-touch-icon.png', 180);
  await render(SRC, 'favicon-32.png', 32);
  await render(SRC_MASK, 'icon-maskable-512.png', 512);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
