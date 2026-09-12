import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';

const SCAN_THROTTLE_MS = 1500;

export default function QrScanner({ onScan, onClose, parse }) {
  const videoRef = useRef(null);
  const onScanRef = useRef(onScan);
  const parseRef = useRef(parse);
  const [error, setError] = useState(null);
  const [hint, setHint] = useState(null);

  onScanRef.current = onScan;
  parseRef.current = parse;

  useEffect(() => {
    let stream = null;
    let frame = 0;
    let stopped = false;
    let lastValue = null;
    let lastValueAt = 0;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const tick = () => {
      if (stopped) return;

      const video = videoRef.current;
      if (video && video.readyState >= 2) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const result = jsQR(image.data, image.width, image.height);

        if (result?.data) {
          const now = Date.now();
          const isRepeat = result.data === lastValue && now - lastValueAt < SCAN_THROTTLE_MS;

          if (!isRepeat) {
            lastValue = result.data;
            lastValueAt = now;

            const parsed = parseRef.current ? parseRef.current(result.data) : result.data;
            if (parsed) {
              stopped = true;
              onScanRef.current(parsed);
              return;
            }
            setHint('That QR code is not a wallet address.');
          }
        }
      }

      frame = requestAnimationFrame(tick);
    };

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('This browser does not support camera access.');
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });

        if (stopped) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();
        tick();
      } catch (err) {
        setError(
          err?.name === 'NotAllowedError'
            ? 'Camera permission was denied.'
            : 'Could not access the camera.'
        );
      }
    };

    start();

    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      if (stream) stream.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="scanner-overlay" role="dialog" aria-modal="true" aria-label="Scan wallet QR code">
      <div className="scanner-panel">
        <div className="scanner-header">
          <span className="scanner-title">Scan wallet QR</span>
          <button
            type="button"
            className="scanner-close"
            onClick={onClose}
            aria-label="Close scanner"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="scanner-viewport">
          <video ref={videoRef} className="scanner-video" autoPlay muted playsInline />
          {error ? (
            <p className="scanner-error">{error}</p>
          ) : (
            <div className="scanner-reticle" aria-hidden="true" />
          )}
        </div>

        <p className="scanner-hint">
          {hint || 'Point the camera at the wallet QR code on the profile page.'}
        </p>
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
