export const ACCENTS = [
  { id: "navy",   hex: "#1F3864", label: "Navy"    },
  { id: "black",  hex: "#1A1A1A", label: "Classic" },
  { id: "teal",   hex: "#0D5C6B", label: "Teal"    },
  { id: "forest", hex: "#1E4D2B", label: "Forest"  },
  { id: "wine",   hex: "#6B1A3A", label: "Wine"    },
  { id: "steel",  hex: "#2C4A6B", label: "Steel"   },
];

export const FONTS = [
  { id: "calibri",   label: "Calibri",         css: "Calibri, 'Gill Sans', sans-serif" },
  { id: "times",     label: "Times New Roman",  css: "'Times New Roman', Times, serif" },
  { id: "arial",     label: "Arial",            css: "Arial, Helvetica, sans-serif" },
  { id: "garamond",  label: "Garamond",         css: "Garamond, 'EB Garamond', Georgia, serif" },
  { id: "georgia",   label: "Georgia",          css: "Georgia, 'Times New Roman', serif" },
  { id: "helvetica", label: "Helvetica",        css: "Helvetica, Arial, sans-serif" },
];

export const DEFAULT_STYLE = { accent: "navy", fontSize: 11, lineHeight: 1.4, font: "calibri", layout: "classic" };

export const EMPTY_INFO = {
  name: "", title: "", location: "", email: "", phone: "",
  background: "", experience: "", education: "", skills: "",
};
