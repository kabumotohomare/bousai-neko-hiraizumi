import UPNG from 'upng-js';
import { EXPORT_SIZE } from '../../domain/catalog';

export type ExportResult = {
  bytes: Uint8Array;
  format: 'png8' | 'png32';
  warning?: string;
};

export function fitContain(
  source: ImageData,
  size = EXPORT_SIZE,
  fill: [number, number, number, number] = [236, 232, 223, 255]
): ImageData {
  const out = new ImageData(size, size);
  for (let i = 0; i < out.data.length; i += 4) {
    out.data[i] = fill[0];
    out.data[i + 1] = fill[1];
    out.data[i + 2] = fill[2];
    out.data[i + 3] = fill[3];
  }
  const scale = Math.min(size / Math.max(1, source.width), size / Math.max(1, source.height));
  const w = Math.max(1, Math.round(source.width * scale));
  const h = Math.max(1, Math.round(source.height * scale));
  const ox = Math.floor((size - w) / 2);
  const oy = Math.floor((size - h) / 2);
  for (let y = 0; y < h; y += 1) {
    const sy = Math.min(source.height - 1, Math.floor(y / scale));
    for (let x = 0; x < w; x += 1) {
      const sx = Math.min(source.width - 1, Math.floor(x / scale));
      const si = (sy * source.width + sx) * 4;
      const di = ((oy + y) * size + (ox + x)) * 4;
      const a = source.data[si + 3] / 255;
      out.data[di] = Math.round(source.data[si] * a + fill[0] * (1 - a));
      out.data[di + 1] = Math.round(source.data[si + 1] * a + fill[1] * (1 - a));
      out.data[di + 2] = Math.round(source.data[si + 2] * a + fill[2] * (1 - a));
      out.data[di + 3] = 255;
    }
  }
  return out;
}

export async function encodePng32Async(image: ImageData): Promise<Uint8Array> {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('2D canvas を初期化できません');
  }
  ctx.putImageData(image, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) {
    throw new Error('PNG32 の生成に失敗しました');
  }
  return new Uint8Array(await blob.arrayBuffer());
}

export async function encodeTexturePng(image: ImageData): Promise<ExportResult> {
  const fitted = fitContain(image);
  try {
    const rgba = fitted.data.buffer.slice(
      fitted.data.byteOffset,
      fitted.data.byteOffset + fitted.data.byteLength
    );
    const encoded = UPNG.encode([rgba], fitted.width, fitted.height, 256);
    return { bytes: new Uint8Array(encoded), format: 'png8' };
  } catch (error) {
    const bytes = await encodePng32Async(fitted);
    return {
      bytes,
      format: 'png32',
      warning: `PNG8変換に失敗したためPNG32で出力しました: ${error instanceof Error ? error.message : 'unknown'}`
    };
  }
}
