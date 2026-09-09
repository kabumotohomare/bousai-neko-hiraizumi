function idx(x: number, y: number, width: number): number {
  return (y * width + x) * 4;
}

function colorDist(data: Uint8ClampedArray, i: number, mean: [number, number, number]): number {
  const dr = data[i] - mean[0];
  const dg = data[i + 1] - mean[1];
  const db = data[i + 2] - mean[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

export function estimateBuildingMask(image: ImageData): Uint8Array {
  const { width, height, data } = image;
  const x0 = Math.floor(width * 0.2);
  const x1 = Math.floor(width * 0.8);
  const y0 = Math.floor(height * 0.15);
  const y1 = Math.floor(height * 0.85);
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let y = y0; y < y1; y += 2) {
    for (let x = x0; x < x1; x += 2) {
      const i = idx(x, y, width);
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      n += 1;
    }
  }
  const mean: [number, number, number] = n ? [r / n, g / n, b / n] : [128, 128, 128];
  const distances: number[] = [];
  for (let y = y0; y < y1; y += 4) {
    for (let x = x0; x < x1; x += 4) {
      distances.push(colorDist(data, idx(x, y, width), mean));
    }
  }
  distances.sort((a, b) => a - b);
  const threshold = (distances[Math.floor(distances.length * 0.65)] ?? 40) * 1.35;

  const mask = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const on = colorDist(data, idx(x, y, width), mean) <= threshold ? 1 : 0;
      mask[y * width + x] = on;
    }
  }

  dilate(mask, width, height, 2);
  erode(mask, width, height, 2);
  return keepLargestComponent(mask, width, height, Math.floor(width / 2), Math.floor(height / 2));
}

function dilate(mask: Uint8Array, width: number, height: number, radius: number): void {
  const copy = mask.slice();
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (copy[y * width + x]) {
        continue;
      }
      let found = false;
      for (let dy = -radius; dy <= radius && !found; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < width && ny < height && copy[ny * width + nx]) {
            found = true;
            break;
          }
        }
      }
      if (found) {
        mask[y * width + x] = 1;
      }
    }
  }
}

function erode(mask: Uint8Array, width: number, height: number, radius: number): void {
  const copy = mask.slice();
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!copy[y * width + x]) {
        continue;
      }
      let ok = true;
      for (let dy = -radius; dy <= radius && ok; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height || !copy[ny * width + nx]) {
            ok = false;
            break;
          }
        }
      }
      if (!ok) {
        mask[y * width + x] = 0;
      }
    }
  }
}

function keepLargestComponent(
  mask: Uint8Array,
  width: number,
  height: number,
  seedX: number,
  seedY: number
): Uint8Array {
  const labels = new Int32Array(width * height);
  const sizes = new Map<number, number>();
  let label = 0;
  const stack: number[] = [];
  for (let i = 0; i < mask.length; i += 1) {
    if (!mask[i] || labels[i]) {
      continue;
    }
    label += 1;
    let size = 0;
    stack.push(i);
    labels[i] = label;
    while (stack.length) {
      const cur = stack.pop()!;
      size += 1;
      const x = cur % width;
      const y = Math.floor(cur / width);
      const neighbors = [cur - 1, cur + 1, cur - width, cur + width];
      for (const n of neighbors) {
        if (n < 0 || n >= mask.length || !mask[n] || labels[n]) {
          continue;
        }
        const nx = n % width;
        const ny = Math.floor(n / width);
        if (Math.abs(nx - x) + Math.abs(ny - y) !== 1) {
          continue;
        }
        labels[n] = label;
        stack.push(n);
      }
    }
    sizes.set(label, size);
  }

  const seedIndex = seedY * width + seedX;
  let chosen = labels[seedIndex];
  if (!chosen) {
    let best = 0;
    let bestSize = 0;
    for (const [id, size] of sizes) {
      if (size > bestSize) {
        best = id;
        bestSize = size;
      }
    }
    chosen = best;
  }

  const out = new Uint8Array(mask.length);
  if (!chosen) {
    return out;
  }
  for (let i = 0; i < labels.length; i += 1) {
    out[i] = labels[i] === chosen ? 1 : 0;
  }
  return out;
}

export function paintMaskBrush(
  mask: Uint8Array,
  width: number,
  height: number,
  cx: number,
  cy: number,
  radius: number,
  add: boolean
): void {
  const r2 = radius * radius;
  const value = add ? 1 : 0;
  const x0 = Math.max(0, Math.floor(cx - radius));
  const x1 = Math.min(width - 1, Math.ceil(cx + radius));
  const y0 = Math.max(0, Math.floor(cy - radius));
  const y1 = Math.min(height - 1, Math.ceil(cy + radius));
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) {
        mask[y * width + x] = value;
      }
    }
  }
}

export function applyMaskToImage(image: ImageData, mask: Uint8Array): ImageData {
  const out = new ImageData(image.width, image.height);
  out.data.set(image.data);
  for (let i = 0; i < mask.length; i += 1) {
    if (!mask[i]) {
      const p = i * 4;
      out.data[p + 3] = 0;
    }
  }
  return out;
}

export function maskBBox(
  mask: Uint8Array,
  width: number,
  height: number
): { x: number; y: number; w: number; h: number } | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!mask[y * width + x]) {
        continue;
      }
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < minX) {
    return null;
  }
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}
