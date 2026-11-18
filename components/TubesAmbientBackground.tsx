'use client';

import { useEffect, useRef } from 'react';

/**
 * Ambient 3D tube layer for the Sentinel workbench.
 * Kept behind the semantic UI so it never blocks controls or scrolling.
 */
export default function TubesAmbientBackground() {
  const appRef = useRef<any>(null);

  useEffect(() => {
    let mounted = true;
    let removeClickListener: (() => void) | undefined;

    const init = async () => {
      try {
        // Load the same lightweight cursor-tubes build used by the reference.
        // @ts-expect-error Remote ESM module is intentionally loaded at runtime.
        const module = await import(
          /* webpackIgnore: true */ 'https://cdn.jsdelivr.net/npm/threejs-components@0.0.19/build/cursors/tubes1.min.js'
        );
        if (!mounted) return;

        const TubesCursor = module.default;
        const canvas = document.getElementById(
          'sentinel-tubes-background'
        ) as HTMLCanvasElement | null;
        if (!canvas) return;

        const app = TubesCursor(canvas, {
          tubes: {
            colors: ['#00D9F5', '#147D92', '#5B61D6'],
            lights: {
              intensity: 105,
              colors: ['#00D9F5', '#4B72FF', '#8B5CF6', '#20C997'],
            },
          },
        });

        if (!mounted) {
          app?.destroy?.();
          return;
        }
        appRef.current = app;

        const randomColors = (count: number) =>
          Array.from({ length: count }, () =>
            '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')
          );

        const handleClick = () => {
          appRef.current?.tubes?.setColors?.(randomColors(3));
          appRef.current?.tubes?.setLightsColors?.(randomColors(4));
        };

        window.addEventListener('click', handleClick);
        removeClickListener = () =>
          window.removeEventListener('click', handleClick);
      } catch (error) {
        // The core workbench remains fully usable if WebGL/CDN loading fails.
        console.warn('[Sentinel] 3D tubes background unavailable:', error);
      }
    };

    init();

    return () => {
      mounted = false;
      removeClickListener?.();
      appRef.current?.destroy?.();
      appRef.current = null;
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-[1] overflow-hidden pointer-events-none"
    >
      <canvas
        id="sentinel-tubes-background"
        className="absolute inset-0 h-full w-full"
        style={{ opacity: 0.52, touchAction: 'pan-y' }}
      />
      <div className="absolute inset-0 bg-[#07090E]/45" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_10%,#07090E_88%)]" />
    </div>
  );
}
