import { beforeAll, describe, expect, it } from 'vitest';
import { estimateBuildingMask } from './mask';

beforeAll(() => {
  if (typeof ImageData === 'undefined') {
    class ImageDataStub {
      readonly width: number;
      readonly height: number;
      readonly data: Uint8ClampedArray;
      constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        this.data = new Uint8ClampedArray(width * height * 4);
      }
    }
    Object.assign(globalThis, { ImageData: ImageDataStub });
  }
});

describe('estimateBuildingMask', () => {
  it('keeps the large center region', () => {
    const width = 40;
    const height = 40;
    const image = new ImageData(width, height);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = (y * width + x) * 4;
        const center = x > 8 && x < 32 && y > 8 && y < 32;
        image.data[i] = center ? 180 : 20;
        image.data[i + 1] = center ? 80 : 20;
        image.data[i + 2] = center ? 70 : 200;
        image.data[i + 3] = 255;
      }
    }
    const mask = estimateBuildingMask(image);
    const on = mask.reduce((sum, v) => sum + v, 0);
    expect(on).toBeGreaterThan(100);
    expect(mask[20 * width + 20]).toBe(1);
  });
});
