import { type ReactElement, useCallback, useEffect, useMemo, useState } from "react";
import { Box, Button, Chip, Paper, Stack, Typography } from "@mui/material";
import { useConfirm } from "material-ui-confirm";
import { DataGrid, GridActionsCellItem, type GridColDef, type GridRowParams } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import KeyIcon from "@mui/icons-material/Key";
import { format, parseISO } from "date-fns";

import type { Key } from "../api";
import { useDeleteKey, useKeys } from "../hooks/useQueries";
import { KeyDialog } from "../components/KeyDialog";
import { EmptyState, PageHeader } from "../components";
import { useToast } from "../hooks/useToast";

type DialogMode = "create" | "edit";

interface DialogConfig {
  mode: DialogMode;
  key?: Key | undefined;
}

interface KeyColumnOptions {
  onEdit: (key: Key) => void;
  onRequestDelete: (keyId: string, description: string) => Promise<void>;
  deletingKeyId: string | undefined;
}

function createKeyColumns({ onEdit, onRequestDelete, deletingKeyId }: KeyColumnOptions): GridColDef<Key>[] {
  return [
    {
      field: "description",
      headerName: "Description",
      flex: 1,
      renderCell: (parameters) => (
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          height="100%"
        >
          <KeyIcon
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
      field: "keyValue",
      headerName: "Key Value",
      flex: 1,
      sortable: false,
      renderCell: (parameters) => (
        <Typography
          variant="body2"
          sx={{ fontFamily: "monospace" }}
        >
          {parameters.value}
        </Typography>
      ),
    },
    {
      field: "locations",
      headerName: "Assigned Locations",
      flex: 1.5,
      sortable: false,
      renderCell: (parameters) => (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, py: 1 }}>
          {parameters.row.locations.map((loc) => (
            <Chip
              key={loc.id}
              label={loc.name}
              size="small"
            />
          ))}
        </Box>
      ),
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
      getActions: (parameters: GridRowParams<Key>) => [
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
          disabled={deletingKeyId === String(parameters.id)}
          onClick={() => {
            void onRequestDelete(String(parameters.id), parameters.row.description);
          }}
        />,
      ],
    },
  ];
}

export default function Keys(): ReactElement {
  const confirm = useConfirm(),
    { showToast } = useToast(),
    { data: keys = [], error: keysError, isLoading } = useKeys(),
    deleteKey = useDeleteKey(),
    [dialogConfig, setDialogConfig] = useState<DialogConfig | undefined>(),
    [deletingKeyId, setDeletingKeyId] = useState<string | undefined>(),
    dialogMode: DialogMode = dialogConfig?.mode ?? "create";

  useEffect(() => {
    if (!keysError) {
      return;
    }

    const message = keysError instanceof Error ? keysError.message : "Failed to load keys.";

    showToast({
      message,
      severity: "error",
    });
  }, [keysError, showToast]);

  const handleCreate = (): void => {
      setDialogConfig({ mode: "create" });
    },
    handleEdit = useCallback((key: Key): void => {
      setDialogConfig({ mode: "edit", key });
    }, []),
    handleCloseDialog = (): void => {
      setDialogConfig(undefined);
    },
    handleDelete = useCallback(
      async (keyId: string, description: string): Promise<void> => {
        try {
          await confirm({
            title: "Delete Key?",
            description: `Are you sure you want to delete "${description}"? This action cannot be undone.`,
            confirmationText: "Delete",
            cancellationText: "Cancel",
            confirmationButtonProps: { color: "error" },
          });

          setDeletingKeyId(keyId);
          await deleteKey.mutateAsync(keyId);

          showToast({
            message: "Key deleted successfully",
            severity: "success",
          });
        } catch (error) {
          if (error) {
            showToast({
              message: "Failed to delete key",
              severity: "error",
            });
          }
        } finally {
          setDeletingKeyId(undefined);
        }
      },
      [confirm, deleteKey, showToast],
    ),
    columns = useMemo(
      () =>
        createKeyColumns({
          onEdit: handleEdit,
          onRequestDelete: handleDelete,
          deletingKeyId,
        }),
      [handleEdit, handleDelete, deletingKeyId],
    ),
    rows = keys;

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Keys"
        subtitle="Manage portal keys for kiosk access."
        action={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreate}
          >
            New Key
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
            sorting: { sortModel: [{ field: "description", sort: "asc" }] },
          }}
          slots={{
            noRowsOverlay: () => (
              <EmptyState
                title="No Keys"
                description="Create a key to enable portal access."
                icon={<KeyIcon fontSize="inherit" />}
              />
            ),
          }}
        />
      </Paper>

      {dialogConfig && (
        <KeyDialog
          open
          mode={dialogMode}
          keyItem={dialogConfig.key ?? undefined}
          onClose={handleCloseDialog}
        />
      )}
    </Stack>
  );
}
