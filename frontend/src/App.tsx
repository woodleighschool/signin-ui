import { type ReactElement, Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { Box, Container, LinearProgress } from "@mui/material";

import { useCurrentUser, useStatus } from "./hooks/useQueries";
import { CreditsDialog, Footer, Navbar } from "./components";
import { useToast } from "./hooks/useToast";

// Lazy page imports
const Login = lazy(() => import("./pages/Login")),
  Dashboard = lazy(() => import("./pages/Dashboard")),
  Locations = lazy(() => import("./pages/Locations")),
  Users = lazy(() => import("./pages/Users")),
  Keys = lazy(() => import("./pages/Keys")),
  Checkins = lazy(() => import("./pages/Checkins")),
  Settings = lazy(() => import("./pages/Settings")),
  UserDetails = lazy(() => import("./pages/UserDetails")),
  Portal = lazy(() => import("./pages/Portal")),
  // Suspense fallback
  SuspenseFallback = (): ReactElement => (
    <Box p={2}>
      <LinearProgress />
    </Box>
  );

export default function App(): ReactElement {
  const location = useLocation(),
    isPortalRoute = location.pathname.startsWith("/portal"),
    { data: user, error } = useCurrentUser({ enabled: !isPortalRoute }),
    { data: status } = useStatus({ enabled: !isPortalRoute }),
    { showToast } = useToast(),
    [creditsOpen, setCreditsOpen] = useState(false);

  useEffect(() => {
    if (!error || isPortalRoute) {
      return;
    }

    showToast({
      message: "Failed to load user. Some features may be unavailable.",
      severity: "error",
    });
  }, [error, showToast, isPortalRoute]);

  const activeTab = useMemo(() => {
      const path = location.pathname;

      if (path === "/") {
        return "/";
      }
      if (path.startsWith("/locations")) {
        return "/locations";
      }
      if (path.startsWith("/users")) {
        return "/users";
      }
      if (path.startsWith("/keys")) {
        return "/keys";
      }
      if (path.startsWith("/checkins")) {
        return "/checkins";
      }

      return false;
    }, [location.pathname]),
    userDisplay = user?.display_name ?? "Administrator",
    userInitial = (userDisplay[0] ?? "U").toUpperCase(),
    versionLabel = status?.version.version,
    handleLogout = useCallback(async (): Promise<void> => {
      try {
        const res = await fetch("/api/auth/logout", {
          method: "POST",
          credentials: "include",
        });

        if (!res.ok) {
          throw new Error(`Logout failed: ${String(res.status)}`);
        }

        globalThis.location.href = "/";
      } catch (error_) {
        showToast({
          message: "Logout failed. Please try again.",
          severity: "error",
        });
      }
    }, [showToast]),
    handleOpenCredits = (): void => {
      setCreditsOpen(true);
    },
    handleCloseCredits = (): void => {
      setCreditsOpen(false);
    },
    handleLoginSuccess = (): void => {
      globalThis.location.reload();
    };

  if (isPortalRoute) {
    return (
      <Suspense fallback={<LinearProgress />}>
        <Routes>
          <Route
            path="/portal/:locationIdentifier"
            element={<Portal />}
          />
        </Routes>
      </Suspense>
    );
  }

  // Show login when no session
  if (!user) {
    return (
      <Suspense fallback={<SuspenseFallback />}>
        <Login onLogin={handleLoginSuccess} />
      </Suspense>
    );
  }

  // Authenticated shell
  return (
    <Box
      sx={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Navbar */}
      <Navbar
        activeTab={activeTab}
        userDisplay={userDisplay}
        userInitial={userInitial}
        onLogout={handleLogout}
      />

      {/* Page content */}
      <Container
        component="main"
        maxWidth="xl"
        sx={{
          flexGrow: 1,
          py: 4,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <Suspense fallback={<SuspenseFallback />}>
            {/* Routes */}
            <Routes>
              <Route
                path="/"
                element={<Dashboard />}
              />
              <Route
                path="/locations"
                element={<Locations />}
              />
              <Route
                path="/users"
                element={<Users />}
              />
              <Route
                path="/users/:userId"
                element={<UserDetails />}
              />
              <Route
                path="/keys"
                element={<Keys />}
              />
              <Route
                path="/checkins"
                element={<Checkins />}
              />
              <Route
                path="/settings"
                element={<Settings />}
              />
            </Routes>
          </Suspense>
        </Box>
      </Container>

      {/* Footer */}
      <Footer
        versionLabel={versionLabel}
        onOpenCredits={handleOpenCredits}
      />

      <CreditsDialog
        open={creditsOpen}
        onClose={handleCloseCredits}
      />
    </Box>
  );
}
