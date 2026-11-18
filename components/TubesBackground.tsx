'use client';

import dynamic from 'next/dynamic';

const TubesCanvas = dynamic(() => import('./TubesAmbientBackground'), { ssr: false });

export default function TubesBackground() {
  return <div className="sentinel-tubes-layer" aria-hidden="true"><TubesCanvas /></div>;
}
