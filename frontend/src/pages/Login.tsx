import { type ReactElement, useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Divider,
  FormControl,
  FormHelperText,
  InputLabel,
  OutlinedInput,
  Stack,
  Typography,
} from "@mui/material";

import { getAuthProviders } from "../api";
import { Logo } from "../components";
import { useToast } from "../hooks/useToast";

interface LoginProperties {
  onLogin: () => void;
}

interface LoginFormData {
  username: string;
  password: string;
}

export default function Login({ onLogin }: LoginProperties): ReactElement {
  const [oauthEnabled, setOauthEnabled] = useState(false),
    [providerError, setProviderError] = useState<string | undefined>(),
    { showToast } = useToast(),
    {
      register,
      handleSubmit,
      setError,
      formState: { errors, isSubmitting },
    } = useForm<LoginFormData>();

  useEffect(() => {
    const loadProviders = async (): Promise<void> => {
      try {
        const providers = await getAuthProviders();
        setOauthEnabled(providers.oauth);
        setProviderError(undefined);
      } catch (error) {
        setProviderError("Unable to determine OAuth availability. Use local credentials or reload to try again.");
      }
    };

    void loadProviders();
  }, []);

  const handleLocalLogin = useCallback(
    async (data: LoginFormData): Promise<void> => {
      try {
        const response = await fetch("/api/auth/login?method=local", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            username: data.username.trim(),
            password: data.password,
          }),
        });

        if (!response.ok) {
          if (response.status === 401) {
            setError("password", {
              type: "server",
              message: "Invalid username or password",
            });
            return;
          }

          throw new Error(`Login failed (${response.status.toString()})`);
        }

        onLogin();
      } catch (error) {
        showToast({
          message: "Login failed. Please try again.",
          severity: "error",
        });
      }
    },
    [onLogin, setError, showToast],
  );

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
      }}
    >
      <Container maxWidth="sm">
        <Card elevation={2}>
          <CardContent>
            <Stack spacing={3}>
              {/* Brand */}
              <Stack
                direction="row"
                spacing={1.25}
                alignItems="center"
                justifyContent="center"
              >
                <Logo sx={{ fontSize: 56 }} />
                <Typography
                  variant="h4"
                  component="h1"
                  fontWeight={700}
                  noWrap
                >
                  Signin UI
                </Typography>
              </Stack>

              <Typography
                color="text.secondary"
                textAlign="center"
              >
                Manage Santa rules and monitor blocked executions.
              </Typography>

              {/* OAuth sign-in */}
              <Stack spacing={2}>
                <Button
                  component="a"
                  href="/api/auth/login"
                  variant="contained"
                  fullWidth
                  disabled={!oauthEnabled}
                >
                  Sign in with OAuth
                </Button>

                {!oauthEnabled && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    textAlign="center"
                  >
                    OAuth sign-in is disabled. Use your local administrator credentials instead.
                  </Typography>
                )}
                {providerError && <Alert severity="warning">{providerError}</Alert>}
              </Stack>

              <Divider />

              {/* Local sign-in */}
              <Stack
                component="form"
                spacing={2}
                onSubmit={(e) => void handleSubmit(handleLocalLogin)(e)}
              >
                <FormControl
                  fullWidth
                  required
                  error={Boolean(errors.username)}
                >
                  <InputLabel htmlFor="login-username">Username</InputLabel>
                  <OutlinedInput
                    id="login-username"
                    label="Username"
                    autoComplete="username"
                    {...register("username")}
                  />
                  <FormHelperText>{errors.username?.message}</FormHelperText>
                </FormControl>

                <FormControl
                  fullWidth
                  required
                  error={Boolean(errors.password)}
                >
                  <InputLabel htmlFor="login-password">Password</InputLabel>
                  <OutlinedInput
                    id="login-password"
                    label="Password"
                    type="password"
                    autoComplete="current-password"
                    {...register("password")}
                  />
                  <FormHelperText>{errors.password?.message}</FormHelperText>
                </FormControl>

                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Signing In..." : "Sign In"}
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
