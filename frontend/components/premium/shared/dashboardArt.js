// dashboardArt.js — icon tiles for Dashboard.js's own content (currently
// just the Recent Resumes row; the rest are kept in sync with every spot
// elsewhere in the app that already has an icon for the same concept, for
// whenever this screen needs one again). Used to be hand-drawn, multi-
// color illustrations; replaced with plain lucide icons — see
// quickActionArt.js's own note for why.
import { Home, Megaphone, FileText, CalendarCheck, Bell, Phone, Heart, CircleUser } from "lucide-react";

export const DASHBOARD_ART = {
  home: { Svg: Home },
  news: { Svg: Megaphone },
  resume: { Svg: FileText },
  interviews: { Svg: CalendarCheck },
  bell: { Svg: Bell },
  handset: { Svg: Phone },
  care: { Svg: Heart },
  profile: { Svg: CircleUser },
};
