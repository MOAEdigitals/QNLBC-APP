import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Minus, Plus } from 'lucide-react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import type { SermonAttachment } from './model';
import { downloadSermonFile } from './attachments';
import { escapeText } from './formatting';
import 'pdfjs-dist/web/pdf_viewer.css';

export default function AttachmentViewer({ attachment }: { attachment: SermonAttachment }) {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [docxHtml, setDocxHtml] = useState('');
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const textLayer = useRef<HTMLDivElement>(null);
  const widthRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(700);
  useEffect(() => {
    const element = widthRef.current;
    if (!element) return;
    const observer = new ResizeObserver(entries => setWidth(Math.max(200, entries[0].contentRect.width)));
    observer.observe(element); return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let cancelled = false;
    let document: PDFDocumentProxy | null = null;
    setLoading(true); setError(''); setPdf(null); setDocxHtml(''); setBlob(null); setPage(1); setZoom(1);
    (async () => {
      const file = await downloadSermonFile(attachment);
      if (cancelled) return;
      setBlob(file);
      if (attachment.kind === 'pdf') {
        const pdfjs = await import('pdfjs-dist');
        const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
        document = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
        if (!cancelled) setPdf(document); else void document.loadingTask.destroy();
      } else {
        const { renderAsync } = await import('docx-preview');
        const body = window.document.createElement('div');
        const styles = window.document.createElement('div');
        await renderAsync(file, body, styles, { ignoreWidth: true, ignoreHeight: true, useBase64URL: true, renderAltChunks: false, renderChanges: false });
        const head = `<meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data: blob:; font-src data: blob:;"><title>${escapeText(attachment.name)}</title>`;
        const css = '<style>html,body{margin:0;background:#fff;color:#111;font-family:Arial,sans-serif}.docx-wrapper{padding:0!important;background:#fff!important}.docx-wrapper>section.docx{width:100%!important;max-width:100%!important;box-sizing:border-box!important;padding:24px!important;box-shadow:none!important}img,table{max-width:100%}a{color:#197aa3}*{overflow-wrap:break-word}</style>';
        if (!cancelled) setDocxHtml(`<!doctype html><html><head>${head}${styles.innerHTML}${css}</head><body>${body.innerHTML}</body></html>`);
      }
    })().catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Unable to display this file.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; if (document) void document.loadingTask.destroy(); };
  }, [attachment.path]);
  useEffect(() => {
    if (!pdf || !canvas.current || !textLayer.current) return;
    let cancelled = false; let task: RenderTask | undefined; let layer: { cancel: () => void } | undefined;
    setRendering(true); setError('');
    (async () => {
      const pdfPage = await pdf.getPage(page);
      if (cancelled || !canvas.current || !textLayer.current) return;
      const original = pdfPage.getViewport({ scale: 1 });
      const scale = (width / original.width) * zoom;
      const viewport = pdfPage.getViewport({ scale });
      const density = Math.min(window.devicePixelRatio || 1, 2);
      const element = canvas.current;
      element.width = Math.ceil(viewport.width * density); element.height = Math.ceil(viewport.height * density);
      element.style.width = `${viewport.width}px`; element.style.height = `${viewport.height}px`;
      task = pdfPage.render({ canvas: element, viewport, transform: [density, 0, 0, density, 0, 0] });
      await task.promise;
      if (cancelled || !textLayer.current) return;
      const target = textLayer.current;
      target.replaceChildren(); target.style.setProperty('--scale-factor', String(scale)); target.style.setProperty('--total-scale-factor', String(scale));
      const { TextLayer } = await import('pdfjs-dist');
      layer = new TextLayer({ textContentSource: await pdfPage.getTextContent(), container: target, viewport });
      await (layer as InstanceType<typeof TextLayer>).render();
    })().catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Unable to display this PDF page.'); })
      .finally(() => { if (!cancelled) setRendering(false); });
    return () => { cancelled = true; task?.cancel(); layer?.cancel(); };
  }, [pdf, page, width, zoom]);
  function download() {
    if (!blob) return;
    const url = URL.createObjectURL(blob); const anchor = window.document.createElement('a');
    anchor.href = url; anchor.download = attachment.name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  const button = 'min-w-10 min-h-10 px-2 rounded-lg flex items-center justify-center hover:bg-slate-100 disabled:opacity-30';
  return <div ref={widthRef} className="w-full min-w-0 text-slate-900">
    <div className="flex items-center justify-between gap-2 flex-wrap pb-3">
      <p className="text-sm text-slate-600 break-all flex-1">{attachment.name}</p>
      {pdf && <div className="flex items-center gap-1"><button type="button" className={button} aria-label="Previous page" disabled={page <= 1 || rendering} onClick={() => setPage(value => value - 1)}><ChevronLeft className="w-4 h-4" /></button><span className="text-xs">{page} / {pdf.numPages}</span><button type="button" className={button} aria-label="Next page" disabled={page >= pdf.numPages || rendering} onClick={() => setPage(value => value + 1)}><ChevronRight className="w-4 h-4" /></button><button type="button" className={button} aria-label="Zoom out" disabled={zoom <= 0.6} onClick={() => setZoom(value => Math.max(0.6, value - 0.2))}><Minus className="w-4 h-4" /></button><button type="button" className={button} aria-label="Zoom in" disabled={zoom >= 2} onClick={() => setZoom(value => Math.min(2, value + 0.2))}><Plus className="w-4 h-4" /></button></div>}
      <button type="button" className={button} disabled={!blob} aria-label="Download attachment" title="Download attachment" onClick={download}><Download className="w-4 h-4" /></button>
    </div>
    {loading && <p role="status" className="p-4 text-sm text-slate-500">Loading document…</p>}
    {error && <p role="alert" className="p-4 text-sm text-rose-600">{error}</p>}
    {pdf && <div className="overflow-auto bg-slate-100 rounded-xl"><div className="relative w-fit mx-auto bg-white"><canvas ref={canvas} /><div ref={textLayer} className="textLayer" /></div></div>}
    {docxHtml && <iframe title={attachment.name} sandbox="allow-same-origin" srcDoc={docxHtml} className="w-full border-0 min-h-[75dvh] bg-white" />}
  </div>;
}
