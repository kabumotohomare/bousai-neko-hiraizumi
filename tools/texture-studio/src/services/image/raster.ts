export async function blobToImageData(blob: Blob, maxEdge = 1280): Promise<ImageData> {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('2D canvas を初期化できません');
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return ctx.getImageData(0, 0, width, height);
}

export function imageDataToPngBlob(image: ImageData): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return Promise.reject(new Error('2D canvas を初期化できません'));
  }
  ctx.putImageData(image, 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('PNG の生成に失敗しました'));
      }
    }, 'image/png');
  });
}

export function cloneImageData(image: ImageData): ImageData {
  const copy = new ImageData(image.width, image.height);
  copy.data.set(image.data);
  return copy;
}

export function cloneMask(mask: Uint8Array): Uint8Array {
  return mask.slice();
}
