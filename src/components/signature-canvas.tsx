"use client";

import { useEffect, useImperativeHandle, useRef, forwardRef } from "react";

export type SignatureCanvasHandle = {
  isEmpty: () => boolean;
  toDataURL: () => string;
  clear: () => void;
};

type Props = {
  onEnd?: () => void;
  className?: string;
};

export const SignatureCanvas = forwardRef<SignatureCanvasHandle, Props>(
  function SignatureCanvas({ onEnd, className }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useImperativeHandle(ref, () => ({
      isEmpty() {
        const canvas = canvasRef.current;
        if (!canvas) return true;
        const data = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
        return !data.some((v) => v !== 0);
      },
      toDataURL() {
        return canvasRef.current?.toDataURL("image/png") ?? "";
      },
      clear() {
        const canvas = canvasRef.current;
        if (canvas) canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
      },
    }));

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const cv = canvas;
      const ctx = cv.getContext("2d")!;
      let drawing = false;
      let lastX = 0, lastY = 0;

      function pos(e: MouseEvent | TouchEvent) {
        const rect = cv.getBoundingClientRect();
        const src  = "touches" in e ? e.touches[0] : e;
        return {
          x: (src.clientX - rect.left)  * (cv.width  / rect.width),
          y: (src.clientY - rect.top)   * (cv.height / rect.height),
        };
      }

      function start(e: MouseEvent | TouchEvent) {
        drawing = true;
        const p = pos(e); lastX = p.x; lastY = p.y;
      }
      function move(e: MouseEvent | TouchEvent) {
        if (!drawing) return;
        const p = pos(e);
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(p.x, p.y);
        ctx.strokeStyle = "#111";
        ctx.lineWidth   = 2.5;
        ctx.lineCap     = "round";
        ctx.stroke();
        lastX = p.x; lastY = p.y;
      }
      function end() {
        if (!drawing) return;
        drawing = false;
        onEnd?.();
      }

      canvas.addEventListener("mousedown",  start);
      canvas.addEventListener("mousemove",  move);
      canvas.addEventListener("mouseup",    end);
      canvas.addEventListener("mouseleave", end);
      canvas.addEventListener("touchstart", start, { passive: false });
      canvas.addEventListener("touchmove",  (e) => { e.preventDefault(); move(e); }, { passive: false });
      canvas.addEventListener("touchend",   end);

      return () => {
        canvas.removeEventListener("mousedown",  start);
        canvas.removeEventListener("mousemove",  move);
        canvas.removeEventListener("mouseup",    end);
        canvas.removeEventListener("mouseleave", end);
        canvas.removeEventListener("touchstart", start);
        canvas.removeEventListener("touchmove",  move as EventListener);
        canvas.removeEventListener("touchend",   end);
      };
    }, [onEnd]);

    return (
      <canvas
        ref={canvasRef}
        width={600}
        height={160}
        className={className ?? "w-full border border-dashed border-border rounded-[var(--radius-sm)] cursor-crosshair touch-none select-none bg-white"}
        style={{ height: 90 }}
      />
    );
  }
);
