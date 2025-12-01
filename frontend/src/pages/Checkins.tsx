import { type ReactElement, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Paper, Stack, Chip } from "@mui/material";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import HistoryIcon from "@mui/icons-material/History";
import { format, parseISO } from "date-fns";

import type { Checkin } from "../api";
import { EmptyState, PageHeader } from "../components";
import { useCheckins } from "../hooks/useQueries";
import { useToast } from "../hooks/useToast";

import ArrowCircleUpRoundedIcon from "@mui/icons-material/ArrowCircleUpRounded";
import ArrowCircleDownRoundedIcon from "@mui/icons-material/ArrowCircleDownRounded";

function createCheckinColumns(): GridColDef<Checkin>[] {
  return [
    {
      field: "occurredAt",
      headerName: "Time",
      flex: 1,
      sortable: true,
      valueFormatter: (value) => format(parseISO(value), "PP p"),
    },
    {
      field: "userDisplayName",
      headerName: "User",
      flex: 1,
    },
    {
      field: "userDepartment",
      headerName: "Department",
      flex: 1,
      renderCell: (parameters) => parameters.row.userDepartment,
    },
    {
      field: "locationName",
      headerName: "Location",
      flex: 1,
    },
    {
      field: "direction",
      headerName: "Direction",
      flex: 0.5,
      renderCell: ({ value }) => {
        if (value === "in") {
          return (
            <Chip
              label="In"
              color="success"
              icon={<ArrowCircleUpRoundedIcon />}
              size="small"
              variant="outlined"
            />
          );
        }

        if (value === "out") {
          return (
            <Chip
              label="Out"
              color="error"
              icon={<ArrowCircleDownRoundedIcon />}
              size="small"
              variant="outlined"
            />
          );
        }

        return value;
      },
    },
    {
      field: "notes",
      headerName: "Notes",
      flex: 1.5,
      filterable: false,
    },
  ];
}

export default function Checkins(): ReactElement {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { data: checkins = [], error: checkinsError, isLoading } = useCheckins();

  useEffect(() => {
    if (!checkinsError) {return;}

    const message = checkinsError instanceof Error ? checkinsError.message : "Failed to load checkins.";

    showToast({
      message,
      severity: "error",
    });
  }, [checkinsError, showToast]);

  const columns = useMemo(() => createCheckinColumns(), []);

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Checkins"
        subtitle="Audit log of all user check-in activity."
      />

      <Paper sx={{ height: 640, width: "100%" }}>
        <DataGrid
          rows={checkins}
          columns={columns}
          loading={isLoading}
          showToolbar
          disableRowSelectionOnClick
          initialState={{
            sorting: { sortModel: [{ field: "occurredAt", sort: "desc" }] },
          }}
          slots={{
            noRowsOverlay: () => (
              <EmptyState
                title="No Checkins"
                description="No check-in activity recorded yet."
                icon={<HistoryIcon fontSize="inherit" />}
              />
            ),
          }}
        />
      </Paper>
    </Stack>
  );
}
