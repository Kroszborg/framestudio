import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Cancel01Icon, Login01Icon, Mail01Icon, LockIcon } from '@hugeicons/core-free-icons';
import { colors, typography, spacing, radius } from '../../lib/theme';
import { signIn } from '../../lib/auth';

export default function SignInScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    if (!email.trim() || !password) return;
    setLoading(true);
    const result = await signIn(email.trim(), password);
    setLoading(false);
    if (result.success) {
      router.back();
    } else {
      Alert.alert('Sign In Failed', result.error || 'Please check your credentials.');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
            <HugeiconsIcon icon={Cancel01Icon} size={22} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <View style={styles.iconWrap}>
            <HugeiconsIcon icon={Login01Icon} size={40} color={colors.accent} />
          </View>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>
            Sign in to sync your projects across devices
          </Text>

          <View style={styles.form}>
            <View style={styles.inputRow}>
              <HugeiconsIcon icon={Mail01Icon} size={20} color={colors.textMuted} />
              <TextInput
                style={styles.input}
                placeholder="Email address"
                placeholderTextColor={colors.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputRow}>
              <HugeiconsIcon icon={LockIcon} size={20} color={colors.textMuted} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              style={[styles.signInBtn, (!email.trim() || !password) && styles.btnDisabled]}
              onPress={handleSignIn}
              disabled={!email.trim() || !password || loading}
              activeOpacity={0.8}
            >
              <Text style={styles.signInBtnText}>
                {loading ? 'Signing in...' : 'Sign In'}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={() => router.replace('/(auth)/sign-up')}
            style={styles.switchBtn}
          >
            <Text style={styles.switchText}>
              Don't have an account?{' '}
              <Text style={styles.switchLink}>Sign Up</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  closeBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: colors.surface1,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing[6],
    justifyContent: 'center',
    marginTop: -60,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing[5],
  },
  title: {
    fontSize: typography['2xl'],
    fontWeight: typography.bold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing[2],
  },
  subtitle: {
    fontSize: typography.base,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing[8],
  },
  form: {
    gap: spacing[3],
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing[4],
    gap: spacing[3],
  },
  input: {
    flex: 1,
    paddingVertical: spacing[3] + 2,
    fontSize: typography.base,
    color: colors.textPrimary,
  },
  signInBtn: {
    backgroundColor: colors.accent,
    paddingVertical: spacing[4],
    borderRadius: radius.lg,
    alignItems: 'center',
    marginTop: spacing[2],
  },
  btnDisabled: {
    opacity: 0.4,
  },
  signInBtnText: {
    color: colors.bg,
    fontSize: typography.md,
    fontWeight: typography.bold,
  },
  switchBtn: {
    marginTop: spacing[6],
    alignItems: 'center',
  },
  switchText: {
    fontSize: typography.base,
    color: colors.textSecondary,
  },
  switchLink: {
    color: colors.accent,
    fontWeight: typography.semibold,
  },
});
