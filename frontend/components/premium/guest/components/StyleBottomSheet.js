"use client";
/**
 * StyleBottomSheet.js — phone's answer to the same problem tablet/desktop
 * solve with a side-by-side split (see GuestMode.js's showSplit): edit
 * style, see the result immediately, no navigating away. A phone is too
 * narrow to show a sidebar AND a legible preview at once, so instead the
 * resume preview stays the full-screen base the whole time, and this sheet
 * slides up over its bottom ~60% — every tap on a layout/font/color control
 * updates the resume still visible in the strip above it.
 *
 * Deliberately no dark scrim behind the sheet — the entire point is seeing
 * the live resume clearly while adjusting it, and dimming it would work
 * against that. Dismiss via the "Done" button or by dragging the handle
 * down; a light peachy-quiet is closer to the reference and doesn't need it.
 *
 * The drag gesture is wired to the handle only (useDragControls +
 * dragListener={false} on the sheet itself), not the whole sheet — a naive
 * drag="y" on the full container intercepts pointer events meant for the
 * sliders and color swatches inside it, a well-known framer-motion trap.
 */
import { useRef } from "react";
import { motion, useDragControls, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import { StyleTab } from "./PanelContent/StyleTab";

export function StyleBottomSheet({ open, onClose, docStyle, setDocStyle }) {
  const dragControls = useDragControls();
  const sheetRef = useRef(null);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={sheetRef}
          role="dialog"
          aria-label="Resume style"
          drag="y"
          dragListener={false}
          dragControls={dragControls}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.55 }}
          onDragEnd={(_, info) => {
            if (info.offset.y > 110 || info.velocity.y > 500) onClose();
          }}
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 28, stiffness: 320 }}
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[64vh] flex-col rounded-t-[22px] border border-b-0 border-white/[0.12] bg-card shadow-[0_-14px_50px_rgba(0,0,0,0.5)]"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          {/* Drag handle — the only part that starts the drag gesture */}
          <div
            onPointerDown={(e) => dragControls.start(e)}
            className="flex shrink-0 cursor-grab touch-none flex-col items-center pt-2.5 pb-1 active:cursor-grabbing"
          >
            <div className="h-1 w-9 rounded-full bg-border" />
          </div>

          <div className="flex shrink-0 items-center justify-between border-b border-border px-4 pt-1.5 pb-3">
            <span className="text-[15px] font-bold text-foreground">Style</span>
            <button
              onClick={onClose}
              className="flex h-8 items-center gap-1.5 rounded-full border-none bg-primary px-3.5 text-[13px] font-bold text-primary-foreground [-webkit-tap-highlight-color:transparent]"
            >
              <Check className="size-3.5" />
              Done
            </button>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
            {/* isDesktop=true here isn't a lie about the viewport — it just
                tells StyleTab a live preview is already visible, so it
                skips its own "Preview changes" jump-away button, same as
                it does for the tablet/desktop split view. */}
            <StyleTab docStyle={docStyle} setDocStyle={setDocStyle} isDesktop={true} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
