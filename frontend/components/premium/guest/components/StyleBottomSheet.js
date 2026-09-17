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
 * Thin wrapper around the generic shared/BottomSheet.js (extracted from
 * this file so /brand's Story tool could reuse the same pattern without
 * duplicating the sheet chrome) — this file now only supplies the title
 * and the Style-specific content.
 */
import { BottomSheet } from "@/components/premium/shared/BottomSheet";
import { StyleTab } from "./PanelContent/StyleTab";

export function StyleBottomSheet({ open, onClose, docStyle, setDocStyle }) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Style">
      {/* isDesktop=true here isn't a lie about the viewport — it just
          tells StyleTab a live preview is already visible, so it skips
          its own "Preview changes" jump-away button, same as it does for
          the tablet/desktop split view. */}
      <StyleTab docStyle={docStyle} setDocStyle={setDocStyle} isDesktop={true} />
    </BottomSheet>
  );
}
