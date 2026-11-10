"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator && window.location.protocol === "https:") {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // Service-worker registration failure must not block the application.
      });
    }
  }, []);

  return null;
}
