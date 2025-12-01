import { type ReactElement, type ReactNode, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Alert, Autocomplete, Box, Button, Card, CardContent, CircularProgress, Container, Stack, TextField, Typography } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import Fuse from "fuse.js";

import { usePortalCheckin, usePortalConfig } from "../hooks/useQueries";
import { Logo } from "../components/Logo";

interface PortalUser {
  id: string;
  displayName: string;
}

interface PortalCheckinPayload {
  locationIdentifier: string;
  key: string;
  userId: string;
  direction: "in" | "out";
  notes?: string;
}

interface PortalLayoutProperties {
  children: ReactNode;
  backgroundImageUrl?: string;
}

function PortalLayout({ children, backgroundImageUrl }: PortalLayoutProperties): ReactElement {
  return (
    <Box
      sx={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        px: 2,
        backgroundColor: "background.default",
        backgroundImage: backgroundImageUrl ? `url(${backgroundImageUrl})` : "var(--portal-background-image, none)",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <Container maxWidth="sm">
        <Card elevation={2}>
          <CardContent>
            <Stack spacing={3}>{children}</Stack>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}

export default function Portal(): ReactElement {
  const { locationIdentifier } = useParams<{ locationIdentifier?: string }>(),
    [searchParameters] = useSearchParams(),
    key = searchParameters.get("key") ?? "",
    locationParameter = locationIdentifier ?? "",
    { data: config, isLoading, error } = usePortalConfig(locationParameter, key),
    portalCheckin = usePortalCheckin(),
    backgroundImageUrl = config?.backgroundImageUrl,
    portalLayoutProperties = backgroundImageUrl ? { backgroundImageUrl } : {},
    [selectedUser, setSelectedUser] = useState<PortalUser | null>(null),
    [notes, setNotes] = useState(""),
    [successMessage, setSuccessMessage] = useState<string | undefined>(),
    [searchQuery, setSearchQuery] = useState(""),
    users: PortalUser[] = config?.users ?? [],
    fuse =
      users.length === 0
        ? undefined
        : new Fuse(users, {
            keys: ["displayName"],
            threshold: 0.3,
            ignoreLocation: true,
          }),
    hasValidParameters = Boolean(locationParameter && key),
    portalErrorMessage = useMemo(() => {
      if (!error) {
        return;
      }
      return error instanceof Error ? error.message : "Failed to load portal configuration. Please check your key.";
    }, [error]),
    checkinErrorMessage = useMemo(() => {
      if (!portalCheckin.isError) {
        return;
      }

      const error_ = portalCheckin.error;
      return error_ instanceof Error ? error_.message : "Check-in failed. Please try again.";
    }, [portalCheckin.error, portalCheckin.isError]);

  useEffect(() => {
    if (!successMessage) {
      return;
    }

    const timer = setTimeout(() => {
      setSuccessMessage(undefined);
      setSelectedUser(null);
      setNotes("");
      setSearchQuery("");
    }, 3000);

    return () => {
      clearTimeout(timer);
    };
  }, [successMessage]);

  const handleCheckin = async (direction: "in" | "out"): Promise<void> => {
    if (!selectedUser) {
      return;
    }

    const payload: PortalCheckinPayload = {
      locationIdentifier: locationParameter,
      key,
      userId: selectedUser.id,
      direction,
    };

    if (config?.location.notesEnabled) {
      const trimmedNotes = notes.trim();
      if (trimmedNotes) {
        payload.notes = trimmedNotes;
      }
    }

    try {
      await portalCheckin.mutateAsync(payload);
      setSuccessMessage(`Checked ${direction} ${selectedUser.displayName}`);
    } catch {
      // Errors surface via mutation state
    }
  };

  // Missing params
  if (!hasValidParameters) {
    return (
      <PortalLayout {...portalLayoutProperties}>
        <Stack
          spacing={2}
          alignItems="center"
        >
          <Logo sx={{ fontSize: 48 }} />
          <Typography
            variant="h6"
            align="center"
          >
            Invalid portal URL
          </Typography>
          <Alert
            severity="error"
            sx={{ width: "100%" }}
          >
            Missing location or key in the URL.
          </Alert>
        </Stack>
      </PortalLayout>
    );
  }

  // Loading
  if (isLoading) {
    return (
      <PortalLayout {...portalLayoutProperties}>
        <Stack
          spacing={3}
          alignItems="center"
        >
          <Logo sx={{ fontSize: 48 }} />
          <Typography variant="h6">Loading portal…</Typography>
          <CircularProgress />
        </Stack>
      </PortalLayout>
    );
  }

  // Error
  if (portalErrorMessage) {
    return (
      <PortalLayout {...portalLayoutProperties}>
        <Stack
          spacing={2}
          alignItems="center"
        >
          <Logo sx={{ fontSize: 48 }} />
          <Typography
            variant="h6"
            align="center"
          >
            Unable to load portal
          </Typography>
          <Alert
            severity="error"
            sx={{ width: "100%" }}
          >
            {portalErrorMessage}
          </Alert>
        </Stack>
      </PortalLayout>
    );
  }

  // Success
  if (successMessage) {
    return (
      <PortalLayout {...portalLayoutProperties}>
        <Stack
          spacing={3}
          alignItems="center"
        >
          <Logo sx={{ fontSize: 48 }} />
          <CheckCircleIcon
            color="success"
            sx={{ fontSize: 64 }}
          />
          <Typography
            variant="h5"
            align="center"
          >
            {successMessage}
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            align="center"
          >
            You are now checked in.
          </Typography>
        </Stack>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout {...portalLayoutProperties}>
      <Stack spacing={3}>
        {/* Header */}
        <Stack spacing={1}>
          <Stack
            direction="row"
            spacing={1.25}
            alignItems="center"
          >
            <Logo sx={{ fontSize: 40 }} />
            <Typography
              variant="h5"
              component="h1"
              fontWeight={600}
              noWrap
            >
              {config?.location.name}
            </Typography>
          </Stack>

          <Typography
            variant="body2"
            color="text.secondary"
          >
            Select your name to check in.
          </Typography>
        </Stack>

        {/* User selection */}
        <Autocomplete
          options={users}
          value={selectedUser}
          onChange={(_, newValue) => {
            setSelectedUser(newValue ?? null);
          }}
          inputValue={searchQuery}
          onInputChange={(_, value) => {
            setSearchQuery(value);
          }}
          filterOptions={(options) => {
            if (!fuse || !searchQuery.trim()) {
              return options;
            }

            return fuse.search(searchQuery).map((result) => result.item);
          }}
          getOptionLabel={(option) => option?.displayName ?? ""}
          isOptionEqualToValue={(option, value) => option?.id === value?.id}
          fullWidth
          renderInput={(parameters) => (
            // @ts-expect-error MUI v7 Autocomplete params typing mismatch
            <TextField
              {...parameters}
              label="Search for your name"
              placeholder="Start typing to search…"
              fullWidth
              autoFocus
            />
          )}
        />

        {/* Notes */}
        {config?.location.notesEnabled && (
          <TextField
            label="Notes"
            placeholder="Add a note (optional)"
            multiline
            minRows={2}
            value={notes}
            onChange={(event) => {
              setNotes(event.target.value);
            }}
            fullWidth
            disabled={portalCheckin.isPending}
          />
        )}

        {/* Check-in/out buttons */}
        <Stack
          direction="row"
          spacing={2}
        >
          <Button
            variant="contained"
            color="success"
            fullWidth
            disabled={!selectedUser || portalCheckin.isPending}
            onClick={() => {
              void handleCheckin("in");
            }}
          >
            {portalCheckin.isPending ? "Processing…" : "Check In"}
          </Button>
          <Button
            variant="contained"
            color="warning"
            fullWidth
            disabled={!selectedUser || portalCheckin.isPending}
            onClick={() => {
              void handleCheckin("out");
            }}
          >
            {portalCheckin.isPending ? "Processing…" : "Check Out"}
          </Button>
        </Stack>

        {/* Error from mutation */}
        {checkinErrorMessage && <Alert severity="error">{checkinErrorMessage}</Alert>}
      </Stack>
    </PortalLayout>
  );
}
