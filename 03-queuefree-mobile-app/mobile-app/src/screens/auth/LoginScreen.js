import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, StatusBar, KeyboardAvoidingView, Platform } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, radius, shadow } from '../../utils/theme';

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) return Alert.alert('Error', 'Please fill all fields');
    setLoading(true);
    try { await login(email.trim().toLowerCase(), password); }
    catch (err) { Alert.alert('Login Failed', err.message || 'Invalid credentials'); }
    finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={s.header}>
          <Text style={s.logo}>🗳️</Text>
          <Text style={s.appName}>QueueFree</Text>
          <Text style={s.tagline}>Queue-Free Student E-Voting</Text>
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Student Login</Text>
          <Text style={s.cardSub}>Sign in with your institutional account</Text>

          <View style={s.field}>
            <Text style={s.label}>Email Address</Text>
            <TextInput style={s.input} placeholder="student@ug.edu.gh" placeholderTextColor={colors.gray400}
              keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
          </View>

          <View style={s.field}>
            <Text style={s.label}>Password</Text>
            <View style={{ flexDirection: 'row' }}>
              <TextInput style={[s.input, { flex: 1, borderTopRightRadius: 0, borderBottomRightRadius: 0, borderRightWidth: 0 }]}
                placeholder="Enter your password" placeholderTextColor={colors.gray400}
                secureTextEntry={!showPass} value={password} onChangeText={setPassword} />
              <TouchableOpacity onPress={() => setShowPass(!showPass)}
                style={{ borderWidth: 1, borderColor: colors.border, borderTopRightRadius: radius.md, borderBottomRightRadius: radius.md, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white }}>
                <Text style={{ fontSize: 18 }}>{showPass ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={[s.btn, loading && { opacity: 0.7 }]} onPress={handleLogin} disabled={loading}>
            {loading ? <ActivityIndicator color={colors.white} /> : <Text style={s.btnText}>Sign In</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={{ marginTop: spacing.lg, alignItems: 'center' }} onPress={() => navigation.navigate('Register')}>
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>
              Don't have an account? <Text style={{ color: colors.primary, fontWeight: '700' }}>Register here</Text>
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: spacing.xl }}>
          Secured by QueueFree E-Voting System
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: colors.primary },
  scroll:  { flexGrow: 1, justifyContent: 'center', padding: spacing.xl },
  header:  { alignItems: 'center', marginBottom: spacing.xxl },
  logo:    { fontSize: 56, marginBottom: spacing.sm },
  appName: { fontSize: 32, fontWeight: '800', color: colors.white },
  tagline: { fontSize: 14, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  card:    { backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.xxl, ...shadow.md },
  cardTitle: { fontSize: 22, fontWeight: '700', color: colors.gray900, marginBottom: 4 },
  cardSub:   { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.xl },
  field:   { marginBottom: spacing.lg },
  label:   { fontSize: 13, fontWeight: '600', color: colors.gray700, marginBottom: 6 },
  input:   { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, fontSize: 15, color: colors.text, backgroundColor: colors.white },
  btn:     { backgroundColor: colors.primary, borderRadius: radius.md, padding: 14, alignItems: 'center', marginTop: spacing.sm },
  btnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
});
