/// <reference types="vite/client" />

interface Window {
  showDirectoryPicker?: (options?: {
    mode?: 'read' | 'readwrite';
  }) => Promise<FileSystemDirectoryHandle>;
}

declare module 'upng-js' {
  export function encode(
    frames: ArrayBuffer[],
    width: number,
    height: number,
    cnum?: number,
    dels?: number[]
  ): ArrayBuffer;
}
