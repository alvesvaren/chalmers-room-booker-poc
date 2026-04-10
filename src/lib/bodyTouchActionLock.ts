/**
 * Prevents the browser from turning pointer drags into page scroll (touch / trackpad).
 * Call the returned function on pointer up / cancel.
 */
export function lockBodyTouchActionForPointerDrag(): () => void {
  const prev = document.body.style.touchAction;
  document.body.style.touchAction = "none";
  return () => {
    if (prev) {
      document.body.style.touchAction = prev;
    } else {
      document.body.style.removeProperty("touch-action");
    }
  };
}
