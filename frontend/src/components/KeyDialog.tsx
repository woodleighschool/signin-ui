import { type ReactElement, useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  Autocomplete,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  LinearProgress,
  Stack,
  TextField,
} from "@mui/material";
import KeyIcon from "@mui/icons-material/VpnKey";
import RefreshIcon from "@mui/icons-material/Autorenew";

import { ApiValidationError, type Key } from "../api";
import { useCreateKey, useLocations, useUpdateKey } from "../hooks/useQueries";
import { useToast } from "../hooks/useToast";

export interface KeyFormValues {
  description: string;
  locationIds: string[];
  keyValue?: string;
}

type KeyDialogMode = "create" | "edit";

const defaultValues: KeyFormValues = {
  description: "",
  locationIds: [],
  keyValue: "",
};

interface KeyDialogProperties {
  open: boolean;
  mode?: KeyDialogMode;
  keyItem?: Key | undefined;
  onClose: () => void;
}

export function KeyDialog({ open, mode = "create", keyItem, onClose }: KeyDialogProperties): ReactElement {
  const editing = mode === "edit",
    createKey = useCreateKey(),
    updateKey = useUpdateKey(),
    { data: locations = [] } = useLocations(),
    { showToast } = useToast(),
    form = useForm<KeyFormValues>({
      defaultValues,
    }),
    {
      register,
      control,
      handleSubmit,
      reset,
      setError,
      clearErrors,
      setValue,
      formState: { isSubmitting, errors },
    } = form;

  useEffect(() => {
    if (!open) {
      return;
    }

    if (editing && keyItem) {
      reset({
        description: keyItem.description,
        locationIds: keyItem.locations.map((l) => l.id),
        keyValue: keyItem.keyValue,
      });
    } else {
      reset(defaultValues);
    }

    clearErrors();
  }, [open, editing, keyItem, reset, clearErrors]);

  const dialogTitle = editing ? "Edit Key" : "Create Key",
    submitLabel = editing ? "Save Changes" : "Create",
    submittingLabel = editing ? "Saving..." : "Creating...",
    generateKeyValue = (): string => {
      const bytes = new Uint8Array(24);
      crypto.getRandomValues(bytes);
      const base64 = btoa(String.fromCharCode(...bytes))
        .replaceAll("+", "-")
        .replaceAll("/", "_")
        .replace(/=+$/, "");
      return base64;
    },
    onSubmit = async (formData: KeyFormValues): Promise<void> => {
      clearErrors();

      try {
        const payload = {
          description: formData.description,
          locationIds: formData.locationIds,
          keyValue: formData.keyValue?.trim() ?? "",
        };

        if (editing && !payload.keyValue) {
          setError("keyValue", {
            type: "server",
            message: "Key value is required when editing.",
          });
          return;
        }

        if (editing) {
          if (!keyItem?.id) {
            throw new Error("Missing key identifier.");
          }
          await updateKey.mutateAsync({ id: keyItem.id, payload });
          showToast({ message: "Key updated successfully", severity: "success" });
        } else {
          await createKey.mutateAsync(payload);
          showToast({ message: "Key created successfully", severity: "success" });
        }

        onClose();
      } catch (error) {
        if (error instanceof ApiValidationError) {
          for (const [field, message] of Object.entries(error.fieldErrors)) {
            if (field === "description" || field === "locationIds") {
              setError(field as keyof KeyFormValues, {
                type: "server",
                message,
              });
            }
          }
          return;
        }

        const message = error instanceof Error ? error.message : "Failed to save key";
        showToast({ message, severity: "error" });
      }
    };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      <form onSubmit={(event) => void handleSubmit(onSubmit)(event)}>
        <DialogTitle>{dialogTitle}</DialogTitle>
        <DialogContent>
          <Stack
            spacing={3}
            sx={{ mt: 1 }}
          >
            <TextField
              required
              label="Description"
              placeholder="e.g. Reception iPad"
              fullWidth
              autoFocus
              error={Boolean(errors.description)}
              helperText={errors.description?.message}
              disabled={isSubmitting}
              {...register("description")}
            />

            <TextField
              label="Key Value"
              placeholder="Leave blank to generate"
              fullWidth
              error={Boolean(errors.keyValue)}
              helperText={errors.keyValue?.message || (editing ? "Provide the exact key value." : "Provide a key or use Generate; blank will auto-generate.")}
              disabled={isSubmitting}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <KeyIcon fontSize="small" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        edge="end"
                        aria-label="Generate key value"
                        onClick={() => {
                          const newKey = generateKeyValue();
                          setValue("keyValue", newKey, { shouldDirty: true });
                        }}
                        disabled={isSubmitting}
                        size="small"
                      >
                        <RefreshIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
              {...register("keyValue")}
            />

            <Controller
              control={control}
              name="locationIds"
              rules={{
                validate: (value) => value.length > 0 || "Select at least one location",
              }}
              render={({ field }) => {
                const selectedOptions = locations.filter((l) => (field.value ?? []).includes(l.id));

                return (
                  <Autocomplete
                    multiple
                    options={locations}
                    value={selectedOptions}
                    onChange={(_, newValue) => {
                      field.onChange(newValue.map((l) => l.id));
                    }}
                    getOptionLabel={(option) => option.name}
                    isOptionEqualToValue={(option, value) => option.id === value.id}
                    disableCloseOnSelect
                    fullWidth
                    disabled={isSubmitting}
                    renderInput={(parameters) => (
                      // @ts-expect-error MUI v7 Autocomplete params typing mismatch
                      <TextField
                        {...parameters}
                        label="Assigned Locations"
                        placeholder="Select locations"
                        error={Boolean(errors.locationIds)}
                        helperText={errors.locationIds?.message}
                      />
                    )}
                  />
                );
              }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isSubmitting}
          >
            {isSubmitting ? submittingLabel : submitLabel}
          </Button>
        </DialogActions>
        {isSubmitting && <LinearProgress sx={{ position: "absolute", bottom: 0, left: 0, right: 0 }} />}
      </form>
    </Dialog>
  );
}
