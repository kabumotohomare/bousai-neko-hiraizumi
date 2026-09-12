import {
  BlenderFacesFile,
  BlenderFacesFileSchema,
  GameBuilding,
  GameBuildingsSchema,
  OverlayCatalog,
  OverlayCatalogSchema,
  ProjectMeta,
  ProjectMetaSchema
} from '../../domain/project';
import { PATHS } from '../../domain/constants';
import { ProjectFs } from '../fs/projectFs';

export async function loadProjectMeta(fs: ProjectFs): Promise<ProjectMeta | null> {
  const text = await fs.readText(PATHS.project);
  if (!text) {
    return null;
  }
  return ProjectMetaSchema.parse(JSON.parse(text));
}

export async function saveProjectMeta(fs: ProjectFs, meta: ProjectMeta): Promise<void> {
  await fs.writeText(PATHS.project, JSON.stringify(meta, null, 2));
}

export async function loadOverlay(fs: ProjectFs): Promise<OverlayCatalog | null> {
  const text = await fs.readText(PATHS.overlay);
  if (!text) {
    return null;
  }
  return OverlayCatalogSchema.parse(JSON.parse(text));
}

export async function saveOverlay(fs: ProjectFs, overlay: OverlayCatalog): Promise<void> {
  await fs.writeText(PATHS.overlay, JSON.stringify(overlay, null, 2));
}

export async function loadGameSnapshot(fs: ProjectFs): Promise<GameBuilding[]> {
  const text = await fs.readText(PATHS.gameSnapshot);
  if (!text) {
    return [];
  }
  return GameBuildingsSchema.parse(JSON.parse(text));
}

export async function saveGameSnapshot(fs: ProjectFs, buildings: GameBuilding[]): Promise<void> {
  await fs.writeText(PATHS.gameSnapshot, JSON.stringify(buildings, null, 2));
}

export function parseGameBuildingsJson(text: string): GameBuilding[] {
  return GameBuildingsSchema.parse(JSON.parse(text));
}

export async function loadBlenderFaces(fs: ProjectFs): Promise<BlenderFacesFile | null> {
  const text = await fs.readText(PATHS.blenderFaces);
  if (!text) {
    return null;
  }
  return BlenderFacesFileSchema.parse(JSON.parse(text));
}

export async function saveBlenderFaces(fs: ProjectFs, data: BlenderFacesFile): Promise<void> {
  await fs.writeText(PATHS.blenderFaces, JSON.stringify(data, null, 2));
}
