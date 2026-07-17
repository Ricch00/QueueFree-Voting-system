import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, StatusBar } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { updateProfile, changePassword } from '../../services/api';
import { colors, spacing, radius, shadow } from '../../utils/theme';

export default function ProfileScreen() {
  const { student, logout, refreshStudent } = useAuth();
  const [tab, setTab]       = useState('profile');
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm]     = useState({ full_name: student?.full_name || '', phone: student?.phone || '' });
  const [pw, setPw]         = useState({ current_password: '', new_password: '', confirm_password: '' });

  const saveProfile = async () => {
    if (!form.full_name.trim()) return Alert.alert('Error', 'Name is required');
    setLoading(true);
    try {
      await updateProfile(form);
      await refreshStudent();
      setEditing(false);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (err) { Alert.alert('Error', err.message); }
    finally { setLoading(false); }
  };

  const savePw = async () => {
    if (!pw.current_password || !pw.new_password) return Alert.alert('Error', 'Fill all fields');
    if (pw.new_password !== pw.confirm_password) return Alert.alert('Error', 'Passwords do not match');
    if (pw.new_password.length < 8) return Alert.alert('Error', 'Password must be at least 8 characters');
    setLoading(true);
    try {
      await changePassword({ current_password: pw.current_password, new_password: pw.new_password });
      setPw({ current_password: '', new_password: '', confirm_password: '' });
      Alert.alert('Success', 'Password changed successfully');
    } catch (err) { Alert.alert('Error', err.message); }
    finally { setLoading(false); }
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout }
    ]);
  };

  const verColor = { verified: colors.success, pending: colors.warning, rejected: colors.danger }[student?.verification_status] || colors.gray400;
  const verBg    = { verified: colors.successLight, pending: colors.warningLight, rejected: colors.dangerLight }[student?.verification_status] || colors.gray100;
  const verEmoji = { verified: '✅', pending: '⏳', rejected: '❌' }[student?.verification_status] || '';

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />

      {/* Header */}
      <View style={s.header}>
        <View style={s.avatarCircle}>
          <Text style={s.avatarTxt}>{student?.full_name?.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={s.name}>{student?.full_name}</Text>
        <Text style={s.studentId}>{student?.student_id}</Text>
        <View style={[s.verBadge, { backgroundColor: verBg }]}>
          <Text style={[s.verTxt, { color: verColor }]}>{verEmoji} {student?.verification_status?.charAt(0).toUpperCase() + student?.verification_status?.slice(1)}</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={s.tabs}>
        {[['profile','👤 Profile'],['security','🔒 Security']].map(([key, label]) => (
          <TouchableOpacity key={key} style={[s.tab, tab === key && s.tabActive]} onPress={() => setTab(key)}>
            <Text style={[s.tabTxt, tab === key && s.tabTxtActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg }} showsVerticalScrollIndicator={false}>

        {/* ── PROFILE TAB ─────────────────────────────────── */}
        {tab === 'profile' && (
          <>
            <View style={s.card}>
              <View style={s.cardHeaderRow}>
                <Text style={s.cardTitle}>Personal Information</Text>
                {!editing
                  ? <TouchableOpacity onPress={() => setEditing(true)}><Text style={s.editBtn}>Edit</Text></TouchableOpacity>
                  : <TouchableOpacity onPress={() => setEditing(false)}><Text style={[s.editBtn, { color: colors.danger }]}>Cancel</Text></TouchableOpacity>}
              </View>

              {/* Editable fields */}
              {[['Full Name', 'full_name', form.full_name], ['Phone', 'phone', form.phone]].map(([label, key, value]) => (
                <View key={key} style={s.fieldRow}>
                  <Text style={s.fieldLabel}>{label}</Text>
                  {editing
                    ? <TextInput style={s.fieldInput} value={value} onChangeText={v => setForm(p => ({ ...p, [key]: v }))} />
                    : <Text style={s.fieldValue}>{value || '—'}</Text>}
                </View>
              ))}

              {/* Read-only fields */}
              {[['Email', student?.email], ['Student ID', student?.student_id], ['Program', student?.program], ['Level', `Level ${student?.level}`], ['Department', student?.department], ['Faculty', student?.faculty]].map(([l, v]) => v ? (
                <View key={l} style={s.fieldRow}>
                  <Text style={s.fieldLabel}>{l}</Text>
                  <Text style={s.fieldValue}>{v}</Text>
                </View>
              ) : null)}

              {editing && (
                <TouchableOpacity style={[s.btn, { marginTop: spacing.lg }]} onPress={saveProfile} disabled={loading}>
                  {loading ? <ActivityIndicator color={colors.white} /> : <Text style={s.btnTxt}>Save Changes</Text>}
                </TouchableOpacity>
              )}
            </View>

            {/* Device info */}
            <View style={s.card}>
              <Text style={s.cardTitle}>Device Security</Text>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginTop: spacing.sm }}>
                <Text style={{ fontSize: 28 }}>📱</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.gray800, marginBottom: 4 }}>Device Registered</Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 18 }}>Your device is permanently bound to this account. One device per voter is enforced for election security.</Text>
                </View>
              </View>
              {student?.device_fingerprint && (
                <View style={{ backgroundColor: colors.gray50, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md }}>
                  <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: '600', marginBottom: 4 }}>Device ID (partial)</Text>
                  <Text style={{ fontSize: 11, color: colors.gray600 }}>{student.device_fingerprint.substring(0, 30)}…</Text>
                </View>
              )}
            </View>

            <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
              <Text style={s.logoutTxt}>🚪 Sign Out</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── SECURITY TAB ────────────────────────────────── */}
        {tab === 'security' && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Change Password</Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: spacing.lg }}>Choose a strong password with at least 8 characters</Text>

            {[['Current Password', 'current_password'], ['New Password', 'new_password'], ['Confirm New Password', 'confirm_password']].map(([label, key]) => (
              <View key={key} style={{ marginBottom: spacing.md }}>
                <Text style={s.fieldLabel}>{label}</Text>
                <TextInput
                  style={s.input}
                  secureTextEntry
                  placeholder={`Enter ${label.toLowerCase()}`}
                  placeholderTextColor={colors.gray400}
                  value={pw[key]}
                  onChangeText={v => setPw(p => ({ ...p, [key]: v }))}
                />
              </View>
            ))}

            <TouchableOpacity style={s.btn} onPress={savePw} disabled={loading}>
              {loading ? <ActivityIndicator color={colors.white} /> : <Text style={s.btnTxt}>Change Password</Text>}
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.primary, padding: spacing.xl, paddingTop: 52, alignItems: 'center', paddingBottom: spacing.xxl },
  avatarCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  avatarTxt: { fontSize: 36, fontWeight: '700', color: colors.white },
  name:      { fontSize: 22, fontWeight: '800', color: colors.white, marginBottom: 4 },
  studentId: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginBottom: spacing.md },
  verBadge:  { paddingVertical: 5, paddingHorizontal: 16, borderRadius: radius.full },
  verTxt:    { fontSize: 13, fontWeight: '600' },
  tabs:      { flexDirection: 'row', backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab:       { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: colors.primary },
  tabTxt:    { fontSize: 14, fontWeight: '500', color: colors.gray500 },
  tabTxtActive: { color: colors.primary, fontWeight: '700' },
  card:      { backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.lg, ...shadow.sm },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.gray800 },
  editBtn:   { color: colors.primary, fontSize: 14, fontWeight: '600' },
  fieldRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.gray100 },
  fieldLabel:{ fontSize: 13, color: colors.textSecondary, flex: 1 },
  fieldValue:{ fontSize: 13, fontWeight: '600', color: colors.gray800, flex: 2, textAlign: 'right' },
  fieldInput:{ fontSize: 13, fontWeight: '600', color: colors.gray800, flex: 2, textAlign: 'right', borderBottomWidth: 1, borderBottomColor: colors.primary, paddingVertical: 2 },
  input:     { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, fontSize: 14, color: colors.text, marginTop: 6 },
  btn:       { backgroundColor: colors.primary, borderRadius: radius.lg, padding: 14, alignItems: 'center' },
  btnTxt:    { color: colors.white, fontSize: 15, fontWeight: '700' },
  logoutBtn: { backgroundColor: colors.dangerLight, borderRadius: radius.lg, padding: 14, alignItems: 'center', marginBottom: spacing.lg },
  logoutTxt: { color: colors.danger, fontSize: 15, fontWeight: '700' },
});
