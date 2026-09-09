import { create } from 'zustand';
import {
  createEmptyOverlay,
  createEmptyProjectMeta,
  mergeGameAndOverlay,
  nextFaceId,
  overlayFromGameBuildings
} from '../domain/catalog';
import { PATHS } from '../domain/constants';
import {
  BlenderFacesFileSchema,
  GameBuilding,
  OverlayBuilding,
  OverlayCatalog,
  OverlayFace,
  ProjectMeta
} from '../domain/project';
import {
  loadBlenderFaces,
  loadGameSnapshot,
  loadOverlay,
  loadProjectMeta,
  parseGameBuildingsJson,
  saveBlenderFaces,
  saveGameSnapshot,
  saveOverlay,
  saveProjectMeta
} from '../services/catalog/io';
import { canUseDirectoryPicker, DirectoryFs, MemoryFs, ProjectFs } from '../services/fs/projectFs';
import { downloadBlob, exportFsToZip, importZipToMemory, sanitizeFileToken } from '../services/fs/zip';

export type StudioScreen = 'project' | 'map' | 'building' | 'pipeline' | 'export';

interface StudioState {
  screen: StudioScreen;
  error: string | null;
  fs: ProjectFs | null;
  fsKind: 'memory' | 'directory';
  meta: ProjectMeta | null;
  overlay: OverlayCatalog | null;
  gameBuildings: GameBuilding[];
  selectedBuildingId: string | null;
  selectedFaceId: string | null;
  dirty: boolean;
  setScreen: (screen: StudioScreen) => void;
  clearError: () => void;
  createProject: (name: string) => Promise<void>;
  openDirectory: () => Promise<void>;
  importZip: (file: File) => Promise<void>;
  importGameJson: (text: string) => Promise<void>;
  importBlenderFaces: (text: string) => Promise<void>;
  save: () => Promise<void>;
  downloadZip: () => Promise<void>;
  selectBuilding: (buildingId: string | null) => void;
  selectFace: (faceId: string | null) => void;
  setShootTarget: (buildingId: string, value: boolean) => void;
  setOsmId: (buildingId: string, osmId: string) => void;
  addFace: (buildingId: string) => void;
  attachPhoto: (buildingId: string, faceId: string, file: File) => Promise<void>;
  setReferenceImage: (file: File) => Promise<void>;
  patchFace: (buildingId: string, faceId: string, patch: Partial<OverlayFace>) => void;
  selectedBuilding: () => OverlayBuilding | null;
  selectedFace: () => OverlayFace | null;
}

async function persistAll(
  fs: ProjectFs,
  meta: ProjectMeta,
  overlay: OverlayCatalog,
  gameBuildings: GameBuilding[]
): Promise<void> {
  const nextMeta = { ...meta, updatedAt: new Date().toISOString() };
  await saveProjectMeta(fs, nextMeta);
  await saveOverlay(fs, overlay);
  await saveGameSnapshot(fs, gameBuildings);
}

