import { type ChangeEvent, type ReactElement, useEffect, useMemo, useState } from "react";
import { Box, Button, Card, CardContent, CardHeader, Grid, LinearProgress, Stack, Typography } from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import DeleteIcon from "@mui/icons-material/Delete";

import { PageHeader } from "../components";
import { useDeletePortalBackground, usePortalBackground, useUploadPortalBackground } from "../hooks/useQueries";
import { useToast } from "../hooks/useToast";

export default function Settings(): ReactElement {
  const [selectedFile, setSelectedFile] = useState<File | undefined>(),
    background = usePortalBackground(),
    uploadBackground = useUploadPortalBackground(),
    deleteBackground = useDeletePortalBackground(),
    { showToast } = useToast(),
    previewUrl = useMemo(() => (selectedFile ? URL.createObjectURL(selectedFile) : undefined), [selectedFile]);

  useEffect(() => {
    if (!previewUrl) {
      return;
    }

    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const currentBackground = previewUrl ?? background.data?.url ?? undefined,
    isBusy = background.isLoading || uploadBackground.isPending || deleteBackground.isPending,
    mutationError = uploadBackground.error || deleteBackground.error,
    backgroundErrorMessage = background.isError
      ? background.error instanceof Error
        ? background.error.message
        : "Failed to load current background."
      : undefined,
    mutationErrorMessage = mutationError ? (mutationError instanceof Error ? mutationError.message : "Failed to update background.") : undefined,
    canRemove = Boolean(background.data?.hasImage) || Boolean(previewUrl);

  useEffect(() => {
    if (!backgroundErrorMessage) {
      return;
    }
    showToast({ message: backgroundErrorMessage, severity: "error" });
  }, [background.error, backgroundErrorMessage, showToast]);

  useEffect(() => {
    if (!mutationErrorMessage) {
      return;
    }
    showToast({ message: mutationErrorMessage, severity: "error" });
  }, [mutationError, mutationErrorMessage, showToast]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>): void => {
      const file = event.target.files?.[0] ?? undefined;
      setSelectedFile(file);
    },
    handleUpload = async (): Promise<void> => {
      if (!selectedFile) {
        return;
      }

      try {
        await uploadBackground.mutateAsync(selectedFile);
        setSelectedFile(undefined);
      } catch {
        // Errors surface via the mutation hooks
      }
    },
    handleDelete = async (): Promise<void> => {
      try {
        await deleteBackground.mutateAsync();
        setSelectedFile(undefined);
      } catch {
        // Errors surface via the mutation hooks
      }
    };

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Settings"
        subtitle="Application status and metadata."
      />

      {/* Appearance */}
      <Stack spacing={2}>
        <Typography variant="h6">Appearance</Typography>

        <Grid
          container
          spacing={2}
        >
          {/* Portal background */}
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <Card variant="outlined">
              <CardHeader
                title="Portal background"
                subheader="Image shown behind the portal check-in screen."
              />

              {isBusy && <LinearProgress />}

              <CardContent>
                <Stack spacing={2}>
                  {/* Preview */}
                  <Stack spacing={0.5}>
                    <Typography
                      variant="subtitle2"
                      color="text.secondary"
                    >
                      Preview
                    </Typography>

                    <Box
                      sx={{
                        borderRadius: 2,
                        border: "1px solid",
                        borderColor: "divider",
                        overflow: "hidden",
                        // Consistent thumbnail sizing
                        aspectRatio: "16 / 9",
                        backgroundImage: currentBackground ? `url(${currentBackground})` : "linear-gradient(120deg, #f5f7fb 0%, #edf1f7 100%)",
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {!currentBackground && (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ px: 2, textAlign: "center" }}
                        >
                          No background set. Upload a photo to customise the portal.
                        </Typography>
                      )}
                    </Box>
                  </Stack>

                  {/* Controls */}
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1.5}
                    alignItems={{ xs: "stretch", sm: "center" }}
                  >
                    <Button
                      component="label"
                      variant="outlined"
                      startIcon={<CloudUploadIcon />}
                      disabled={uploadBackground.isPending}
                    >
                      {selectedFile ? "Change file" : "Select image"}
                      <input
                        type="file"
                        accept="image/jpeg"
                        hidden
                        onChange={handleFileChange}
                      />
                    </Button>

                    <Button
                      variant="contained"
                      onClick={() => {
                        void handleUpload();
                      }}
                      disabled={!selectedFile || uploadBackground.isPending}
                    >
                      Save background
                    </Button>

                    <Button
                      variant="text"
                      color="error"
                      startIcon={<DeleteIcon />}
                      onClick={() => {
                        void handleDelete();
                      }}
                      disabled={deleteBackground.isPending || uploadBackground.isPending || !canRemove}
                    >
                      Remove
                    </Button>
                  </Stack>

                  <Typography
                    variant="caption"
                    color="text.secondary"
                  >
                    JPEGs only. Max 2&nbsp;MB. Images are cached for portal users.
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {/* Future tiles placeholder */}
          {/* <Grid item xs={12} md={6} lg={4}>
            <Card variant="outlined">
              <CardHeader title="Portal theme" subheader="Colours and branding." />
              <CardContent>…</CardContent>
            </Card>
          </Grid> */}
        </Grid>
      </Stack>
    </Stack>
  );
}
