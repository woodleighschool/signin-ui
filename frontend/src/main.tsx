import React, { type ErrorInfo, type ReactElement, useMemo } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CssBaseline, type PaletteMode, ThemeProvider, useMediaQuery } from "@mui/material";
import { ConfirmProvider } from "material-ui-confirm";
import { SnackbarProvider } from "notistack";

import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { createAppTheme } from "./styles/theme";

// React Query defaults
const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
      },
    },
  }),
  // ErrorBoundary callback placeholder
  handleError = (error: Error, info: ErrorInfo): void => {};

// App providers
export function Root(): ReactElement {
  const prefersDark = useMediaQuery("(prefers-color-scheme: dark)"),
    mode: PaletteMode = prefersDark ? "dark" : "light",
    theme = useMemo(() => createAppTheme(mode), [mode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ConfirmProvider>
        <SnackbarProvider
          maxSnack={3}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        >
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </SnackbarProvider>
      </ConfirmProvider>
    </ThemeProvider>
  );
}

// Mount app
ReactDOM.createRoot(document.querySelector("#root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary onError={handleError}>
      <QueryClientProvider client={queryClient}>
        <Root />
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
