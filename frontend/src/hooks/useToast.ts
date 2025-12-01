import { useCallback } from "react";
import { type VariantType, useSnackbar } from "notistack";
import type { AlertColor } from "@mui/material";

export interface ToastOptions {
  message: string;
  severity?: AlertColor;
}

const severityToVariant: Record<AlertColor, VariantType> = {
  error: "error",
  info: "info",
  success: "success",
  warning: "warning",
};

type ShowToast = (options: ToastOptions) => void;

export function useToast(defaultSeverity: AlertColor = "error"): { showToast: ShowToast } {
  const { enqueueSnackbar } = useSnackbar(),
    showToast = useCallback<ShowToast>(
      ({ message, severity }) => {
        enqueueSnackbar(message, {
          variant: severityToVariant[severity ?? defaultSeverity],
        });
      },
      [enqueueSnackbar, defaultSeverity],
    );

  return { showToast };
}
