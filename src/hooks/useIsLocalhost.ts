'use client';

import { useState, useEffect } from 'react';

export function useIsLocalhost(): boolean {
  const [isLocal, setIsLocal] = useState(true); // default true for SSR
  useEffect(() => {
    const { hostname } = window.location;
    setIsLocal(hostname === 'localhost' || hostname === '127.0.0.1');
  }, []);
  return isLocal;
}
