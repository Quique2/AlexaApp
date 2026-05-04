import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as LocalAuthentication from "expo-local-authentication";
import { authApi, AuthUser, setApiToken } from "../services/api";

const REFRESH_KEY = "rrey_refresh_token";
const BIO_KEY = "rrey_biometric_token";
const BIO_EMAIL_KEY = "rrey_biometric_email";

// SecureStore falls back to localStorage on web
const store = {
  get: (key: string) =>
    Platform.OS === "web"
      ? Promise.resolve(localStorage.getItem(key))
      : SecureStore.getItemAsync(key),
  set: (key: string, value: string) =>
    Platform.OS === "web"
      ? Promise.resolve(void localStorage.setItem(key, value))
      : SecureStore.setItemAsync(key, value),
  del: (key: string) =>
    Platform.OS === "web"
      ? Promise.resolve(void localStorage.removeItem(key))
      : SecureStore.deleteItemAsync(key),
};

// ─── Types ────────────────────────────────────────────────────────────────────
export interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isLoading: boolean;
  biometricAvailable: boolean;
  biometricEnabled: boolean;
  biometricEmail: string | null; // email of the account that enrolled Face ID
}

export interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  enableBiometrics: () => Promise<void>;
  disableBiometrics: () => Promise<void>;
  loginWithBiometrics: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    isLoading: true,
    biometricAvailable: false,
    biometricEnabled: false,
    biometricEmail: null,
  });

  // Ref to always access current user without stale closure
  const userRef = useRef<AuthUser | null>(null);
  useEffect(() => { userRef.current = state.user; }, [state.user]);

  // Bootstrap: restore session + biometric state from SecureStore
  useEffect(() => {
    async function bootstrap() {
      let biometricAvailable = false;
      let biometricEnabled = false;
      let biometricEmail: string | null = null;

      if (Platform.OS !== "web") {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        biometricAvailable = hasHardware && enrolled;
        if (biometricAvailable) {
          const bioToken = await store.get(BIO_KEY);
          biometricEmail = await store.get(BIO_EMAIL_KEY);
          biometricEnabled = !!bioToken && !!biometricEmail;
        }
      }

      const refreshToken = await store.get(REFRESH_KEY);
      if (refreshToken) {
        try {
          const { accessToken } = await authApi.refresh(refreshToken);
          setApiToken(accessToken);
          const user = await authApi.me();
          setState({
            user, accessToken, isLoading: false,
            biometricAvailable, biometricEnabled, biometricEmail,
          });
          return;
        } catch {
          await store.del(REFRESH_KEY).catch(() => {});
        }
      }

      setState((s) => ({ ...s, isLoading: false, biometricAvailable, biometricEnabled, biometricEmail }));
    }
    bootstrap();
  }, []);

  const applySession = useCallback(
    async (data: { accessToken: string; refreshToken: string; user: AuthUser }) => {
      await store.set(REFRESH_KEY, data.refreshToken);
      setApiToken(data.accessToken);
      setState((s) => ({ ...s, user: data.user, accessToken: data.accessToken }));
    },
    []
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await authApi.login(email, password);
      await applySession(data);
    },
    [applySession]
  );

  const register = useCallback(
    async (email: string, password: string, name?: string) => {
      const data = await authApi.register(email, password, name);
      await applySession(data);
    },
    [applySession]
  );

  const logout = useCallback(async () => {
    const refreshToken = await store.get(REFRESH_KEY);
    try {
      if (refreshToken) await authApi.logout(refreshToken);
    } catch {}
    await store.del(REFRESH_KEY).catch(() => {});
    // Keep BIO_KEY and BIO_EMAIL_KEY so Face ID remains available on next login
    setApiToken(null);
    setState((s) => ({ ...s, user: null, accessToken: null }));
  }, []);

  // Prompts biometric, then creates a DEDICATED server session for biometric use
  // (separate from the regular session so logout doesn't invalidate it)
  const enableBiometrics = useCallback(async () => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Confirma tu identidad para activar Face ID",
      cancelLabel: "Cancelar",
      fallbackLabel: "Usar contraseña",
    });
    if (!result.success) throw new Error("Autenticación biométrica cancelada");

    const user = userRef.current;
    if (!user) throw new Error("No hay sesión activa");

    // Create a dedicated refresh token that lives independently of the regular session
    const { refreshToken: bioToken } = await authApi.createBiometricToken();
    await store.set(BIO_KEY, bioToken);
    await store.set(BIO_EMAIL_KEY, user.email);
    setState((s) => ({ ...s, biometricEnabled: true, biometricEmail: user.email }));
  }, []);

  const disableBiometrics = useCallback(async () => {
    await store.del(BIO_KEY).catch(() => {});
    await store.del(BIO_EMAIL_KEY).catch(() => {});
    setState((s) => ({ ...s, biometricEnabled: false, biometricEmail: null }));
  }, []);

  // Biometric prompt → use dedicated bio token → create a SEPARATE regular session
  const loginWithBiometrics = useCallback(async () => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Inicia sesión con Face ID",
      cancelLabel: "Usar contraseña",
    });
    if (!result.success) throw new Error("Autenticación biométrica cancelada");

    const bioToken = await store.get(BIO_KEY);
    if (!bioToken) throw new Error("No hay sesión biométrica guardada");

    // Step 1: use the bio token to get an access token
    const { accessToken } = await authApi.refresh(bioToken);
    setApiToken(accessToken);
    const user = await authApi.me();

    // Step 2: create a FRESH regular session for REFRESH_KEY
    // This keeps BIO_KEY independent — logout deletes the regular session only
    const { refreshToken: sessionToken } = await authApi.createSession();
    await store.set(REFRESH_KEY, sessionToken);

    setState((s) => ({ ...s, user, accessToken }));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        register,
        logout,
        enableBiometrics,
        disableBiometrics,
        loginWithBiometrics,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
