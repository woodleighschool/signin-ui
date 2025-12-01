import type { ReactElement } from "react";
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from "@mui/material";

export interface CreditsDialogProperties {
  open: boolean;
  onClose: () => void;
}

export function CreditsDialog({ open, onClose }: CreditsDialogProperties): ReactElement {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle>Credits</DialogTitle>
      <DialogContent dividers>
        <Typography
          variant="body2"
          color="text.secondary"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
