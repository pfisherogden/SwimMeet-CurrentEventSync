import QRCode from 'qrcode';
import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Generates a QR code with a logo in the center.
 * @param {string} text - The data to encode in the QR code.
 * @param {string} outputPath - Where to save the final image.
 * @param {string} logoPath - Optional path to a logo image.
 */
export async function createBrandedQR(text, outputPath, logoPath) {
  const size = 1000;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  console.log('Generating QR code...');
  await QRCode.toCanvas(canvas, text, {
    errorCorrectionLevel: 'H', // High error correction to allow logo overlay
    margin: 2,
    width: size,
    color: {
      dark: '#000000',
      light: '#ffffff'
    }
  });

  // Use provided logo or default to repo logo
  const finalLogoPath = logoPath || path.join(process.cwd(), 'docs', 'logo.png');

  if (fs.existsSync(finalLogoPath)) {
    console.log('Embedding logo:', finalLogoPath);
    try {
      const logo = await loadImage(finalLogoPath);
      const logoSize = size * 0.22; // 22% of QR size is safe for 'H' correction
      const x = (size - logoSize) / 2;
      const y = (size - logoSize) / 2;

      // Draw white background behind logo
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      const padding = 10;
      // Using roundRect if available, fallback to rect
      if (ctx.roundRect) {
        ctx.roundRect(x - padding, y - padding, logoSize + (padding * 2), logoSize + (padding * 2), 20);
      } else {
        ctx.rect(x - padding, y - padding, logoSize + (padding * 2), logoSize + (padding * 2));
      }
      ctx.fill();

      // Draw logo
      ctx.drawImage(logo, x, y, logoSize, logoSize);
    } catch (e) {
      console.warn('⚠️ Could not load logo image. Generating plain QR code instead.', e.message);
    }
  } else {
    console.warn('⚠️ Logo not found at', finalLogoPath, '. Generating plain QR code.');
  }

  const out = fs.createWriteStream(outputPath);
  const stream = canvas.createPNGStream();
  stream.pipe(out);

  return new Promise((resolve, reject) => {
    out.on('finish', () => {
      console.log('✅ Branded QR Code saved to:', outputPath);
      resolve();
    });
    out.on('error', reject);
  });
}

// Allow running standalone
const isMain = process.argv[1] && (process.argv[1] === fileURLToPath(import.meta.url) || process.argv[1].endsWith('generate-qr.js'));
if (isMain) {
  const text = process.argv[2] || 'https://github.com/pfisherogden/SwimMeet-CurrentEventSync';
  const output = process.argv[3] || 'meet-qr.png';
  createBrandedQR(text, output).catch(console.error);
}