export const useStudioStore = create<StudioState>((set, get) => ({
  screen: 'project',
  error: null,
  fs: null,
  fsKind: 'memory',
  meta: null,
  overlay: null,
  gameBuildings: [],
  selectedBuildingId: null,
  selectedFaceId: null,
  dirty: false,
  setScreen: (screen) => set({ screen }),
  clearError: () => set({ error: null }),
  selectedBuilding: (): OverlayBuilding | null => {
    const { overlay, selectedBuildingId } = get();
    if (!overlay || !selectedBuildingId) {
      return null;
    }
    return overlay.buildings.find((b) => b.building_id === selectedBuildingId) ?? null;
  },
  selectedFace: (): OverlayFace | null => {
    const building = get().selectedBuilding();
    const faceId = get().selectedFaceId;
    if (!building || !faceId) {
      return null;
    }
    return building.faces.find((f) => f.face_id === faceId) ?? null;
  },
  createProject: async (name) => {
    const fs = new MemoryFs();
    const meta = createEmptyProjectMeta(name.trim() || 'hiraizumi-textures');
    const overlay = createEmptyOverlay();
    await persistAll(fs, meta, overlay, []);
    set({
      fs,
      fsKind: 'memory',
      meta,
      overlay,
      gameBuildings: [],
      selectedBuildingId: null,
      selectedFaceId: null,
      dirty: false,
      error: null,
      screen: 'map'
    });
  },
  openDirectory: async () => {
    if (!canUseDirectoryPicker() || !window.showDirectoryPicker) {
      set({ error: 'このブラウザはフォルダ保存に未対応です。zip を使ってください。' });
      return;
    }
    try {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
      const fs = new DirectoryFs(handle);
      const meta = await loadProjectMeta(fs);
      if (!meta) {
        set({ error: 'project.json が見つかりません。先にプロジェクトを作成して zip 書き出しするか、空フォルダには新規作成してください。' });
        return;
      }
      const overlay = (await loadOverlay(fs)) ?? createEmptyOverlay();
      const gameBuildings = await loadGameSnapshot(fs);
      set({
        fs,
        fsKind: 'directory',
        meta,
        overlay,
        gameBuildings,
        dirty: false,
        error: null,
        screen: 'map'
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      set({ error: error instanceof Error ? error.message : 'フォルダを開けませんでした' });
    }
  },
  importZip: async (file) => {
    try {
      const fs = await importZipToMemory(file);
      const meta = await loadProjectMeta(fs);
      if (!meta) {
        set({ error: 'zip 内に project.json がありません' });
        return;
      }
      const overlay = (await loadOverlay(fs)) ?? createEmptyOverlay();
      const gameBuildings = await loadGameSnapshot(fs);
      set({
        fs,
        fsKind: 'memory',
        meta,
        overlay,
        gameBuildings,
        dirty: false,
        error: null,
        screen: 'map'
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'zip を読めませんでした' });
    }
  },
  importGameJson: async (text) => {
    const { fs, meta, overlay } = get();
    if (!fs || !meta) {
      set({ error: '先にプロジェクトを作成してください' });
      return;
    }
    try {
      const gameBuildings = parseGameBuildingsJson(text);
      const nextOverlay = overlay
        ? mergeGameAndOverlay(gameBuildings, overlay)
        : overlayFromGameBuildings(gameBuildings);
      await persistAll(fs, meta, nextOverlay, gameBuildings);
      set({ gameBuildings, overlay: nextOverlay, dirty: false, error: null, screen: 'map' });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'buildings.json の形式が不正です' });
    }
  },
  importBlenderFaces: async (text) => {
    const { fs, overlay } = get();
    if (!fs || !overlay) {
      set({ error: '先にプロジェクトを作成してください' });
      return;
    }
    try {
      const parsed = BlenderFacesFileSchema.parse(JSON.parse(text));
      const next = structuredClone(overlay);
      for (const face of parsed.faces) {
        let building = next.buildings.find((b) => b.building_id === face.building_id);
        if (!building) {
          building = {
            building_id: face.building_id,
            isShootTarget: true,
            pendingGameId: true,
            faces: []
          };
          next.buildings.push(building);
        }
        const existing = building.faces.find((f) => f.face_id === face.face_id);
        if (existing) {
          existing.blenderObjectName = face.objectName;
          if (face.uvAdjust) {
            existing.uvAdjust = face.uvAdjust;
          }
        } else {
          building.faces.push({
            face_id: face.face_id,
            blenderObjectName: face.objectName,
            status: 'unshot',
            uvAdjust: face.uvAdjust
          });
        }
      }
      await saveBlenderFaces(fs, parsed);
      await saveOverlay(fs, next);
      set({ overlay: next, dirty: false, error: null });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'faces.json を読めませんでした' });
    }
  },
  save: async () => {
    const { fs, meta, overlay, gameBuildings } = get();
    if (!fs || !meta || !overlay) {
      return;
    }
    await persistAll(fs, meta, overlay, gameBuildings);
    const blender = await loadBlenderFaces(fs);
    if (blender) {
      await saveBlenderFaces(fs, blender);
    }
    set({ dirty: false, meta: { ...meta, updatedAt: new Date().toISOString() } });
  },
  downloadZip: async () => {
    const { fs, meta } = get();
    if (!fs || !meta) {
      return;
    }
    await get().save();
    const blob = await exportFsToZip(fs);
    downloadBlob(blob, `${sanitizeFileToken(meta.name)}.zip`);
  },
  selectBuilding: (buildingId) =>
    set({ selectedBuildingId: buildingId, selectedFaceId: null, screen: buildingId ? 'building' : 'map' }),
  selectFace: (faceId) => set({ selectedFaceId: faceId }),
  setShootTarget: (buildingId, value) => {
    const overlay = get().overlay;
    if (!overlay) {
      return;
    }
    const next = {
      ...overlay,
      buildings: overlay.buildings.map((b) =>
        b.building_id === buildingId ? { ...b, isShootTarget: value } : b
      )
    };
    set({ overlay: next, dirty: true });
  },
  setOsmId: (buildingId, osmId) => {
    const overlay = get().overlay;
    if (!overlay) {
      return;
    }
    const next = {
      ...overlay,
      buildings: overlay.buildings.map((b) =>
        b.building_id === buildingId ? { ...b, osm_id: osmId || undefined } : b
      )
    };
    set({ overlay: next, dirty: true });
  },
  addFace: (buildingId) => {
    const overlay = get().overlay;
    if (!overlay) {
      return;
    }
    const next = {
      ...overlay,
      buildings: overlay.buildings.map((b) => {
        if (b.building_id !== buildingId) {
          return b;
        }
        const face_id = nextFaceId(b.faces);
        return {
          ...b,
          isShootTarget: true,
          faces: [...b.faces, { face_id, status: 'unshot' as const }]
        };
      })
    };
    const added = next.buildings.find((b) => b.building_id === buildingId);
    set({
      overlay: next,
      dirty: true,
      selectedFaceId: added?.faces.at(-1)?.face_id ?? null
    });
  },
  attachPhoto: async (buildingId, faceId, file) => {
    const { fs, overlay } = get();
    if (!fs || !overlay) {
      return;
    }
    const rel = `${PATHS.rawDir}/${sanitizeFileToken(buildingId)}_${sanitizeFileToken(faceId)}_${sanitizeFileToken(file.name)}`;
    await fs.writeBytes(rel, new Uint8Array(await file.arrayBuffer()));
    const next = {
      ...overlay,
      buildings: overlay.buildings.map((b) => {
        if (b.building_id !== buildingId) {
          return b;
        }
        return {
          ...b,
          isShootTarget: true,
          faces: b.faces.map((f) =>
            f.face_id === faceId ? { ...f, status: 'raw' as const, rawRelPath: rel } : f
          )
        };
      })
    };
    set({ overlay: next, dirty: true });
  },
  setReferenceImage: async (file) => {
    const { fs, meta } = get();
    if (!fs || !meta) {
      return;
    }
    const rel = `photos/reference/${sanitizeFileToken(file.name)}`;
    await fs.writeBytes(rel, new Uint8Array(await file.arrayBuffer()));
    set({ meta: { ...meta, referenceImageRelPath: rel, colorMatchScope: 'project' }, dirty: true });
  },
  patchFace: (buildingId, faceId, patch) => {
    const overlay = get().overlay;
    if (!overlay) {
      return;
    }
    const next = {
      ...overlay,
      buildings: overlay.buildings.map((b) => {
        if (b.building_id !== buildingId) {
          return b;
        }
        return {
          ...b,
          faces: b.faces.map((f) => (f.face_id === faceId ? { ...f, ...patch } : f))
        };
      })
    };
    set({ overlay: next, dirty: true });
  }
}));

