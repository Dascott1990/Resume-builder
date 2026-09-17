"use client";
/**
 * BottomSheet.js — generic version of guest/components/StyleBottomSheet.js:
 * the live-preview-stays-visible editing pattern, extracted so anything
 * outside Guest Mode (starting with /brand's Story tool) can reuse it
 * instead of re-implementing the same framer-motion sheet chrome.
 * StyleBottomSheet.js is now a thin wrapper around this.
 *
 * The preview underneath stays the permanent base view the whole time —
 * this sheet is a fixed-position overlay sibling, not a replacement of
 * it in the layout tree — capped at max-h-[64vh] so a meaningful strip
 * at the top of the screen (wherever the caller's preview lives) is
 * always visible above it. Deliberately no dark scrim: the point is
 * seeing the live result clearly while adjusting it, and dimming it
 * would work against that.
 *
 * The drag gesture is wired to the handle only (useDragControls +
 * dragListener={false} on the sheet itself), not the whole sheet — a
 * naive drag="y" on the full container intercepts pointer events meant
 * for whatever controls live inside it, a well-known framer-motion trap.
 */
import { useRef } from "react";
import { motion, useDragControls, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";

export function BottomSheet({ open, onClose, title, children }) {
  const dragControls = useDragControls();
  const sheetRef = useRef(null);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={sheetRef}
          role="dialog"
          aria-label={title}
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
            <span className="text-[15px] font-bold text-foreground">{title}</span>
            <button
              onClick={onClose}
              className="flex h-8 items-center gap-1.5 rounded-full border-none bg-primary px-3.5 text-[13px] font-bold text-primary-foreground [-webkit-tap-highlight-color:transparent]"
            >
              <Check className="size-3.5" />
              Done
            </button>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
