import { type ReactElement, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Autocomplete, Button, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress, Stack, Switch, TextField, Typography } from "@mui/material";
import { ApiValidationError, type DirectoryGroup, type Location } from "../api";
import { useCreateLocation, useGroups, useUpdateLocation } from "../hooks/useQueries";
import { useToast } from "../hooks/useToast";

export interface LocationFormValues {
  name: string;
  identifier: string;
  groupIds: string[];
  notesEnabled: boolean;
}

type LocationDialogMode = "create" | "edit";

const defaultValues: LocationFormValues = {
  name: "",
  identifier: "",
  groupIds: [],
  notesEnabled: false,
};

interface LocationDialogProperties {
  open: boolean;
  mode?: LocationDialogMode;
  location?: Location | undefined;
  onClose: () => void;
}

export function LocationDialog({ open, mode = "create", location, onClose }: LocationDialogProperties): ReactElement {
  const editing = mode === "edit",
    createLocation = useCreateLocation(),
    updateLocation = useUpdateLocation(),
    { data: groups = [] } = useGroups(),
    { showToast } = useToast(),
    form = useForm<LocationFormValues>({
      defaultValues,
    }),
    {
      register,
      handleSubmit,
      reset,
      setError,
      clearErrors,
      watch,
      setValue,
      formState: { isSubmitting, errors },
    } = form,
    nameValue = watch("name"),
    selectedGroupIds = watch("groupIds");

  useEffect(() => {
    if (!open) {
      return;
    }

    if (editing && location) {
      reset({
        name: location.name,
        identifier: location.identifier,
        groupIds: location.groupIds,
        notesEnabled: location.notesEnabled,
      });
    } else {
      reset(defaultValues);
    }

    clearErrors();
  }, [open, editing, location, reset, clearErrors]);

  useEffect(() => {
    const slug = (nameValue || "")
      .toLowerCase()
      .replaceAll(/[^\da-z]+/g, "_")
      .replaceAll(/^_+|_+$/g, "");
    setValue("identifier", slug);
  }, [nameValue, setValue]);

  const dialogTitle = editing ? "Edit Location" : "Create Location",
    submitLabel = editing ? "Save Changes" : "Create",
    submittingLabel = editing ? "Saving..." : "Creating...",
    onSubmit = async (formData: LocationFormValues): Promise<void> => {
      clearErrors();

      try {
        if (editing) {
          if (!location?.id) {
            throw new Error("Missing location identifier.");
          }
          await updateLocation.mutateAsync({ id: location.id, payload: formData });
          showToast({ message: "Location updated successfully", severity: "success" });
        } else {
          await createLocation.mutateAsync(formData);
          showToast({ message: "Location created successfully", severity: "success" });
        }

        onClose();
      } catch (error) {
        if (error instanceof ApiValidationError) {
          for (const [field, message] of Object.entries(error.fieldErrors)) {
            if (field === "name" || field === "identifier" || field === "groupIds") {
              setError(field as keyof LocationFormValues, {
                type: "server",
                message,
              });
            }
          }
          return;
        }

        const message = error instanceof Error ? error.message : "Failed to save location";
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
              label="Location Name"
              placeholder="e.g. Main Reception"
              fullWidth
              autoFocus
              error={Boolean(errors.name)}
              helperText={errors.name?.message}
              disabled={isSubmitting}
              required
              {...register("name")}
            />
            <TextField
              label="Identifier"
              fullWidth
              error={Boolean(errors.identifier)}
              helperText={errors.identifier?.message || "Auto-generated from name"}
              disabled
              defaultValue={""}
              {...register("identifier")}
            />
            <Autocomplete
              multiple
              options={groups}
              getOptionLabel={(option: DirectoryGroup) => option.displayName}
              value={groups.filter((g) => selectedGroupIds.includes(g.id))}
              onChange={(_, newValue) => {
                setValue(
                  "groupIds",
                  newValue.map((g) => g.id),
                  { shouldDirty: true },
                );
              }}
              renderInput={(parameters) => (
                // @ts-expect-error MUI v7 Autocomplete params typing mismatch
                <TextField
                  {...parameters}
                  label="Allowed Groups"
                  placeholder="Select groups allowed at this location"
                  error={Boolean(errors.groupIds)}
                  helperText={errors.groupIds?.message || "Members of these groups appear in the portal dropdown."}
                />
              )}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              disableCloseOnSelect
              fullWidth
            />
            <Stack
              direction="row"
              alignItems="center"
              spacing={1}
            >
              <Switch
                checked={watch("notesEnabled")}
                onChange={(event) => {
                  setValue("notesEnabled", event.target.checked, { shouldDirty: true });
                }}
                slotProps={{ input: { "aria-label": "Toggle notes" } }}
                disabled={isSubmitting}
              />
              <Typography variant="body2">Toggle whether notes can be added for this location.</Typography>
            </Stack>
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
