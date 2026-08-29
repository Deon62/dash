import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Destructive actions with a way back.
 *
 * A confirmation dialog is the weaker pattern for anything done more than
 * rarely: people learn to dismiss them, and no dialog helps someone who tapped
 * the wrong row and confirmed on autopilot. Undo does, and it costs the student
 * nothing when they meant it.
 *
 * Nothing is reversed here — the delete simply has not happened yet. The row is
 * hidden from the list, and only when the window lapses is the store told. That
 * matters more than it looks: `removeMaterial` and `removeUnit` write
 * tombstones, `sync.js` pushes those, and the server acts on them. Deferring
 * the call means an undone delete never reaches the server at all, rather than
 * being deleted and resurrected — which would be a much harder promise to keep,
 * and one this app could not keep offline.
 *
 * @param commit  Called with the item once the window lapses. The real delete.
 * @param window  How long the student has. Long enough to notice a mistake and
 *   reach the button, short enough that the strip is not still sitting there
 *   when they have moved on.
 */
export function useUndoable(commit, { window: graceMs = 6000 } = {}) {
  /** `{ item, label }`, or null. The item is hidden while this is set. */
  const [pending, setPending] = useState(null);

  const timer = useRef(null);

  /**
   * The commit path, held in a ref.
   *
   * Both the timer and the unmount cleanup fire outside the render that set
   * them up, and both must act on the item that was actually pending — not on
   * whatever a stale closure remembers.
   */
  const held = useRef(null);
  const onCommit = useRef(commit);
  onCommit.current = commit;

  const settle = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = null;

    const item = held.current;
    held.current = null;

    if (item !== null) onCommit.current?.(item);
    setPending(null);
  }, []);

  /**
   * Hides the row and starts the clock.
   *
   * A second delete while one is pending settles the first immediately rather
   * than queueing or replacing it. Queueing would need a strip per item, and
   * replacing would silently keep something the student had already deleted.
   */
  const remove = useCallback(
    (item, label) => {
      settle();

      held.current = item;
      setPending({ item, label });
      timer.current = setTimeout(settle, graceMs);
    },
    [graceMs, settle],
  );

  const undo = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = null;
    held.current = null;
    setPending(null);
  }, []);

  /**
   * Leaving the screen commits.
   *
   * The alternative — cancelling on unmount — means a student who deletes
   * something and immediately navigates away finds it still there when they
   * come back, having done nothing to bring it back. A delete they walked away
   * from is a delete they meant.
   */
  useEffect(() => settle, [settle]);

  return {
    /** `{ item, label }` while a delete is waiting, else null. */
    pending,
    /** Hide a row and start the window. */
    remove,
    /** Put it back. */
    undo,
    /** Id currently hidden, or null — for filtering the list. */
    hiddenId: pending?.item?.id ?? null,
  };
}
