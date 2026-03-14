// CanvasAnimation — animated <canvas> that feeds Panel 2 via captureCanvasStream.
import { useEffect, useRef, type JSX } from 'react';
import { captureCanvasStream, stopCaptureStream } from '@brewsite/screens';

const STREAM_ID = 'canvas-demo';
const WIDTH = 640;
const HEIGHT = 360;

export function CanvasAnimation(): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Register the canvas stream for the MediaScreen widget
    streamRef.current = captureCanvasStream(canvas, STREAM_ID, 30);

    let frameId = 0;

    function draw(): void {
      const t = performance.now() * 0.001; // seconds

      // Rotating gradient background
      const cx = WIDTH / 2;
      const cy = HEIGHT / 2;
      const angle = t * 0.5;
      const r = Math.max(WIDTH, HEIGHT) * 0.7;
      const x0 = cx + Math.cos(angle) * r;
      const y0 = cy + Math.sin(angle) * r;
      const x1 = cx - Math.cos(angle) * r;
      const y1 = cy - Math.sin(angle) * r;

      const grad = ctx!.createLinearGradient(x0, y0, x1, y1);
      const hue1 = (t * 30) % 360;
      const hue2 = (hue1 + 120) % 360;
      const hue3 = (hue1 + 240) % 360;
      grad.addColorStop(0, `hsl(${hue1}, 70%, 40%)`);
      grad.addColorStop(0.5, `hsl(${hue2}, 80%, 50%)`);
      grad.addColorStop(1, `hsl(${hue3}, 70%, 40%)`);

      ctx!.fillStyle = grad;
      ctx!.fillRect(0, 0, WIDTH, HEIGHT);

      // Floating circles
      for (let i = 0; i < 5; i++) {
        const ox = cx + Math.cos(t * (0.3 + i * 0.2) + i * 1.2) * (WIDTH * 0.3);
        const oy = cy + Math.sin(t * (0.4 + i * 0.15) + i * 0.8) * (HEIGHT * 0.3);
        const radius = 20 + Math.sin(t + i) * 10;
        ctx!.beginPath();
        ctx!.arc(ox, oy, radius, 0, Math.PI * 2);
        ctx!.fillStyle = `hsla(${(hue1 + i * 60) % 360}, 60%, 70%, 0.35)`;
        ctx!.fill();
      }

      // Timestamp overlay
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour12: false, fractionalSecondDigits: 1 } as Intl.DateTimeFormatOptions);
      ctx!.font = 'bold 28px system-ui, sans-serif';
      ctx!.textAlign = 'center';
      ctx!.textBaseline = 'bottom';
      ctx!.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx!.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx!.shadowBlur = 6;
      ctx!.fillText(timeStr, cx, HEIGHT - 20);
      ctx!.shadowBlur = 0;

      // "LIVE" badge
      ctx!.font = 'bold 12px system-ui, sans-serif';
      ctx!.textAlign = 'left';
      ctx!.textBaseline = 'top';
      ctx!.fillStyle = '#ff4444';
      ctx!.beginPath();
      ctx!.arc(22, 22, 5, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx!.fillText('LIVE', 32, 15);

      frameId = requestAnimationFrame(draw);
    }

    frameId = requestAnimationFrame(draw);

    return (): void => {
      cancelAnimationFrame(frameId);
      if (streamRef.current) {
        stopCaptureStream(STREAM_ID, streamRef.current);
        streamRef.current = null;
      }
    };
  }, []);

  // The canvas is visually hidden — its output goes to the 3D scene via captureCanvasStream.
  // position:absolute + opacity:0 keeps it in the DOM for captureStream but invisible.
  return (
    <canvas
      ref={canvasRef}
      width={WIDTH}
      height={HEIGHT}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: 1,
        height: 1,
        opacity: 0,
        pointerEvents: 'none',
      }}
    />
  );
}
