import { Card, CardContent, type CardContentProps, CardHeader, type CardProps } from "@mui/material";
import type { ReactElement, ReactNode } from "react";
import type { SxProps, Theme } from "@mui/material/styles";

export interface SectionCardProperties extends CardProps {
  title: string;
  subheader?: string;
  children: ReactNode;
  contentProps?: CardContentProps;
}

function mergeSx(base: SxProps<Theme>, extra?: SxProps<Theme>): SxProps<Theme> {
  if (extra === undefined) {
    return base;
  }
  if (Array.isArray(extra)) {
    return [base, ...(extra as SxProps<Theme>[])] as SxProps<Theme>;
  }
  return [base, extra] as SxProps<Theme>;
}

export function SectionCard({ title, subheader, children, contentProps, sx, ...cardProperties }: SectionCardProperties): ReactElement {
  const { sx: contentSx, ...rest } = contentProps ?? {},
    baseCardSx: SxProps<Theme> = { display: "flex", flexDirection: "column", height: "100%" },
    baseContentSx: SxProps<Theme> = { flexGrow: 1, display: "flex", flexDirection: "column", gap: 2 },
    cardSx = mergeSx(baseCardSx, sx),
    contentStyles = mergeSx(baseContentSx, contentSx);

  return (
    <Card
      elevation={1}
      {...cardProperties}
      sx={cardSx}
    >
      <CardHeader
        title={title}
        subheader={subheader}
      />
      <CardContent
        {...rest}
        sx={contentStyles}
      >
        {children}
      </CardContent>
    </Card>
  );
}
