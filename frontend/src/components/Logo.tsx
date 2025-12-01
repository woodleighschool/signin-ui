import { type ReactElement } from "react";
import { type SvgIconProps } from "@mui/material";
import { createSvgIcon } from "@mui/material/utils";
import logoSvg from "../assets/logo.svg?raw";

function parseSvg(rawSvg: string): { viewBox: string; innerSvg: string } {
  const viewBoxMatch = rawSvg.match(/viewBox="([^"]*)"/i);
  const viewBox = viewBoxMatch?.[1] ?? "0 0 24 24";
  const innerSvg = rawSvg
    .replace(/^[\s\S]*?<svg[^>]*>/i, "")
    .replace(/<\/svg>\s*$/i, "")
    .trim();

  return { viewBox, innerSvg };
}

const parsedLogo = parseSvg(logoSvg);

const LogoIcon = createSvgIcon(<g dangerouslySetInnerHTML={{ __html: parsedLogo.innerSvg }} />, "WoodleighLogo");

export type LogoProps = SvgIconProps;

export function Logo(properties: SvgIconProps): ReactElement {
  return (
    <LogoIcon
      viewBox={parsedLogo.viewBox}
      {...properties}
    />
  );
}
