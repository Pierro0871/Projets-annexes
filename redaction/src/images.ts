export interface LoadedImage {
  dataUrl: string;
  width: number;
  height: number;
}

/** Réduit une photo (max 1600 px) en JPEG pour garder la base légère. */
export async function loadAndResize(file: File, max = 1600): Promise<LoadedImage> {
  const src = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
  const img = await loadImage(src);
  const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return { dataUrl: canvas.toDataURL('image/jpeg', 0.85), width: w, height: h };
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image illisible'));
    img.src = src;
  });
}

export async function imageSize(src: string): Promise<{ width: number; height: number }> {
  const img = await loadImage(src);
  return { width: img.naturalWidth, height: img.naturalHeight };
}

export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const b64 = dataUrl.split(',')[1] ?? '';
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function dataUrlType(dataUrl: string): 'jpg' | 'png' | 'gif' | 'bmp' {
  const m = /^data:image\/(\w+)/.exec(dataUrl)?.[1] ?? 'jpeg';
  if (m === 'png') return 'png';
  if (m === 'gif') return 'gif';
  if (m === 'bmp') return 'bmp';
  return 'jpg';
}
