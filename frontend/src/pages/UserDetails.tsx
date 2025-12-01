import { type ChangeEvent, type ReactElement, type ReactNode, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Alert, Autocomplete, Button, Chip, FormControlLabel, Grid, LinearProgress, Stack, Switch, TextField, Typography } from "@mui/material";

import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import PlaceIcon from "@mui/icons-material/Place";

import type { DirectoryGroup, Location, UserDetailResponse } from "../api";
import { useLocations, useUpdateUser, useUserDetails } from "../hooks/useQueries";
import { EmptyState, PageHeader, SectionCard, UserSummary } from "../components";
import { useToast } from "../hooks/useToast";

interface GroupAssignmentChipsProperties {
  groups: DirectoryGroup[];
}

function GroupAssignmentChips({ groups }: GroupAssignmentChipsProperties): ReactElement {
  if (groups.length === 0) {
    return <Alert severity="info">This user is not assigned to any groups.</Alert>;
  }

  const sortedGroups = [...groups].sort((a, b) => a.displayName.localeCompare(b.displayName));

  return (
    <Stack
      direction="row"
      flexWrap="wrap"
      gap={1}
    >
      {sortedGroups.map((group) => (
        <Chip
          key={group.id}
          label={group.displayName}
          variant="outlined"
          size="small"
        />
      ))}
    </Stack>
  );
}

type ShowToast = ReturnType<typeof useToast>["showToast"];

interface UserDetailsContentProperties {
  data: UserDetailResponse;
  locations: Location[];
  userId: string;
  updateUser: ReturnType<typeof useUpdateUser>;
  showToast: ShowToast;
}

function UserDetailsContent({ data, locations, userId, updateUser, showToast }: UserDetailsContentProperties): ReactElement {
  const [selectedLocations, setSelectedLocations] = useState<string[]>(data.locationIds ?? []),
    [isAdmin, setIsAdmin] = useState(data.user.isAdmin),
    handleAdminToggle = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
      const newStatus = event.target.checked;

      setIsAdmin(newStatus);

      try {
        await updateUser.mutateAsync({ userId, payload: { isAdmin: newStatus } });
        showToast({
          message: `User is now ${newStatus ? "an Admin" : "a Standard User"}`,
          severity: "success",
        });
      } catch {
        setIsAdmin((previous) => !previous);
        showToast({ message: "Failed to update admin status", severity: "error" });
      }
    },
    handleSaveLocations = async (): Promise<void> => {
      try {
        await updateUser.mutateAsync({ userId, payload: { locationIds: selectedLocations } });
        showToast({ message: "Location access updated", severity: "success" });
      } catch {
        showToast({ message: "Failed to update location access", severity: "error" });
      }
    },
    groups = data.groups ?? [];

  return (
    <Grid
      container
      spacing={3}
    >
      <Grid size={{ xs: 12 }}>
        <SectionCard
          title="Profile"
          subheader="Directory details and group membership."
        >
          <Stack spacing={2}>
            <UserSummary user={data.user} />
            <Stack spacing={1}>
              <Typography
                variant="subtitle2"
                color="text.secondary"
              >
                Group assignments
              </Typography>
              <GroupAssignmentChips groups={groups} />
            </Stack>
          </Stack>
        </SectionCard>
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <SectionCard
          title="Role management"
          subheader="Control this user's administrative permissions."
        >
          <Stack spacing={2}>
            <Stack
              direction="row"
              alignItems="center"
              spacing={1}
            >
              <AdminPanelSettingsIcon color="primary" />
              <Typography variant="h6">Admin role</Typography>
            </Stack>

            <Typography
              variant="body2"
              color="text.secondary"
            >
              Administrators have full access to all settings, locations, and users.
            </Typography>

            <FormControlLabel
              control={
                <Switch
                  checked={isAdmin}
                  onChange={(event) => {
                    void handleAdminToggle(event);
                  }}
                />
              }
              label={isAdmin ? "Administrator" : "Standard User"}
            />
          </Stack>
        </SectionCard>
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <SectionCard
          title="Location access"
          subheader="Select which locations this user can view and manage check-ins for."
        >
          <Stack spacing={2}>
            <Stack
              direction="row"
              alignItems="center"
              spacing={1}
            >
              <PlaceIcon color="primary" />
              <Typography variant="h6">Allowed locations</Typography>
            </Stack>

            <Stack
              direction="row"
              spacing={2}
              alignItems="flex-start"
            >
              <Autocomplete
                multiple
                options={locations}
                getOptionLabel={(option) => option.name}
                value={locations.filter((l) => selectedLocations.includes(l.id))}
                onChange={(_, newValue) => {
                  setSelectedLocations(newValue.map((l) => l.id));
                }}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                disableCloseOnSelect
                renderInput={(parameters) => (
                  // @ts-expect-error MUI v7 Autocomplete params typing mismatch
                  <TextField
                    {...parameters}
                    label="Allowed locations"
                    placeholder="Select locations"
                  />
                )}
                fullWidth
              />

              <Button
                variant="contained"
                onClick={() => {
                  void handleSaveLocations();
                }}
                disabled={updateUser.isPending}
              >
                Save
              </Button>
            </Stack>
          </Stack>
        </SectionCard>
      </Grid>
    </Grid>
  );
}

export default function UserDetails(): ReactElement {
  const { userId } = useParams<{ userId: string }>(),
    { showToast } = useToast(),
    { data, isLoading, error } = useUserDetails(userId ?? ""),
    { data: locations = [] } = useLocations(),
    updateUser = useUpdateUser(),
    user = data?.user;

  useEffect(() => {
    if (!error) {
      return;
    }

    showToast({
      message: error instanceof Error ? error.message : "Failed to load user details.",
      severity: "error",
    });
  }, [error, showToast]);

  const subtitleParts = user ? [user.displayName, user.upn].filter(Boolean) : [],
    pageTitle = "User Details",
    pageSubtitle = subtitleParts.length > 0 ? subtitleParts.join(" • ") : undefined,
    breadcrumbs = [{ label: "Users", to: "/users" }, { label: user?.displayName ?? "Details" }];

  let content: ReactNode;

  if (!userId) {
    content = (
      <EmptyState
        title="Missing user identifier"
        description="Return to the users list and select a user to view details."
      />
    );
  } else if (isLoading) {
    content = <LinearProgress />;
  } else if (error) {
    const message = error instanceof Error ? error.message : "Failed to load user details.";
    content = (
      <EmptyState
        title="Unable to load user"
        description={message}
      />
    );
  } else if (data) {
    content = (
      <UserDetailsContent
        key={data.user.id}
        data={data}
        locations={locations}
        userId={userId}
        updateUser={updateUser}
        showToast={showToast}
      />
    );
  } else {
    content = (
      <EmptyState
        title="User not found"
        description={`No user found with ID ${userId}`}
      />
    );
  }

  return (
    <Stack spacing={3}>
      <PageHeader
        title={pageTitle}
        subtitle={pageSubtitle}
        breadcrumbs={breadcrumbs}
      />
      {content}
    </Stack>
  );
}
