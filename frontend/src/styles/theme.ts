import type { PaletteMode, PaletteOptions, Theme, ThemeOptions } from "@mui/material";
import { createTheme } from "@mui/material/styles";

// Theme generated with https://muiv6-theme-creator.web.app, using the "Tech Startup" preset.
const basePalette = {
    primary: {
      main: "#2563eb",
      light: "#3b82f6",
      dark: "#1e40af",
    },
    secondary: {
      main: "#0ea5e9",
      light: "#38bdf8",
      dark: "#0369a1",
    },
    error: {
      main: "#dc2626",
      light: "#ef4444",
      dark: "#991b1b",
    },
    warning: {
      main: "#f59e0b",
      light: "#fbbf24",
      dark: "#b45309",
    },
    info: {
      main: "#0284c7",
      light: "#38bdf8",
      dark: "#0369a1",
    },
    success: {
      main: "#16a34a",
      light: "#4ade80",
      dark: "#166534",
    },
    grey: {
      50: "#f8fafc",
      100: "#f1f5f9",
      200: "#e2e8f0",
      300: "#cbd5e1",
      400: "#94a3b8",
      500: "#64748b",
      600: "#475569",
      700: "#334155",
      800: "#1e293b",
      900: "#0f172a",
    },
  } satisfies PaletteOptions,
  paletteByMode: Record<PaletteMode, PaletteOptions> = {
    dark: {
      ...basePalette,
      mode: "dark",
      background: {
        default: "#121212",
        paper: "#1E1E1E",
      },
      text: {
        primary: "#ffffff",
        secondary: "rgba(255, 255, 255, 0.7)",
        disabled: "rgba(255, 255, 255, 0.5)",
      },
      divider: "rgba(255, 255, 255, 0.12)",
      action: {
        active: "rgba(255, 255, 255, 0.7)",
        hover: "rgba(255, 255, 255, 0.08)",
        selected: "rgba(255, 255, 255, 0.16)",
        disabled: "rgba(255, 255, 255, 0.3)",
        disabledBackground: "rgba(255, 255, 255, 0.12)",
      },
    },
    light: {
      ...basePalette,
      mode: "light",
      background: {
        default: "#ffffff",
        paper: "#f5f5f5",
      },
      text: {
        primary: "rgba(0, 0, 0, 0.87)",
        secondary: "rgba(0, 0, 0, 0.6)",
        disabled: "rgba(0, 0, 0, 0.38)",
      },
      divider: "rgba(0, 0, 0, 0.12)",
      action: {
        active: "rgba(0, 0, 0, 0.54)",
        hover: "rgba(0, 0, 0, 0.04)",
        selected: "rgba(0, 0, 0, 0.08)",
        disabled: "rgba(0, 0, 0, 0.26)",
        disabledBackground: "rgba(0, 0, 0, 0.12)",
      },
    },
  },
  baseThemeOptions: Omit<ThemeOptions, "palette"> = {
    typography: {
      fontFamily: '"Inter", sans-serif',
      h1: {
        fontWeight: 700,
      },
      button: {
        textTransform: "none",
      },
    },
    shape: {
      borderRadius: 16,
    },
    transitions: {
      duration: {
        standard: 300,
      },
    },
  };

export const createAppTheme = (mode: PaletteMode = "light"): Theme =>
  createTheme({
    ...baseThemeOptions,
    palette: paletteByMode[mode],
  });
