import { describe, expect, it } from 'vitest';
import {
  mergeGameAndOverlay,
  nextFaceId,
  overlayFromGameBuildings,
  parseExportFileName,
  toExportFileName
} from './catalog';
import { GameBuilding, OverlayCatalog } from './project';

const sampleGame: GameBuilding[] = [
  { id: 'bldg_sample_388_114', name: 'sample', lat: 38.988, lng: 141.114 }
];

describe('catalog helpers', () => {
  it('pads sequential face ids', () => {
    expect(nextFaceId([])).toBe('01');
    expect(nextFaceId([{ face_id: '01', status: 'unshot' }])).toBe('02');
    expect(nextFaceId([{ face_id: '01', status: 'unshot' }, { face_id: '03', status: 'unshot' }])).toBe(
      '02'
    );
  });

  it('builds export file names from game building ids', () => {
    const name = toExportFileName('bldg_sample_388_114', '01');
    expect(name).toBe('building_bldg_sample_388_114_face_01.png');
    expect(parseExportFileName(name)).toEqual({
      buildingId: 'bldg_sample_388_114',
      faceId: '01'
    });
  });

  it('merges game buildings without dropping overlay faces', () => {
    const overlay: OverlayCatalog = {
      schemaVersion: 1,
      buildings: [
        {
          building_id: 'bldg_sample_388_114',
          osm_id: '123',
          isShootTarget: true,
          pendingGameId: false,
          faces: [{ face_id: '01', status: 'raw', rawRelPath: 'photos/raw/a.jpg' }]
        },
        {
          building_id: 'tmp_new',
          isShootTarget: true,
          pendingGameId: true,
          faces: []
        }
      ]
    };

    const merged = mergeGameAndOverlay(sampleGame, overlay);
    const known = merged.buildings.find((b) => b.building_id === 'bldg_sample_388_114');
    const pending = merged.buildings.find((b) => b.building_id === 'tmp_new');
    expect(known?.osm_id).toBe('123');
    expect(known?.faces[0]?.face_id).toBe('01');
    expect(known?.pendingGameId).toBe(false);
    expect(pending?.pendingGameId).toBe(true);
  });

  it('creates overlay rows from game json without writing game fields back', () => {
    const overlay = overlayFromGameBuildings(sampleGame);
    expect(overlay.buildings[0]?.building_id).toBe('bldg_sample_388_114');
    expect(overlay.buildings[0]?.isShootTarget).toBe(false);
  });
});
