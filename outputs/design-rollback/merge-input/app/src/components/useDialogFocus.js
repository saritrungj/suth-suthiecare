import { useEffect, useRef } from "react";

// Focus handling shared by the app's own dialogs and drawers:
// - opening focuses the first editable field in the body, else the close
//   button;
// - Tab and Shift+Tab stay inside the dialog (`onKeyDown` from the return
//   value goes on the dialog element);
// - everything else on the page is inert while the dialog is the top one;
// - Escape closes only the top dialog, and only while focus is inside it
//   (a SweetAlert or a sub-dialog keeps its own Escape);
// - closing returns focus to the control that opened it.

// Stack of open dialogs, top-most last: { id, node }.
const openDialogs = [];

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export const focusablesIn = (root) =>
  [...root.querySelectorAll(FOCUSABLE)].filter(
    (el) => el.getClientRects().length > 0 && !el.closest("[inert]"),
  );

// Only the inert flags set here are removed again.
function syncInert() {
  const alert = document.querySelector(
    '.swal2-container:has(.swal2-popup[role="dialog"])',
  );
  const top = alert || openDialogs.at(-1)?.node;
  [...document.body.children].forEach((element) => {
    if (["SCRIPT", "STYLE", "LINK"].includes(element.tagName)) return;
    if (top && element !== top) {
      if (!element.inert) {
        element.inert = true;
        element.dataset.dialogInert = "true";
      }
    } else if (element.dataset.dialogInert) {
      element.inert = false;
      delete element.dataset.dialogInert;
    }
  });
}

export function useDialogFocus({
  id,
  overlayRef,
  dialogRef,
  closeButtonRef,
  onClose,
  initialFocus = "field",
}) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const isTop = () => openDialogs.at(-1)?.id === id;

  useEffect(() => {
    const opener = document.activeElement;
    openDialogs.push({ id, node: overlayRef.current });
    syncInert();
    // SweetAlert dialogs are body portals too. Keep only the top dialog
    // interactive while an error/confirmation is open above this one.
    const observer = new MutationObserver(syncInert);
    observer.observe(document.body, { childList: true });
    const dialog = dialogRef.current;
    const firstField =
      initialFocus === "field"
        ? [
            ...dialog.querySelectorAll(
              "[data-dialog-body] :is(input, select, textarea)",
            ),
          ].find(
            (el) =>
              !el.disabled &&
              !el.readOnly &&
              el.type !== "hidden" &&
              el.getClientRects().length > 0,
          )
        : null;
    (firstField || closeButtonRef.current)?.focus({ preventScroll: true });

    const onKey = (event) => {
      if (event.key !== "Escape" || !isTop()) return;
      const active = document.activeElement;
      if (active && active !== document.body && !dialog.contains(active))
        return;
      closeRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      observer.disconnect();
      const index = openDialogs.findIndex((entry) => entry.id === id);
      if (index !== -1) openDialogs.splice(index, 1);
      syncInert();
      if (opener?.isConnected && typeof opener.focus === "function")
        opener.focus({ preventScroll: true });
    };
    // The dialog mounts once per id; refs are stable.
  }, [id]);

  const onKeyDown = (event) => {
    if (event.key !== "Tab" || !isTop()) return;
    const items = focusablesIn(dialogRef.current);
    if (!items.length) {
      event.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (
      event.shiftKey &&
      (active === first || !dialogRef.current.contains(active))
    ) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return { onKeyDown };
}
