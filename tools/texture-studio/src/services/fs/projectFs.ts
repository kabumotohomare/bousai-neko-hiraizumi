export function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export interface ProjectFs {
  readText(path: string): Promise<string | null>;
  writeText(path: string, text: string): Promise<void>;
  readBytes(path: string): Promise<Uint8Array | null>;
  writeBytes(path: string, bytes: Uint8Array): Promise<void>;
  list(prefix?: string): Promise<string[]>;
}

export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+/, '');
}

export class MemoryFs implements ProjectFs {
  private readonly files = new Map<string, Uint8Array>();

  async readText(path: string): Promise<string | null> {
    const bytes = await this.readBytes(path);
    if (!bytes) {
      return null;
    }
    return new TextDecoder().decode(bytes);
  }

  async writeText(path: string, text: string): Promise<void> {
    await this.writeBytes(path, new TextEncoder().encode(text));
  }

  async readBytes(path: string): Promise<Uint8Array | null> {
    return this.files.get(normalizePath(path)) ?? null;
  }

  async writeBytes(path: string, bytes: Uint8Array): Promise<void> {
    this.files.set(normalizePath(path), bytes);
  }

  async list(prefix = ''): Promise<string[]> {
    const head = normalizePath(prefix);
    return [...this.files.keys()].filter((key) => (head ? key.startsWith(head) : true)).sort();
  }

  hydrate(entries: Record<string, Uint8Array>): void {
    this.files.clear();
    for (const [path, bytes] of Object.entries(entries)) {
      this.files.set(normalizePath(path), bytes);
    }
  }

  snapshot(): Record<string, Uint8Array> {
    return Object.fromEntries(this.files.entries());
  }
}

async function getDirectory(
  root: FileSystemDirectoryHandle,
  path: string,
  create: boolean
): Promise<FileSystemDirectoryHandle> {
  const parts = normalizePath(path).split('/').filter(Boolean);
  let dir = root;
  for (const part of parts) {
    dir = await dir.getDirectoryHandle(part, { create });
  }
  return dir;
}

export class DirectoryFs implements ProjectFs {
  constructor(private readonly root: FileSystemDirectoryHandle) {}

  async readText(path: string): Promise<string | null> {
    const bytes = await this.readBytes(path);
    if (!bytes) {
      return null;
    }
    return new TextDecoder().decode(bytes);
  }

  async writeText(path: string, text: string): Promise<void> {
    await this.writeBytes(path, new TextEncoder().encode(text));
  }

  async readBytes(path: string): Promise<Uint8Array | null> {
    const normalized = normalizePath(path);
    const slash = normalized.lastIndexOf('/');
    const dirPath = slash >= 0 ? normalized.slice(0, slash) : '';
    const name = slash >= 0 ? normalized.slice(slash + 1) : normalized;
    try {
      const dir = dirPath ? await getDirectory(this.root, dirPath, false) : this.root;
      const handle = await dir.getFileHandle(name);
      const file = await handle.getFile();
      return new Uint8Array(await file.arrayBuffer());
    } catch {
      return null;
    }
  }

  async writeBytes(path: string, bytes: Uint8Array): Promise<void> {
    const normalized = normalizePath(path);
    const slash = normalized.lastIndexOf('/');
    const dirPath = slash >= 0 ? normalized.slice(0, slash) : '';
    const name = slash >= 0 ? normalized.slice(slash + 1) : normalized;
    const dir = dirPath ? await getDirectory(this.root, dirPath, true) : this.root;
    const handle = await dir.getFileHandle(name, { create: true });
    const writable = await handle.createWritable();
    await writable.write(toArrayBuffer(bytes));
    await writable.close();
  }

  async list(prefix = ''): Promise<string[]> {
    const out: string[] = [];
    await walk(this.root, '', out);
    const head = normalizePath(prefix);
    return out.filter((key) => (head ? key.startsWith(head) : true)).sort();
  }
}

async function walk(
  dir: FileSystemDirectoryHandle,
  prefix: string,
  out: string[]
): Promise<void> {
  for await (const [name, handle] of dir.entries()) {
    const path = prefix ? `${prefix}/${name}` : name;
    if (handle.kind === 'file') {
      out.push(path);
    } else {
      await walk(handle as FileSystemDirectoryHandle, path, out);
    }
  }
}

export function canUseDirectoryPicker(): boolean {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';
}
