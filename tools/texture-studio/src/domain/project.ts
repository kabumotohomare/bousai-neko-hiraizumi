import { z } from 'zod';

export const GameBuildingSchema = z.object({
  id: z.string(),
  kind: z.enum(['landmark', 'generic']).optional(),
  name: z.string().optional(),
  lat: z.number(),
  lng: z.number(),
  headingDeg: z.number().optional(),
  modelUrl: z.string().optional(),
  width: z.number().optional(),
  depth: z.number().optional(),
  height: z.number().optional()
});

export const GameBuildingsSchema = z.array(GameBuildingSchema);
export type GameBuilding = z.infer<typeof GameBuildingSchema>;

export const UvAdjustSchema = z.object({
  offsetX: z.number().default(0),
  offsetY: z.number().default(0),
  rotationDeg: z.number().default(0),
  scale: z.number().default(1),
  flipX: z.boolean().default(false),
  flipY: z.boolean().default(false)
});

export const FaceStatusSchema = z.enum(['unshot', 'raw', 'processed', 'exported']);
export const PerspectiveModeSchema = z.enum(['auto-vertical', 'corners', 'none']);

export const OverlayFaceSchema = z.object({
  face_id: z.string(),
  blenderObjectName: z.string().optional(),
  status: FaceStatusSchema,
  rawRelPath: z.string().optional(),
  workRelPath: z.string().optional(),
  exportRelPath: z.string().optional(),
  perspectiveMode: PerspectiveModeSchema.optional(),
  uvAdjust: UvAdjustSchema.optional(),
  lastExportFormat: z.enum(['png8', 'png32']).optional(),
  lastExportBytes: z.number().optional(),
  lastExportWarning: z.string().optional()
});

export const OverlayBuildingSchema = z.object({
  building_id: z.string(),
  osm_id: z.string().optional(),
  name: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  isShootTarget: z.boolean().default(false),
  pendingGameId: z.boolean().default(false),
  faces: z.array(OverlayFaceSchema).default([])
});

export const OverlayCatalogSchema = z.object({
  schemaVersion: z.literal(1),
  buildings: z.array(OverlayBuildingSchema)
});

export const ProjectMetaSchema = z.object({
  schemaVersion: z.literal(1),
  name: z.string(),
  referenceImageRelPath: z.string().nullable().default(null),
  colorMatchScope: z.enum(['project', 'area']).default('project'),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const BlenderFaceSchema = z.object({
  building_id: z.string(),
  face_id: z.string(),
  objectName: z.string(),
  materialSlot: z.number().optional(),
  uvAdjust: UvAdjustSchema.optional()
});

export const BlenderFacesFileSchema = z.object({
  schemaVersion: z.literal(1),
  faces: z.array(BlenderFaceSchema)
});

export type UvAdjust = z.infer<typeof UvAdjustSchema>;
export type FaceStatus = z.infer<typeof FaceStatusSchema>;
export type OverlayFace = z.infer<typeof OverlayFaceSchema>;
export type OverlayBuilding = z.infer<typeof OverlayBuildingSchema>;
export type OverlayCatalog = z.infer<typeof OverlayCatalogSchema>;
export type ProjectMeta = z.infer<typeof ProjectMetaSchema>;
export type BlenderFacesFile = z.infer<typeof BlenderFacesFileSchema>;
