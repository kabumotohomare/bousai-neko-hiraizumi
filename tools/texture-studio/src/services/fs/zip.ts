import JSZip from 'jszip';
import { MemoryFs, normalizePath, ProjectFs } from './projectFs';

export async function exportFsToZip(fs: ProjectFs): Promise<Blob> {
  const zip = new JSZip();
  const paths = await fs.list();
  for (const path of paths) {
    const bytes = await fs.readBytes(path);
    if (bytes) {
      zip.file(path, bytes);
    }
  }
  return zip.generateAsync({ type: 'blob' });
}

export async function importZipToMemory(blob: Blob): Promise<MemoryFs> {
  const zip = await JSZip.loadAsync(blob);
  const fs = new MemoryFs();
  const entries: Record<string, Uint8Array> = {};
  for (const [name, file] of Object.entries(zip.files)) {
    if (file.dir) {
      continue;
    }
    const bytes = await file.async('uint8array');
    entries[normalizePath(name)] = bytes;
  }
  fs.hydrate(entries);
  return fs;
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function sanitizeFileToken(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80);
}
