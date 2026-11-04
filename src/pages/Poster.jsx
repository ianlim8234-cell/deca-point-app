import { useState } from 'react';
import { Link } from 'react-router-dom';
import { QrImage } from '../components/Qr.jsx';
import { Logo } from '../components/ui.jsx';

/**
 * Printable table tent / host-stand card. The QR code points at this site's own address,
 * so it always matches wherever the app is deployed.
 */
export default function Poster() {
  const [url, setUrl] = useState(`${window.location.origin}/join`);
  return (
    <div className="min-h-screen bg-washi-2 py-8 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-6 flex max-w-2xl flex-wrap items-end gap-3 px-4">
        <label className="flex-1">
          <span className="label">QR destination</span>
          <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} />
        </label>
        <button className="btn-primary" onClick={() => window.print()}>Print</button>
        <Link to="/admin" className="btn-ghost">Back</Link>
        <p className="w-full text-xs text-ink-3">Print on card stock and place at the host stand and checkout counter. Make sure the address above is your public https:// address.</p>
      </div>
      <div className="mx-auto aspect-[8.5/11] w-full max-w-2xl overflow-hidden bg-paper shadow-lift print:max-w-none print:shadow-none">
        <div className="seigaiha flex h-[34%] flex-col items-center justify-center px-8 text-center text-washi">
          <Logo light size="lg" />
          <div className="mt-4 font-display text-4xl font-bold">Every visit brings you closer.</div>
          <div className="mt-2 text-washi/70">Ema Japanese Cuisine’s free rewards program</div>
        </div>
        <div className="flex flex-col items-center px-8 pt-8 text-center">
          <div className="rounded-3xl border-4 border-ink p-4">
            <QrImage value={url} size={260} />
          </div>
          <div className="mt-4 font-display text-3xl font-bold">Scan to join in 30 seconds</div>
          <div className="mt-6 grid w-full max-w-lg grid-cols-3 gap-4 text-sm">
            <div><div className="font-display text-3xl font-bold text-beni">10–12</div>points per $1</div>
            <div><div className="font-display text-3xl font-bold text-beni">2×</div>during Quiet Hours</div>
            <div><div className="font-display text-3xl font-bold text-beni">Free</div>appetizer at 1,500 pts</div>
          </div>
          <div className="mt-6 text-xs text-ink-3">Already a member? Open your Ema Rewards card and show it to your server before paying.</div>
        </div>
      </div>
    </div>
  );
}
