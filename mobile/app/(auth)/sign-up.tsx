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
import { Cancel01Icon, UserAdd01Icon, Mail01Icon, LockIcon } from '@hugeicons/core-free-icons';
import { colors, typography, spacing, radius } from '../../lib/theme';
import { signUp } from '../../lib/auth';

export default function SignUpScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const isValid = name.trim() && email.trim() && password.length >= 8;

  const handleSignUp = async () => {
    if (!isValid) return;
    setLoading(true);
    const result = await signUp(name.trim(), email.trim(), password);
    setLoading(false);
    if (result.success) {
      router.back();
    } else {
      Alert.alert('Sign Up Failed', result.error || 'Please try again.');
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
            <HugeiconsIcon icon={UserAdd01Icon} size={40} color={colors.success} />
          </View>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>
            Sign up to sync your projects and access them anywhere
          </Text>

          <View style={styles.form}>
            <View style={styles.inputRow}>
              <HugeiconsIcon icon={UserAdd01Icon} size={20} color={colors.textMuted} />
              <TextInput
                style={styles.input}
                placeholder="Full name"
                placeholderTextColor={colors.textMuted}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            </View>

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
                placeholder="Password (min 8 characters)"
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            {password.length > 0 && password.length < 8 && (
              <Text style={styles.hint}>Password must be at least 8 characters</Text>
            )}

            <TouchableOpacity
              style={[styles.signUpBtn, !isValid && styles.btnDisabled]}
              onPress={handleSignUp}
              disabled={!isValid || loading}
              activeOpacity={0.8}
            >
              <Text style={styles.signUpBtnText}>
                {loading ? 'Creating account...' : 'Create Account'}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={() => router.replace('/(auth)/sign-in')}
            style={styles.switchBtn}
          >
            <Text style={styles.switchText}>
              Already have an account?{' '}
              <Text style={styles.switchLink}>Sign In</Text>
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
    marginTop: -40,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(34,197,94,0.15)',
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
  hint: {
    fontSize: typography.sm,
    color: colors.warning,
    marginLeft: spacing[1],
  },
  signUpBtn: {
    backgroundColor: colors.success,
    paddingVertical: spacing[4],
    borderRadius: radius.lg,
    alignItems: 'center',
    marginTop: spacing[2],
  },
  btnDisabled: {
    opacity: 0.4,
  },
  signUpBtnText: {
    color: '#fff',
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
