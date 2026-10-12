// quickActionArt.js — Dashboard.js's QuickAction tiles (Auto Apply / CV
// Scan / Tracker / Jobs Board). Used to be hand-drawn, multi-color
// illustrations; replaced with plain lucide icons so these tiles read as
// sharp and clean as every other icon in the app (NavRail, MobileFloating
// Nav) instead of standing out as a different, busier style at small
// sizes. Reuses the exact same icon each concept already has elsewhere
// (ClipboardList for Tracker, Briefcase for Jobs Board) instead of a
// second, different glyph for the same idea.
import { Send, ScanSearch, ClipboardList, Briefcase } from "lucide-react";

export const QUICK_ACTION_ART = {
  apply: { Svg: Send },
  scan: { Svg: ScanSearch },
  tracker: { Svg: ClipboardList },
  jobsboard: { Svg: Briefcase },
};
