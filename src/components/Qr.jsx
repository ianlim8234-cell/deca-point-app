import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';

export function QrImage({ value, size = 240, dark = '#1d1917', light = '#ffffff', className = '' }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    if (!value) return;
    QRCode.toDataURL(value, { width: size * 2, margin: 1, errorCorrectionLevel: 'M', color: { dark, light } }).then(setSrc);
  }, [value, size, dark, light]);
  if (!src) return <div style={{ width: size, height: size }} className={`animate-pulse rounded-xl bg-washi-2 ${className}`} />;
  return <img src={src} width={size} height={size} alt="QR code" className={className} style={{ imageRendering: 'pixelated' }} />;
}

/**
 * Camera QR scanner. Uses the qr-scanner library (it runs in a Web Worker and uses the
 * native BarcodeDetector API where available). The camera needs HTTPS or localhost.
 */
export function QrScanner({ onResult, paused = false }) {
  const videoRef = useRef(null);
  const scannerRef = useRef(null);
  const lastRef = useRef({ v: null, t: 0 });
  const [error, setError] = useState(null);
  const [cams, setCams] = useState([]);
  const [camId, setCamId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { default: Scanner } = await import('qr-scanner');
        if (cancelled) return;
        const s = new Scanner(
          videoRef.current,
          (res) => {
            const v = res?.data || res;
            const now = Date.now();
            if (v === lastRef.current.v && now - lastRef.current.t < 2500) return; // de-bounce repeated reads
            lastRef.current = { v, t: now };
            onResult?.(v);
          },
          { preferredCamera: 'environment', highlightScanRegion: true, highlightCodeOutline: true, maxScansPerSecond: 8, returnDetailedScanResult: true }
        );
        scannerRef.current = s;
        await s.start();
        Scanner.listCameras(true).then((c) => !cancelled && setCams(c)).catch(() => {});
      } catch (e) {
        setError(window.isSecureContext ? 'Camera unavailable. Allow camera access in your browser, or type the member ID below.' : 'The camera needs a secure (https://) connection. Type the member ID below instead.');
      }
    })();
    return () => {
      cancelled = true;
      scannerRef.current?.destroy();
      scannerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const s = scannerRef.current;
    if (!s) return;
    if (paused) s.pause?.();
    else s.start?.().catch(() => {});
  }, [paused]);

  useEffect(() => {
    if (camId && scannerRef.current) scannerRef.current.setCamera(camId).catch(() => {});
  }, [camId]);

  return (
    <div>
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-ink">
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
        {error && <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-washi">{error}</div>}
      </div>
      {cams.length > 1 && (
        <select className="input mt-2 text-sm" value={camId || ''} onChange={(e) => setCamId(e.target.value)}>
          <option value="">Default camera</option>
          {cams.map((c) => (
            <option key={c.id} value={c.id}>{c.label || c.id}</option>
          ))}
        </select>
      )}
    </div>
  );
}
