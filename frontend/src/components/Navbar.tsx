import { type MouseEvent, type ReactElement, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";

import DashboardIcon from "@mui/icons-material/Dashboard";
import LogoutIcon from "@mui/icons-material/Logout";
import GroupIcon from "@mui/icons-material/Group";
import KeyIcon from "@mui/icons-material/Key";
import PlaceIcon from "@mui/icons-material/Place";
import HistoryIcon from "@mui/icons-material/History";
import SettingsIcon from "@mui/icons-material/Settings";
import MenuIcon from "@mui/icons-material/Menu";

import { Logo } from "./Logo";

interface NavItem {
  label: string;
  icon: ReactElement;
  to: string;
}

const navItems: NavItem[] = [
  { label: "Dashboard", icon: <DashboardIcon fontSize="small" />, to: "/" },
  { label: "Locations", icon: <PlaceIcon fontSize="small" />, to: "/locations" },
  { label: "Users", icon: <GroupIcon fontSize="small" />, to: "/users" },
  { label: "Keys", icon: <KeyIcon fontSize="small" />, to: "/keys" },
  { label: "Checkins", icon: <HistoryIcon fontSize="small" />, to: "/checkins" },
];

export interface NavbarProperties {
  activeTab: string | false;
  userDisplay: string;
  userInitial: string;
  onLogout: () => void | Promise<void>;
}

export function Navbar({ activeTab, userDisplay, userInitial, onLogout }: NavbarProperties): ReactElement {
  const [navMenuAnchor, setNavMenuAnchor] = useState<HTMLElement | undefined>(),
    theme = useTheme(),
    isDesktop = useMediaQuery(theme.breakpoints.up("md")),
    navMenuOpen = Boolean(navMenuAnchor),
    handleMenuOpen = (event: MouseEvent<HTMLButtonElement>): void => {
      setNavMenuAnchor(event.currentTarget);
    },
    handleMenuClose = (): void => {
      setNavMenuAnchor(undefined);
    };

  return (
    <AppBar
      position="sticky"
      enableColorOnDark
    >
      <Toolbar sx={{ gap: 1.5 }}>
        <Button
          component={NavLink}
          to="/"
          color="inherit"
          startIcon={<Logo sx={{ fontSize: 32 }} />}
          sx={{ px: 1, minWidth: 0 }}
        >
          <Typography
            variant="h6"
            component="span"
            sx={{ display: { xs: "none", sm: "inline" } }}
          >
            Signin UI
          </Typography>
        </Button>

        {!isDesktop && (
          <>
            <IconButton
              color="inherit"
              onClick={handleMenuOpen}
              aria-label="open navigation menu"
              sx={{ ml: 0.5 }}
            >
              <MenuIcon />
            </IconButton>
            <Menu
              anchorEl={navMenuAnchor}
              open={navMenuOpen}
              onClose={handleMenuClose}
            >
              {navItems.map((item) => (
                <MenuItem
                  key={item.to}
                  component={NavLink}
                  to={item.to}
                  onClick={handleMenuClose}
                  selected={activeTab === item.to}
                >
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.label} />
                </MenuItem>
              ))}
            </Menu>
          </>
        )}

        <Box
          sx={{
            flexGrow: 1,
            display: "flex",
            justifyContent: "center",
          }}
        >
          {isDesktop && (
            <Tabs
              value={activeTab}
              textColor="inherit"
              indicatorColor="secondary"
              aria-label="main navigation"
              variant="scrollable"
              scrollButtons="auto"
            >
              {navItems.map((item) => (
                <Tab
                  key={item.to}
                  icon={item.icon}
                  iconPosition="start"
                  label={item.label}
                  component={NavLink}
                  to={item.to}
                  value={item.to}
                />
              ))}
            </Tabs>
          )}
        </Box>

        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
        >
          <IconButton
            component={NavLink}
            to="/settings"
            color="inherit"
            aria-label="settings"
          >
            <SettingsIcon />
          </IconButton>

          <Button
            color="inherit"
            variant={isDesktop ? "outlined" : "text"}
            onClick={() => {
              void onLogout();
            }}
            startIcon={
              <Avatar
                sx={{
                  width: 28,
                  height: 28,
                  fontSize: 13,
                }}
              >
                {userInitial}
              </Avatar>
            }
            endIcon={<LogoutIcon fontSize="small" />}
            aria-label={`Logout ${userDisplay}`}
            sx={{
              maxWidth: { xs: 44, sm: 200 },
              pl: { xs: 0.5, sm: 1.5 },
              pr: { xs: 0.5, sm: 1.5 },
            }}
          >
            <Typography
              variant="body2"
              noWrap
              sx={{ display: { xs: "none", sm: "block" } }}
            >
              {userDisplay}
            </Typography>
          </Button>
        </Stack>
      </Toolbar>
      <Divider />
    </AppBar>
  );
}
