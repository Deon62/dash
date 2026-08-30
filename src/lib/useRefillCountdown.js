import { useEffect, useState } from "react";

import { msUntilRefill, untilRefillLabel } from "@/lib/dates";

/**
 * "6 days", or "5h 6m" on the last one, until the allowance refills.
 *
 * `resetsAt` is the server's date where the usage endpoint has sent one, and
 * the 1st of next month otherwise — the same answer, until a plan's own clock
 * disagrees with the calendar's.
 *
 * The timer is re-armed for the moment the label next changes rather than run
 * on a fixed interval: a one-second tick would re-render a screen tens of
 * thousands of times to change a number thirty times, and a lazy one-minute
 * interval drifts out of step with the countdown it is spelling — it would sit
 * on "6m" for most of the minute that was really "5m".
 */
export function useRefillCountdown(resetsAt = null) {
  const [label, setLabel] = useState(() => untilRefillLabel(resetsAt));

  useEffect(() => {
    let timer;

    const tick = () => {
      setLabel(untilRefillLabel(resetsAt));

      const remaining = msUntilRefill(resetsAt);
      // A whole day at a time while days are what is shown, then minutes. The
      // `+ 1` is what stops a timeout of zero from spinning at the boundary.
      const step = remaining >= 86400000 ? 86400000 : 60000;
      timer = setTimeout(tick, ((remaining - 1) % step) + 1);
    };

    tick();
    return () => clearTimeout(timer);
  }, [resetsAt]);

  return label;
}
