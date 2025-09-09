import { createCanvas, loadImage } from 'canvas';

export async function createEndingFrame({ text, width, height, font = 'bold 48px Open Sans', color = '#fff', bgColor = '#222' }) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, width, height);
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, width / 2, height / 2);
  return canvas.toBuffer('image/jpeg');
}
