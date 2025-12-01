import { type ReactElement, useEffect, useMemo } from "react";
import { Box, Button, Card, CardActionArea, CardContent, CardHeader, Grid, LinearProgress, Stack, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import PlaceIcon from "@mui/icons-material/Place";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import PeopleIcon from "@mui/icons-material/People";
import HistoryIcon from "@mui/icons-material/History";

import { PageHeader } from "../components";
import { useKeys, useLocations, useUsers } from "../hooks/useQueries";
import { useToast } from "../hooks/useToast";

export default function Dashboard(): ReactElement {
  const navigate = useNavigate(),
    { showToast } = useToast(),
    { data: locations = [], error: locationsError, isLoading: locationsLoading } = useLocations(),
    { data: keys = [], error: keysError, isLoading: keysLoading } = useKeys(),
    { data: users = [], error: usersError, isLoading: usersLoading } = useUsers(),
    stats = useMemo(
      () => [
        {
          label: "Locations",
          value: locationsLoading ? "..." : locations.length,
          icon: (
            <PlaceIcon
              fontSize="large"
              color="primary"
            />
          ),
          path: "/locations",
        },
        {
          label: "Active Keys",
          value: keysLoading ? "..." : keys.length,
          icon: (
            <VpnKeyIcon
              fontSize="large"
              color="secondary"
            />
          ),
          path: "/keys",
        },
        {
          label: "Users",
          value: usersLoading ? "..." : users.length,
          icon: (
            <PeopleIcon
              fontSize="large"
              color="success"
            />
          ),
          path: "/users",
        },
      ],
      [keys.length, keysLoading, locations.length, locationsLoading, users.length, usersLoading],
    );

  useEffect(() => {
    if (!locationsError) {
      return;
    }
    const message = locationsError instanceof Error ? locationsError.message : "Failed to load locations.";
    showToast({ message, severity: "error" });
  }, [locationsError, showToast]);

  useEffect(() => {
    if (!keysError) {
      return;
    }
    const message = keysError instanceof Error ? keysError.message : "Failed to load keys.";
    showToast({ message, severity: "error" });
  }, [keysError, showToast]);

  useEffect(() => {
    if (!usersError) {
      return;
    }
    const message = usersError instanceof Error ? usersError.message : "Failed to load users.";
    showToast({ message, severity: "error" });
  }, [showToast, usersError]);

  const statsLoading = locationsLoading || keysLoading || usersLoading;

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Dashboard"
        subtitle="Overview of your Signin UI system"
      />

      <Card elevation={1}>
        <CardHeader
          title="System Summary"
          subheader="Key totals across your deployment."
        />

        {statsLoading && <LinearProgress />}

        <CardContent>
          <Grid
            container
            spacing={3}
          >
            {stats.map((stat) => (
              <Grid
                size={{ xs: 12, sm: 6, md: 4 }}
                key={stat.label}
              >
                <Card variant="outlined">
                  <CardActionArea
                    onClick={() => {
                      void navigate(stat.path);
                    }}
                  >
                    <CardContent>
                      <Stack
                        direction="row"
                        alignItems="center"
                        justifyContent="space-between"
                        spacing={2}
                      >
                        <Box>
                          <Typography
                            variant="body2"
                            color="text.secondary"
                          >
                            {stat.label}
                          </Typography>
                          <Typography variant="h4">{stat.value}</Typography>
                        </Box>
                        {stat.icon}
                      </Stack>
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      <Card elevation={1}>
        <CardHeader
          title="Check-in Logs"
          subheader="Review history across all locations."
        />
        <CardContent>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            alignItems={{ xs: "flex-start", sm: "center" }}
            justifyContent="space-between"
            spacing={2}
          >
            <Stack
              direction="row"
              spacing={2}
              alignItems="center"
            >
              <HistoryIcon color="action" />
              <Typography color="text.secondary">View recent check-ins to monitor activity.</Typography>
            </Stack>

            <Button
              variant="contained"
              startIcon={<HistoryIcon />}
              onClick={() => {
                void navigate("/checkins");
              }}
            >
              View Checkins
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
