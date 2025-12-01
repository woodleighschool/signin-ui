import { type ReactElement, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Chip, Paper, Stack } from "@mui/material";
import { DataGrid, type GridColDef, type GridRowParams } from "@mui/x-data-grid";
import GroupOffIcon from "@mui/icons-material/GroupOff";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";

import { EmptyState, PageHeader } from "../components";
import { useToast } from "../hooks/useToast";
import { useUsers } from "../hooks/useQueries";

interface UserRow {
  id: string;
  displayName: string;
  upn: string;
  isAdmin: boolean;
}

const columns: GridColDef<UserRow>[] = [
  { field: "displayName", headerName: "Name", flex: 1 },
  { field: "upn", headerName: "UPN", flex: 1 },
  {
    field: "isAdmin",
    headerName: "Role",
    width: 150,
    renderCell: (parameters) => {
      if (parameters.value) {
        return (
          <Chip
            icon={<AdminPanelSettingsIcon />}
            label="Admin"
            color="primary"
            size="small"
            variant="outlined"
          />
        );
      }
      return (
        <Chip
          label="User"
          size="small"
          variant="outlined"
        />
      );
    },
  },
];

export default function Users(): ReactElement {
  const navigate = useNavigate(),
    { data: users = [], isLoading, error } = useUsers(),
    { showToast } = useToast();

  useEffect(() => {
    if (!error) {
      return;
    }

    showToast({
      message: error instanceof Error ? error.message : "Failed to load users",
      severity: "error",
    });
  }, [error, showToast]);

  const handleRowClick = (parameters: GridRowParams<UserRow>): void => {
      void navigate(`/users/${String(parameters.id)}`);
    },
    userErrorMessage = useMemo(() => {
      if (!error) {
        return;
      }
      return error instanceof Error ? error.message : "Failed to load users";
    }, [error]),
    rows: UserRow[] = useMemo(
      () =>
        users.map((user) => ({
          id: user.id,
          displayName: user.displayName,
          upn: user.upn,
          isAdmin: user.isAdmin,
        })),
      [users],
    );

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Users"
        subtitle="Manage user access from your Entra ID directory."
      />

      {userErrorMessage && <Alert severity="error">{userErrorMessage}</Alert>}

      <Paper sx={{ height: 640 }}>
        <DataGrid
          rows={rows}
          columns={columns}
          loading={isLoading}
          showToolbar
          disableRowSelectionOnClick
          onRowClick={handleRowClick}
          initialState={{
            sorting: {
              sortModel: [{ field: "displayName", sort: "asc" }],
            },
          }}
          slots={{
            noRowsOverlay: () => (
              <EmptyState
                title="No Users Found"
                description="No users are available yet. Try again after syncing with your directory."
                icon={<GroupOffIcon fontSize="inherit" />}
              />
            ),
          }}
        />
      </Paper>
    </Stack>
  );
}
