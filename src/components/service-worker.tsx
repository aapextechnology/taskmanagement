"use client";

import { useEffect } from "react";

// Registers the offline shell (T-103). Production only — in dev the worker
// would serve stale hashed assets between rebuilds.
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        console.warn("[sw] registration failed:", error);
      });
    };
    // don't compete with the first paint for bandwidth
    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register);
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
