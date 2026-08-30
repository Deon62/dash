import { useEffect, useState } from "react";

import { msUntilMidnight, untilMidnightLabel } from "@/lib/dates";

/**
 * "5h 6m" until the daily allowance resets, kept current while the screen is
 * open.
 *
 * The timer is re-armed for the exact moment the label next changes rather
 * than run on a fixed interval: a one-second tick would re-render a screen
 * fourteen hundred times to change a number twenty-four times, and a lazy
 * one-minute interval drifts out of step with the countdown it is spelling —
 * it would sit on "6m" for most of the minute that was really "5m".
 *
 * A student who leaves the app open overnight sees it roll back up to a full
 * day, which is exactly what `rollUsage` does to their counters at the same
 * moment.
 */
export function useMidnightCountdown() {
  const [label, setLabel] = useState(() => untilMidnightLabel());

  useEffect(() => {
    let timer;

    const tick = () => {
      setLabel(untilMidnightLabel());
      // Whatever is left of the current minute, and never zero — a timeout of
      // 0 would spin.
      const remaining = msUntilMidnight();
      timer = setTimeout(tick, ((remaining - 1) % 60000) + 1);
    };

    tick();
    return () => clearTimeout(timer);
  }, []);

  return label;
}
