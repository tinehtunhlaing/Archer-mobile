import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { ApiError, authApi, type Role, type User } from "./src/api";
import { Marketplace } from "./src/screens/marketplace";

type Screen = "landing" | "login" | "register";
type Session = { user: User; accessToken: string };

const purple = "#7257e8";

export default function App() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [session, setSession] = useState<Session | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Exclude<Role, "ADMIN">>("FREELANCER");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const showScreen = (next: Screen) => {
    setError("");
    setScreen(next);
  };

  const submitAuth = async () => {
    setError("");
    if (screen === "register" && displayName.trim().length === 0) {
      setError("Enter your name to continue.");
      return;
    }
    if (!email.trim()) {
      setError("Enter your email address.");
      return;
    }
    if (!password) {
      setError("Enter your password.");
      return;
    }
    if (screen === "register" && password.length < 10) {
      setError("Use a password with at least 10 characters.");
      return;
    }

    setSubmitting(true);
    try {
      const result = screen === "register"
        ? await authApi.register({ email: email.trim(), password, displayName: displayName.trim(), role })
        : await authApi.login({ email: email.trim(), password });
      setSession({ user: result.user, accessToken: result.accessToken });
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const signOut = () => {
    setSession(null);
    setPassword("");
    showScreen("landing");
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        {session ? (
          <Marketplace user={session.user} token={session.accessToken} onSignOut={signOut} />
        ) : screen === "landing" ? (
          <Landing onLogin={() => showScreen("login")} onRegister={() => showScreen("register")} />
        ) : (
          <AuthScreen
            mode={screen}
            displayName={displayName}
            email={email}
            password={password}
            role={role}
            error={error}
            submitting={submitting}
            onDisplayNameChange={setDisplayName}
            onEmailChange={setEmail}
            onPasswordChange={setPassword}
            onRoleChange={setRole}
            onSubmit={submitAuth}
            onBack={() => showScreen("landing")}
            onSwitch={() => showScreen(screen === "login" ? "register" : "login")}
          />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function Brand({ onPress }: { onPress?: () => void }) {
  return (
    <Pressable accessibilityRole={onPress ? "button" : undefined} onPress={onPress} style={styles.brand}>
      <View style={styles.brandIcon}><Text style={styles.brandIconText}>a</Text></View>
      <Text style={styles.brandName}>archer</Text>
    </Pressable>
  );
}

function Landing({ onLogin, onRegister }: { onLogin: () => void; onRegister: () => void }) {
  return (
    <ScrollView contentContainerStyle={styles.landingPage} showsVerticalScrollIndicator={false}>
      <View style={styles.landingTop}>
        <Brand />
        <Pressable onPress={onLogin} hitSlop={10}>
          <Text style={styles.topLogin}>Log in</Text>
        </Pressable>
      </View>
      <View style={styles.hero}>
        <View style={styles.heroAccent} />
        <Text style={styles.eyebrow}>A BETTER WAY TO WORK</Text>
        <Text style={styles.heroTitle}>Good work{ "\n" }finds its people.</Text>
        <Text style={styles.heroCopy}>
          Meet independent talent, discover meaningful projects, and make great things happen together.
        </Text>
        <PrimaryButton label="Create your account" onPress={onRegister} />
        <Pressable onPress={onLogin} style={styles.landingLogin}>
          <Text style={styles.landingLoginText}>Already have an account? <Text style={styles.inlineLink}>Log in</Text></Text>
        </Pressable>
      </View>
      <View style={styles.valueCard}>
        <View style={styles.valueNumber}><Text style={styles.valueNumberText}>01</Text></View>
        <View style={styles.valueTextWrap}>
          <Text style={styles.valueTitle}>A place for good work</Text>
          <Text style={styles.valueCopy}>Find projects and people who fit the way you work.</Text>
        </View>
        <Text style={styles.valueArrow}>↗</Text>
      </View>
      <Text style={styles.footerNote}>MADE FOR INDEPENDENT WORK</Text>
    </ScrollView>
  );
}

type AuthScreenProps = {
  mode: "login" | "register";
  displayName: string;
  email: string;
  password: string;
  role: Exclude<Role, "ADMIN">;
  error: string;
  submitting: boolean;
  onDisplayNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onRoleChange: (value: Exclude<Role, "ADMIN">) => void;
  onSubmit: () => void;
  onBack: () => void;
  onSwitch: () => void;
};

function AuthScreen(props: AuthScreenProps) {
  const isRegister = props.mode === "register";
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.authPage} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.authTop}>
          <Pressable onPress={props.onBack} hitSlop={12} style={styles.backButton}>
            <Text style={styles.backArrow}>‹</Text>
            <Text style={styles.backLabel}>Home</Text>
          </Pressable>
          <Brand onPress={props.onBack} />
        </View>
        <View style={styles.authHeading}>
          <Text style={styles.eyebrow}>{isRegister ? "GET STARTED" : "WELCOME BACK"}</Text>
          <Text style={styles.authTitle}>{isRegister ? "Create your account" : "Log in to Archer"}</Text>
          <Text style={styles.authCopy}>{isRegister ? "A few details and you’re on your way." : "Pick up where you left off."}</Text>
        </View>

        {isRegister && (
          <>
            <Text style={styles.fieldLabel}>I’m here as</Text>
            <View style={styles.rolePicker}>
              <RoleChoice label="Freelancer" selected={props.role === "FREELANCER"} onPress={() => props.onRoleChange("FREELANCER")} />
              <RoleChoice label="Client" selected={props.role === "CLIENT"} onPress={() => props.onRoleChange("CLIENT")} />
            </View>
            <FormField label="Your name" value={props.displayName} onChangeText={props.onDisplayNameChange} placeholder="How should we call you?" autoComplete="name" textContentType="name" returnKeyType="next" />
          </>
        )}
        <FormField label="Email address" value={props.email} onChangeText={props.onEmailChange} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" returnKeyType="next" />
        <FormField label="Password" value={props.password} onChangeText={props.onPasswordChange} placeholder={isRegister ? "At least 10 characters" : "Your password"} secureTextEntry autoComplete={isRegister ? "new-password" : "current-password"} textContentType={isRegister ? "newPassword" : "password"} returnKeyType="go" onSubmitEditing={props.onSubmit} />
        {props.error ? <Text accessibilityRole="alert" style={styles.errorMessage}>{props.error}</Text> : null}
        <PrimaryButton label={isRegister ? "Create account" : "Log in"} onPress={props.onSubmit} disabled={props.submitting}>
          {props.submitting ? <ActivityIndicator color="#ffffff" /> : null}
        </PrimaryButton>
        <View style={styles.authSwitch}>
          <Text style={styles.authSwitchText}>{isRegister ? "Already have an account? " : "New to Archer? "}</Text>
          <Pressable onPress={props.onSwitch}>
            <Text style={styles.inlineLink}>{isRegister ? "Log in" : "Create an account"}</Text>
          </Pressable>
        </View>
        {isRegister ? <Text style={styles.termsNote}>By creating an account, you agree to use Archer respectfully and keep your account information accurate.</Text> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function FormField(props: React.ComponentProps<typeof TextInput> & { label: string }) {
  const { label, ...inputProps } = props;
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...inputProps}
        placeholderTextColor="#9a9893"
        style={styles.input}
        selectionColor={purple}
      />
    </View>
  );
}

function RoleChoice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected }} style={[styles.roleChoice, selected && styles.roleChoiceSelected]}>
      <Text style={[styles.roleChoiceText, selected && styles.roleChoiceTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function PrimaryButton({ label, onPress, disabled, children }: { label: string; onPress: () => void; disabled?: boolean; children?: React.ReactNode }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed, disabled && styles.primaryButtonDisabled]}>
      {children ?? <Text style={styles.primaryButtonText}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: "#f8f7f4" },
  landingPage: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 26 },
  landingTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brand: { flexDirection: "row", alignItems: "center", gap: 9 },
  brandIcon: { width: 31, height: 31, borderRadius: 10, backgroundColor: purple, alignItems: "center", justifyContent: "center" },
  brandIconText: { color: "#ffffff", fontSize: 22, fontWeight: "800", lineHeight: 26 },
  brandName: { color: "#232220", fontSize: 20, fontWeight: "700", letterSpacing: -0.8 },
  topLogin: { color: "#363431", fontSize: 15, fontWeight: "600", paddingVertical: 8, paddingHorizontal: 4 },
  hero: { paddingTop: 70, paddingBottom: 46, position: "relative" },
  heroAccent: { position: "absolute", right: -24, top: 26, width: 152, height: 152, borderRadius: 76, backgroundColor: "#eeeafd", opacity: 0.95 },
  eyebrow: { color: purple, fontSize: 11, fontWeight: "800", letterSpacing: 1.8, marginBottom: 14 },
  heroTitle: { color: "#20201f", fontSize: 45, lineHeight: 49, letterSpacing: -2, fontWeight: "700" },
  heroCopy: { color: "#686763", fontSize: 16, lineHeight: 24, marginTop: 19, marginBottom: 28, maxWidth: 335 },
  primaryButton: { minHeight: 54, borderRadius: 15, backgroundColor: purple, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  primaryButtonPressed: { backgroundColor: "#6045d2", transform: [{ scale: 0.99 }] },
  primaryButtonDisabled: { opacity: 0.7 },
  primaryButtonText: { color: "#ffffff", fontSize: 15, fontWeight: "700" },
  landingLogin: { alignItems: "center", paddingVertical: 18 },
  landingLoginText: { color: "#77756f", fontSize: 14 },
  inlineLink: { color: purple, fontWeight: "700" },
  valueCard: { minHeight: 104, borderRadius: 20, backgroundColor: "#eeece6", padding: 17, flexDirection: "row", alignItems: "center", gap: 13 },
  valueNumber: { width: 40, height: 40, borderRadius: 13, backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center" },
  valueNumberText: { color: purple, fontWeight: "800", fontSize: 12 },
  valueTextWrap: { flex: 1 },
  valueTitle: { color: "#302f2c", fontWeight: "700", fontSize: 14, marginBottom: 5 },
  valueCopy: { color: "#77756f", fontSize: 12, lineHeight: 17 },
  valueArrow: { color: purple, fontSize: 21, fontWeight: "600" },
  footerNote: { color: "#a7a49d", fontSize: 9, fontWeight: "700", letterSpacing: 1.8, textAlign: "center", marginTop: "auto", paddingTop: 28 },
  authPage: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 14, paddingBottom: 34 },
  authTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 34 },
  backButton: { minWidth: 65, flexDirection: "row", alignItems: "center", gap: 6 },
  backArrow: { color: "#55534e", fontSize: 29, lineHeight: 30, marginTop: -3 },
  backLabel: { color: "#55534e", fontSize: 14, fontWeight: "600" },
  authHeading: { marginTop: 47, marginBottom: 28 },
  authTitle: { color: "#20201f", fontSize: 30, lineHeight: 36, letterSpacing: -1, fontWeight: "700" },
  authCopy: { color: "#77756f", fontSize: 15, marginTop: 9 },
  field: { marginBottom: 18 },
  fieldLabel: { color: "#383733", fontSize: 13, fontWeight: "700", marginBottom: 9 },
  input: { minHeight: 54, borderRadius: 14, borderWidth: 1, borderColor: "#e2e0da", backgroundColor: "#ffffff", paddingHorizontal: 15, color: "#252421", fontSize: 15 },
  rolePicker: { flexDirection: "row", gap: 10, marginBottom: 19 },
  roleChoice: { flex: 1, minHeight: 47, borderRadius: 13, borderWidth: 1, borderColor: "#e2e0da", backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center" },
  roleChoiceSelected: { backgroundColor: "#f1efff", borderColor: purple },
  roleChoiceText: { color: "#74716b", fontSize: 14, fontWeight: "600" },
  roleChoiceTextSelected: { color: purple, fontWeight: "700" },
  errorMessage: { color: "#b23f3f", fontSize: 13, lineHeight: 18, marginBottom: 15 },
  authSwitch: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 22 },
  authSwitchText: { color: "#77756f", fontSize: 14 },
  termsNote: { color: "#99968f", fontSize: 11, lineHeight: 16, textAlign: "center", marginTop: 27, paddingHorizontal: 8 },
});
