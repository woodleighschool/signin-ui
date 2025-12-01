import { type ReactElement, useCallback, useEffect, useMemo, useState } from "react";
import { Button, Paper, Stack, Typography } from "@mui/material";
import { useConfirm } from "material-ui-confirm";
import { DataGrid, GridActionsCellItem, type GridColDef, type GridRowParams } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import PlaceIcon from "@mui/icons-material/Place";
import { format, parseISO } from "date-fns";

import type { Location } from "../api";
import { useDeleteLocation, useLocations } from "../hooks/useQueries";
import { LocationDialog } from "../components/LocationDialog";
import { EmptyState, PageHeader } from "../components";
import { useToast } from "../hooks/useToast";

type DialogMode = "create" | "edit";

interface DialogConfig {
  mode: DialogMode;
  location?: Location | undefined;
}

interface LocationColumnOptions {
  onEdit: (location: Location) => void;
  onRequestDelete: (locationId: string, locationName: string) => Promise<void>;
  deletingLocationId: string | undefined;
}

function createLocationColumns({ onEdit, onRequestDelete, deletingLocationId }: LocationColumnOptions): GridColDef<Location>[] {
  return [
    {
      field: "name",
      headerName: "Name",
      flex: 1,
      renderCell: (parameters) => (
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          height="100%"
        >
          <PlaceIcon
            fontSize="small"
            color="action"
          />
          <Typography
            variant="body2"
            fontWeight="medium"
          >
            {parameters.value}
          </Typography>
        </Stack>
      ),
    },
    {
      field: "identifier",
      headerName: "Identifier",
      flex: 1,
    },
    {
      field: "createdAt",
      headerName: "Created At",
      flex: 1,
      valueFormatter: (value) => format(parseISO(value), "PP p"),
    },
    {
      field: "actions",
      type: "actions",
      getActions: (parameters: GridRowParams<Location>) => [
        <GridActionsCellItem
          key="edit"
          showInMenu
          icon={<EditIcon />}
          label="Edit"
          onClick={() => {
            onEdit(parameters.row);
          }}
        />,
        <GridActionsCellItem
          key="delete"
          showInMenu
          icon={<DeleteIcon color="error" />}
          label="Delete"
          disabled={deletingLocationId === String(parameters.id)}
          onClick={() => {
            void onRequestDelete(String(parameters.id), parameters.row.name);
          }}
        />,
      ],
    },
  ];
}

export default function Locations(): ReactElement {
  const confirm = useConfirm(),
    { showToast } = useToast(),
    { data: locations = [], error: locationsError, isLoading } = useLocations(),
    deleteLocation = useDeleteLocation(),
    [dialogConfig, setDialogConfig] = useState<DialogConfig | undefined>(),
    [deletingLocationId, setDeletingLocationId] = useState<string | undefined>(),
    dialogMode: DialogMode = dialogConfig?.mode ?? "create";

  useEffect(() => {
    if (!locationsError) {
      return;
    }

    const message = locationsError instanceof Error ? locationsError.message : "Failed to load locations.";

    showToast({
      message,
      severity: "error",
    });
  }, [locationsError, showToast]);

  const handleCreate = (): void => {
      setDialogConfig({ mode: "create" });
    },
    handleEdit = useCallback((location: Location): void => {
      setDialogConfig({ mode: "edit", location });
    }, []),
    handleCloseDialog = (): void => {
      setDialogConfig(undefined);
    },
    handleDelete = useCallback(
      async (locationId: string, locationName: string): Promise<void> => {
        try {
          await confirm({
            title: "Delete Location?",
            description: `Are you sure you want to delete "${locationName}"? This action cannot be undone.`,
            confirmationText: "Delete",
            cancellationText: "Cancel",
            confirmationButtonProps: { color: "error" },
          });

          setDeletingLocationId(locationId);
          await deleteLocation.mutateAsync(locationId);

          showToast({
            message: "Location deleted successfully",
            severity: "success",
          });
        } catch (error) {
          if (error) {
            showToast({
              message: "Failed to delete location",
              severity: "error",
            });
          }
        } finally {
          setDeletingLocationId(undefined);
        }
      },
      [confirm, deleteLocation, showToast],
    ),
    columns = useMemo(
      () =>
        createLocationColumns({
          onEdit: handleEdit,
          onRequestDelete: handleDelete,
          deletingLocationId,
        }),
      [handleEdit, handleDelete, deletingLocationId],
    ),
    rows = locations;

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Locations"
        subtitle="Manage physical locations where users can check in."
        action={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreate}
          >
            New Location
          </Button>
        }
      />

      <Paper sx={{ height: 640, width: "100%" }}>
        <DataGrid
          rows={rows}
          columns={columns}
          loading={isLoading}
          showToolbar
          disableRowSelectionOnClick
          initialState={{
            sorting: {
              sortModel: [{ field: "name", sort: "asc" }],
            },
          }}
          slots={{
            noRowsOverlay: () => (
              <EmptyState
                title="No Locations"
                description="Create a location to start tracking check-ins."
                icon={<PlaceIcon fontSize="inherit" />}
              />
            ),
          }}
        />
      </Paper>

      {dialogConfig && (
        <LocationDialog
          open
          mode={dialogMode}
          location={dialogConfig.location ?? undefined}
          onClose={handleCloseDialog}
        />
      )}
    </Stack>
  );
}
