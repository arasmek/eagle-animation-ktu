import { createCanvas, loadImage, registerFont } from 'canvas';

// Register Inter font from user-provided path
registerFont(
  'C:/Users/CiaAndriausPKompas/AppData/Local/Microsoft/Windows/Fonts/Inter-SemiBold.otf',
  { family: 'Inter' }
);

export async function createEndingFrame({
  name,
  width,
  height,
  color = '#fff',
}) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#234A7D';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top'; // easier vertical layout

  // Measure top offset
  let y = height / 3.5; // start roughly 1/3 from top

  // Line 1: "Animacijos autorius:"
  ctx.font = '48px Inter';
  ctx.fillText('Animacijos autorius:', width / 2, y);

  // GAP
  y += 70;

  // Line 2: Name (bigger font, +30px = 78px)
  ctx.font = '78px Inter';
  ctx.fillText(name, width / 2, y);

  // GAP
  y += 100;

  // Line 3: © YEAR
  const year = new Date().getFullYear();
  ctx.font = '42px Inter';
  ctx.fillText(`© ${year}`, width / 2, y);

  // Logo at bottom
  try {
    const logo = await loadImage('resources/IF_LT_Baltas.png');
    const logoWidth = Math.min(width * 0.25, logo.width);
    const logoHeight = (logoWidth / logo.width) * logo.height;
    const logoX = (width - logoWidth) / 2;
    const logoY = height - logoHeight - 32;
    ctx.drawImage(logo, logoX, logoY, logoWidth, logoHeight);
  } catch (e) {
    // logo missing — skip
  }

  return canvas.toBuffer('image/jpeg');
}
