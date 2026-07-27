const sharp = require("sharp");
const path = require("path");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#b8ff3a"/>
      <stop offset="100%" stop-color="#7ed321"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="14" fill="#17231e"/>
  <rect x="14" y="16" width="6" height="32" rx="3" fill="url(#g)"/>
  <rect x="29" y="16" width="6" height="32" rx="3" fill="url(#g)"/>
  <rect x="44" y="16" width="6" height="32" rx="3" fill="url(#g)"/>
</svg>`;

const publicDir = path.join(__dirname, "..", "public");

const sizes = [16, 32, 48, 64, 128, 256];

async function main() {
  for (const size of sizes) {
    await sharp(Buffer.from(svg))
      .resize(size, size)
      .png()
      .toFile(path.join(publicDir, `favicon-${size}x${size}.png`));
    console.log(`Generated favicon-${size}x${size}.png`);
  }

  // Also generate the standard favicon.ico (32x32)
  await sharp(Buffer.from(svg))
    .resize(32, 32)
    .png()
    .toFile(path.join(publicDir, "favicon.png"));
  console.log("Generated favicon.png");
}

main().catch(console.error);