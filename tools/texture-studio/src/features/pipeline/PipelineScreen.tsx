import { useCallback, useEffect, useRef, useState } from 'react';
import { useStudioStore } from '../../app/store';
import { PATHS } from '../../domain/constants';
import { toExportFileName } from '../../domain/catalog';
import { autoBscHints } from '../../services/image/adjust';
import { composeFaceTexture } from '../../services/image/compose';
import { encodeTexturePng } from '../../services/image/encodePng';
import { detectGuideLines, GuideLine } from '../../services/image/lines';
import { estimateBuildingMask, paintMaskBrush } from '../../services/image/mask';
import { defaultInsetQuad, Point, Quad } from '../../services/image/perspectiveMath';
import { blobToImageData, imageDataToPngBlob } from '../../services/image/raster';
import { toArrayBuffer } from '../../services/fs/projectFs';

type Tool = 'mask-add' | 'mask-erase' | 'corners' | 'filter';

export function PipelineScreen() {
  const fs = useStudioStore((s) => s.fs);
  const overlay = useStudioStore((s) => s.overlay);
  const selectedBuildingId = useStudioStore((s) => s.selectedBuildingId);
  const selectedFaceId = useStudioStore((s) => s.selectedFaceId);
  const meta = useStudioStore((s) => s.meta);
  const patchFace = useStudioStore((s) => s.patchFace);
  const setScreen = useStudioStore((s) => s.setScreen);
  const building = overlay?.buildings.find((b) => b.building_id === selectedBuildingId);
  const face = building?.faces.find((f) => f.face_id === selectedFaceId);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [source, setSource] = useState<ImageData | null>(null);
  const [mask, setMask] = useState<Uint8Array | null>(null);
  const [filterMask, setFilterMask] = useState<Uint8Array | null>(null);
  const [quad, setQuad] = useState<Quad | null>(null);
  const [guides, setGuides] = useState<{ left: GuideLine | null; right: GuideLine | null; ground: GuideLine | null }>({
    left: null,
    right: null,
    ground: null
  });
  const [tool, setTool] = useState<Tool>('mask-add');
  const [brush, setBrush] = useState(24);
  const [filterStrength, setFilterStrength] = useState(40);
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [saturation, setSaturation] = useState(0);
  const [matchColor, setMatchColor] = useState(false);
  const [reference, setReference] = useState<ImageData | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const dragCorner = useRef<number | null>(null);

  useEffect(() => {
    if (!fs || !face?.rawRelPath) {
      setSource(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const bytes = await fs.readBytes(face.rawRelPath!);
      if (!bytes || cancelled) {
        return;
      }
      const image = await blobToImageData(new Blob([toArrayBuffer(bytes)]));
      if (cancelled) {
        return;
      }
      setSource(image);
      setMask(estimateBuildingMask(image));
      setFilterMask(new Uint8Array(image.width * image.height));
      const detected = detectGuideLines(image);
      setGuides(detected);
      setQuad(detected.quad);
      const auto = autoBscHints(image);
      setBrightness(auto.brightness);
      setContrast(auto.contrast);
      setSaturation(auto.saturation);
    })();
    return () => {
      cancelled = true;
    };
  }, [fs, face?.rawRelPath]);

  useEffect(() => {
    if (!fs || !meta?.referenceImageRelPath) {
      setReference(null);
      return;
    }
    void fs.readBytes(meta.referenceImageRelPath).then(async (bytes) => {
      if (!bytes) {
        return;
      }
      setReference(await blobToImageData(new Blob([toArrayBuffer(bytes)]), 256));
    });
  }, [fs, meta?.referenceImageRelPath]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !source) {
      return;
    }
    canvas.width = source.width;
    canvas.height = source.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }
    ctx.putImageData(source, 0, 0);
    if (mask) {
      const overlayData = ctx.getImageData(0, 0, source.width, source.height);
      for (let i = 0; i < mask.length; i += 1) {
        if (mask[i]) {
          continue;
        }
        const p = i * 4;
        overlayData.data[p] = overlayData.data[p] * 0.35;
        overlayData.data[p + 1] = overlayData.data[p + 1] * 0.35;
        overlayData.data[p + 2] = overlayData.data[p + 2] * 0.55;
      }
      ctx.putImageData(overlayData, 0, 0);
    }
    if (filterMask) {
      ctx.fillStyle = 'rgba(80, 160, 255, 0.25)';
      for (let y = 0; y < source.height; y += 2) {
        for (let x = 0; x < source.width; x += 2) {
          if (filterMask[y * source.width + x]) {
            ctx.fillRect(x, y, 2, 2);
          }
        }
      }
    }
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    const drawLine = (line: GuideLine | null, color: string) => {
      if (!line) {
        return;
      }
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(line.x1, line.y1);
      ctx.lineTo(line.x2, line.y2);
      ctx.stroke();
    };
    drawLine(guides.left, '#22c55e');
    drawLine(guides.right, '#22c55e');
    drawLine(guides.ground, '#f59e0b');
    if (quad) {
      ctx.strokeStyle = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(quad[0].x, quad[0].y);
      ctx.lineTo(quad[1].x, quad[1].y);
      ctx.lineTo(quad[2].x, quad[2].y);
      ctx.lineTo(quad[3].x, quad[3].y);
      ctx.closePath();
      ctx.stroke();
      quad.forEach((pt, i) => {
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#111';
        ctx.fillText(String(i + 1), pt.x - 3, pt.y - 10);
      });
    }
  }, [filterMask, guides, mask, quad, source]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  useEffect(() => {
    if (!source || !mask || !quad) {
      return;
    }
    const handle = window.setTimeout(() => {
      const composed = composeFaceTexture(
        source,
        mask,
        quad,
        brightness,
        contrast,
        saturation,
        reference,
        matchColor,
        filterMask,
        filterStrength
      );
      void imageDataToPngBlob(composed).then((blob) => {
        setPreviewUrl((prev) => {
          if (prev) {
            URL.revokeObjectURL(prev);
          }
          return URL.createObjectURL(blob);
        });
      });
    }, 220);
    return () => window.clearTimeout(handle);
  }, [brightness, contrast, filterMask, filterStrength, mask, matchColor, quad, reference, saturation, source]);

  function toImagePoint(event: React.MouseEvent<HTMLCanvasElement>): Point | null {
    const canvas = canvasRef.current;
    const sourceImage = source;
    if (!canvas || !sourceImage) {
      return null;
    }
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * sourceImage.width;
    const y = ((event.clientY - rect.top) / rect.height) * sourceImage.height;
    return { x, y };
  }

  function onPointer(event: React.MouseEvent<HTMLCanvasElement>, dragging: boolean) {
    if (!source || !mask || !filterMask || !quad) {
      return;
    }
    if (event.buttons !== 1 && dragging) {
      return;
    }
    const pt = toImagePoint(event);
    if (!pt) {
      return;
    }
    if (tool === 'corners') {
      if (!dragging) {
        let nearest = -1;
        let best = 16;
        quad.forEach((corner, i) => {
          const d = Math.hypot(corner.x - pt.x, corner.y - pt.y);
          if (d < best) {
            best = d;
            nearest = i;
          }
        });
        dragCorner.current = nearest >= 0 ? nearest : null;
      }
      const index = dragCorner.current;
      if (index == null) {
        return;
      }
      const next = [...quad] as Quad;
      next[index] = pt;
      setQuad(next);
      return;
    }
    if (tool === 'filter') {
      const next = filterMask.slice();
      paintMaskBrush(next, source.width, source.height, pt.x, pt.y, brush, true);
      setFilterMask(next);
      return;
    }
    const next = mask.slice();
    paintMaskBrush(next, source.width, source.height, pt.x, pt.y, brush, tool === 'mask-add');
    setMask(next);
  }

  async function exportFace() {
    if (!fs || !building || !face || !source || !mask || !quad) {
      return;
    }
    setBusy(true);
    try {
      const composed = composeFaceTexture(
        source,
        mask,
        quad,
        brightness,
        contrast,
        saturation,
        reference,
        matchColor,
        filterMask,
        filterStrength
      );
      const encoded = await encodeTexturePng(composed);
      const fileName = toExportFileName(building.building_id, face.face_id);
      const exportPath = `${PATHS.exportDir}/${fileName}`;
      const workPath = `${PATHS.workDir}/${building.building_id}_${face.face_id}.png`;
      const workBlob = await imageDataToPngBlob(composed);
      await fs.writeBytes(workPath, new Uint8Array(await workBlob.arrayBuffer()));
      await fs.writeBytes(exportPath, encoded.bytes);
      patchFace(building.building_id, face.face_id, {
        status: 'exported',
        workRelPath: workPath,
        exportRelPath: exportPath,
        perspectiveMode: 'corners',
        lastExportFormat: encoded.format,
        lastExportBytes: encoded.bytes.byteLength,
        lastExportWarning: encoded.warning
      });
      setMessage(
        `${fileName} を書き出しました（${encoded.format}, ${encoded.bytes.byteLength} bytes）${encoded.warning ? ` / ${encoded.warning}` : ''}`
      );
      setScreen('export');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '書き出しに失敗しました');
    } finally {
      setBusy(false);
    }
  }

  if (!building || !face) {
    return <p className="muted">建物と面を選んでから加工してください。</p>;
  }
  if (!face.rawRelPath) {
    return <p className="muted">この面に写真がまだありません。建物画面で画像を指定してください。</p>;
  }

  return (
    <div className="pipeline">
      <div className="canvas-stage">
        <canvas
          ref={canvasRef}
          onMouseDown={(e) => onPointer(e, false)}
          onMouseMove={(e) => onPointer(e, true)}
          onMouseUp={() => {
            dragCorner.current = null;
          }}
        />
      </div>
      <aside className="panel stack">
        <h2>加工</h2>
        <p className="muted">
          {building.building_id} / face {face.face_id}
        </p>
        <div className="toolbar" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <button type="button" className={tool === 'mask-add' ? 'primary' : ''} onClick={() => setTool('mask-add')}>
            領域+
          </button>
          <button type="button" className={tool === 'mask-erase' ? 'primary' : ''} onClick={() => setTool('mask-erase')}>
            領域-
          </button>
          <button type="button" className={tool === 'corners' ? 'primary' : ''} onClick={() => setTool('corners')}>
            四隅
          </button>
          <button type="button" className={tool === 'filter' ? 'primary' : ''} onClick={() => setTool('filter')}>
            部分処理
          </button>
        </div>
        <label className="field">
          ブラシ {brush}px
          <input type="range" min={4} max={80} value={brush} onChange={(e) => setBrush(Number(e.target.value))} />
        </label>
        <button
          type="button"
          onClick={() => {
            if (source) {
              setMask(estimateBuildingMask(source));
            }
          }}
        >
          領域を再推定（A1）
        </button>
        <button
          type="button"
          onClick={() => {
            if (!source) {
              return;
            }
            const detected = detectGuideLines(source);
            setGuides(detected);
            setQuad(detected.quad);
          }}
        >
          垂直線を再検出（B1）
        </button>
        <button type="button" onClick={() => source && setQuad(defaultInsetQuad(source.width, source.height))}>
          四隅をリセット（B2）
        </button>
        <button
          type="button"
          onClick={() => source && setFilterMask(new Uint8Array(source.width * source.height))}
        >
          部分処理を消去
        </button>
        <label className="field">
          明度 {brightness}
          <input type="range" min={-80} max={80} value={brightness} onChange={(e) => setBrightness(Number(e.target.value))} />
        </label>
        <label className="field">
          コントラスト {contrast}
          <input type="range" min={-80} max={80} value={contrast} onChange={(e) => setContrast(Number(e.target.value))} />
        </label>
        <label className="field">
          彩度 {saturation}
          <input type="range" min={-80} max={80} value={saturation} onChange={(e) => setSaturation(Number(e.target.value))} />
        </label>
        <label>
          <input
            type="checkbox"
            checked={matchColor}
            disabled={!reference}
            onChange={(e) => setMatchColor(e.target.checked)}
          />{' '}
          基準画像へ色調を寄せる（プロジェクト1枚）
        </label>
        <label className="field">
          部分処理の強さ {filterStrength}
          <input
            type="range"
            min={0}
            max={100}
            value={filterStrength}
            onChange={(e) => setFilterStrength(Number(e.target.value))}
          />
        </label>
        <p className="muted">部分処理は今はストローク範囲の彩度を落とす器です。Photoshop相当の種類は後から差し替えます。</p>
        {previewUrl ? <img src={previewUrl} alt="プレビュー" width={200} height={200} /> : null}
        <button type="button" className="primary" disabled={busy} onClick={() => void exportFace()}>
          500px / PNG8 で書き出し
        </button>
        {message ? <p className="muted">{message}</p> : null}
      </aside>
    </div>
  );
}
