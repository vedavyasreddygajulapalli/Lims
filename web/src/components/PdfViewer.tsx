import { useEffect, useRef, useState } from "react";
import { Button, Notice, Loading } from "./ui";
import {
  getDocument,
  GlobalWorkerOptions,
  type PDFDocumentProxy,
  type RenderTask,
} from "pdfjs-dist";
import workerCode from "pdfjs-dist/build/pdf.worker.min.mjs?raw";
GlobalWorkerOptions.workerSrc = URL.createObjectURL(
  new Blob([workerCode], { type: "text/javascript" }),
);
export function PdfViewer({ url, name }: { url: string; name: string }) {
  const canvas = useRef<HTMLCanvasElement>(null),
    container = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null),
    [page, setPage] = useState(1),
    [zoom, setZoom] = useState(1),
    [width, setWidth] = useState(600),
    [error, setError] = useState(""),
    [rendering, setRendering] = useState(false);
  useEffect(() => {
    let current = true;
    setDoc(null);
    setPage(1);
    setError("");
    const task = getDocument({ url, enableXfa: false, useSystemFonts: true });
    task.promise
      .then((d) => {
        if (current) setDoc(d);
      })
      .catch(() => {
        if (current)
          setError(
            "This PDF cannot be previewed. Download it to open in a PDF reader.",
          );
      });
    return () => {
      current = false;
      void task.destroy();
    };
  }, [url]);
  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver((entries) =>
      setWidth(Math.max(200, entries[0].contentRect.width - 24)),
    );
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!doc) return;
    let current = true,
      task: RenderTask | undefined;
    setRendering(true);
    setError("");
    doc
      .getPage(page)
      .then((p) => {
        if (!current || !canvas.current) return;
        const natural = p.getViewport({ scale: 1 });
        const desired =
          ((Math.min(2, window.devicePixelRatio || 1) * Math.min(width, 1200)) /
            natural.width) *
          zoom;
        const scale = Math.min(
          desired,
          8192 / natural.width,
          8192 / natural.height,
          Math.sqrt(16000000 / (natural.width * natural.height)),
        );
        const viewport = p.getViewport({ scale });
        const c = canvas.current;
        c.width = viewport.width;
        c.height = viewport.height;
        c.style.width =
          viewport.width / Math.min(2, window.devicePixelRatio || 1) + "px";
        c.style.height =
          viewport.height / Math.min(2, window.devicePixelRatio || 1) + "px";
        task = p.render({ canvas: c, viewport });
        return task.promise;
      })
      .catch((e) => {
        if (current && e.name !== "RenderingCancelledException")
          setError(
            "Unable to render this page. You can still download the original PDF.",
          );
      })
      .finally(() => {
        if (current) setRendering(false);
      });
    return () => {
      current = false;
      task?.cancel();
    };
  }, [doc, page, zoom, width]);
  return (
    <div data-no-dirty>
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-3">
        <Button
          variant="secondary"
          disabled={!doc || page === 1 || rendering}
          onClick={() => setPage((p) => p - 1)}
        >
          Previous
        </Button>
        <span className="text-sm" aria-live="polite">
          Page {page} of {doc?.numPages ?? "…"}
        </span>
        <Button
          variant="secondary"
          disabled={!doc || page === doc.numPages || rendering}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </Button>
        <Button
          variant="ghost"
          aria-label="Zoom out"
          disabled={zoom <= 0.5 || rendering}
          onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
        >
          −
        </Button>
        <span className="text-sm">{Math.round(zoom * 100)}%</span>
        <Button
          variant="ghost"
          aria-label="Zoom in"
          disabled={zoom >= 2 || rendering}
          onClick={() => setZoom((z) => Math.min(2, z + 0.25))}
        >
          +
        </Button>
        <Button variant="ghost" onClick={() => setZoom(1)}>
          Fit width
        </Button>
        <a
          className="ml-auto rounded-lg bg-teal-800 px-4 py-2 text-sm text-white"
          href={url}
          download={name}
        >
          Download PDF
        </a>
      </div>
      {error && <Notice tone="red">{error}</Notice>}
      {!doc && !error && <Loading />}
      <div
        ref={container}
        className="max-h-[65vh] overflow-auto rounded-xl bg-slate-100 p-3"
        aria-busy={rendering}
      >
        <canvas
          ref={canvas}
          aria-label={name + " page " + page}
          className="mx-auto bg-white shadow-sm"
        />
      </div>
    </div>
  );
}
