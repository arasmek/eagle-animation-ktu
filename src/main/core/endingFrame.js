import { createCanvas, loadImage, registerFont } from 'canvas';
import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

// Register KTU Sans font from packaged or local resources if available
(() => {
  const resourcesBase = app?.isPackaged ? process.resourcesPath : path.join(process.cwd(), 'resources');
  const candidates = [
    path.join(resourcesBase, 'fonts', 'KTU-Sans.otf'),
    path.join(resourcesBase, 'KTU-Sans.otf'),
    path.join(process.cwd(), 'resources', 'fonts', 'KTU-Sans.otf'),
    path.join(process.cwd(), 'KTU-Sans.otf'),
  ];
  const fontPath = candidates.find((p) => {
    try {
      return fs.existsSync(p);
    } catch (e) {
      return false;
    }
  });
  if (fontPath) {
    registerFont(fontPath, { family: 'KTU Sans' });
  }
})();

export async function createEndingFrame({ text, width, height, color = '#fff' }) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background from branded card, fallback to solid color on failure
  try {
    const resourcesBase = app?.isPackaged ? process.resourcesPath : path.join(process.cwd(), 'resources');
    const backgroundPath = path.join(resourcesBase, 'NameCard.png');
    const background = await loadImage(backgroundPath);
    ctx.drawImage(background, 0, 0, width, height);
  } catch (e) {
    ctx.fillStyle = '#234A7D';
    ctx.fillRect(0, 0, width, height);
  }

  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top'; // easier vertical layout

  // Measure top offset
  //let y = height / 3.5; // start roughly 1/3 from top

  // Line 1: "Animacijos autorius:"
  //ctx.font = '48px Inter';
  //ctx.fillText('Animacijos autorius:', width / 2, y);

  // Line 2: Name (bigger font, +30px = 78px)
  ctx.font = 'bold 104px "KTU Sans"';
  const nameX = 105;
  const nameY = 525;
  ctx.fillText(text, nameX, nameY);

  // GAP
  const yearY = nameY + 370;

  // Line 3: © YEAR
  const year = new Date().getFullYear();
  ctx.font = 'bold 49px "KTU Sans"';
  ctx.fillText(`© ${year}`, nameX, yearY);
/*
  // Logo at bottom
  try {
    const resourcesBase = app?.isPackaged ? process.resourcesPath : path.join(process.cwd(), 'resources');
    const logoPath = path.join(resourcesBase, 'IF_LT_Baltas.png');
    const logo = await loadImage(logoPath);
    const logoWidth = Math.min(width * 0.25, logo.width);
    const logoHeight = (logoWidth / logo.width) * logo.height;
    const logoX = (width - logoWidth) / 2;
    const logoY = height - logoHeight - 32;
    ctx.drawImage(logo, logoX, logoY, logoWidth, logoHeight);
  } catch (e) {
     logo missing — skip
  }
  */

  return canvas.toBuffer('image/jpeg');
}
