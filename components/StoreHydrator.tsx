"use client";

import { useEffect } from "react";
import { hydrate } from "@/lib/mvpStore";

/** Hydrates the MVP store from localStorage once, after the first paint. */
export default function StoreHydrator() {
  useEffect(() => {
    hydrate();
  }, []);
  return null;
}
