import { createCanvas, loadImage, registerFont } from 'canvas';

// Register Inter font from user-provided path
registerFont('C:/Users/CiaAndriausPKompas/AppData/Local/Microsoft/Windows/Fonts/Inter-VariableFont_slnt,wght.ttf', { family: 'Inter' });

export async function createEndingFrame({ text, width, height, font = 'bold 48px Open Sans', color = '#ffff'}) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#234A7D';
  ctx.fillRect(0, 0, width, height);
  ctx.font = font;
  ctx.fillStyle = color; // White text
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, width / 2, height / 2);
  // Draw logo at bottom center
  try {
    const logo = await loadImage('resources/IF_LT_Baltas.png');
    const logoWidth = Math.min(width * 0.25, logo.width); // scale logo to max 25% of frame width
    const logoHeight = (logoWidth / logo.width) * logo.height;
    const logoX = (width - logoWidth) / 2;
    const logoY = height - logoHeight - 32; // 32px margin from bottom
    ctx.drawImage(logo, logoX, logoY, logoWidth, logoHeight);
  } catch (e) {
    // Logo not found or error loading, skip drawing logo
  }

  return canvas.toBuffer('image/jpeg');
}
