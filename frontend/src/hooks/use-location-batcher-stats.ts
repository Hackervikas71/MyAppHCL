import { useEffect, useState } from "react";
import { LocationBatcher } from "@/src/lib/location-batcher";

/** Live snapshot of the batcher — used to render the tiny sync indicator. */
export function useLocationBatcherStats() {
  const [stats, setStats] = useState(LocationBatcher.stats());
  useEffect(() => {
    const unsub = LocationBatcher.subscribe(() => setStats(LocationBatcher.stats()));
    const t = setInterval(() => setStats(LocationBatcher.stats()), 3000);
    return () => { unsub(); clearInterval(t); };
  }, []);
  return stats;
}
