import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, StatusBar } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { getElections } from '../services/api';
import { colors, spacing, radius, shadow } from '../utils/theme';

export default function HomeScreen() {
  const { student } = useAuth();
  const navigation  = useNavigation();
  const [elections, setElections] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try { const r = await getElections(); setElections(r.data || []); } catch (_) {}
  };
  useFocusEffect(useCallback(() => { load(); }, []));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const active   = elections.filter(e => e.status === 'active');
  const needVote = active.filter(e => !e.has_voted && e.has_active_token);
  const verColor = { verified: colors.success, pending: colors.warning, rejected: colors.danger }[student?.verification_status] || colors.gray400;
  const verBg    = { verified: colors.successLight, pending: colors.warningLight, rejected: colors.dangerLight }[student?.verification_status] || colors.gray100;
  const verMsg   = { verified: '✅ Account Verified — You are eligible to vote', pending: '⏳ Pending Verification — Awaiting Electoral Commission approval', rejected: '❌ Verification Rejected — Contact the Electoral Commission' }[student?.verification_status] || '';

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />
      <View style={s.header}>
        <View>
          <Text style={s.greeting}>Welcome back,</Text>
          <Text style={s.name}>{student?.full_name?.split(' ')[0]} 👋</Text>
        </View>
        <View style={s.avatar}><Text style={s.avatarTxt}>{student?.full_name?.charAt(0).toUpperCase()}</Text></View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}>

        {/* Verification banner */}
        <View style={[s.verBanner, { backgroundColor: verBg }]}>
          <Text style={[s.verText, { color: verColor }]}>{verMsg}</Text>
        </View>

        {/* Vote now alert */}
        {needVote.length > 0 && (
          <TouchableOpacity style={s.voteAlert} onPress={() => navigation.navigate('Elections')}>
            <Text style={{ fontSize: 28 }}>🗳️</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.voteAlertTitle}>{needVote.length} election{needVote.length > 1 ? 's' : ''} waiting for your vote!</Text>
              <Text style={s.voteAlertSub}>Tap to cast your vote now</Text>
            </View>
            <Text style={{ color: colors.white, fontSize: 22 }}>›</Text>
          </TouchableOpacity>
        )}

        {/* Quick stats */}
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }}>
          {[
            { label: 'Active', value: active.length, color: colors.success, bg: colors.successLight },
            { label: 'Voted',  value: elections.filter(e => e.has_voted).length, color: colors.primary, bg: colors.primaryLight },
            { label: 'Results', value: elections.filter(e => e.status === 'results_published').length, color: colors.info, bg: colors.infoLight },
          ].map(st => (
            <View key={st.label} style={[s.statBox, { backgroundColor: st.bg }]}>
              <Text style={[s.statNum, { color: st.color }]}>{st.value}</Text>
              <Text style={[s.statLabel, { color: st.color }]}>{st.label}</Text>
            </View>
          ))}
        </View>

        {/* Account info */}
        <View style={s.infoCard}>
          <Text style={s.sectionTitle}>Your Account</Text>
          {[['Student ID', student?.student_id], ['Program', student?.program], ['Level', `Level ${student?.level}`], ['Faculty', student?.faculty]].map(([l, v]) =>
            v ? <View key={l} style={s.infoRow}><Text style={s.infoLabel}>{l}</Text><Text style={s.infoValue}>{v}</Text></View> : null
          )}
        </View>

        {/* Recent elections */}
        <Text style={s.sectionTitle}>Elections</Text>
        {!elections.length
          ? <View style={s.emptyCard}><Text style={{ fontSize: 48, textAlign: 'center' }}>🗳️</Text><Text style={s.emptyTitle}>No Elections Yet</Text><Text style={s.emptyDesc}>Pull down to refresh</Text></View>
          : elections.slice(0, 4).map(e => (
            <TouchableOpacity key={e.id} style={s.elCard} onPress={() => navigation.navigate('Elections')}>
              <View style={{ flex: 1 }}>
                <View style={[s.elStatus, { backgroundColor: e.status === 'active' ? colors.successLight : colors.gray100 }]}>
                  <Text style={[s.elStatusTxt, { color: e.status === 'active' ? colors.success : colors.gray500 }]}>{e.status === 'active' ? '● LIVE' : e.status.replace(/_/g, ' ').toUpperCase()}</Text>
                </View>
                <Text style={s.elTitle}>{e.title}</Text>
                <Text style={s.elMeta}>{e.candidate_count} candidates · {e.position_count} positions</Text>
              </View>
              {e.has_voted
                ? <View style={s.votedBadge}><Text style={s.votedTxt}>✓ Voted</Text></View>
                : e.has_active_token && e.status === 'active'
                ? <View style={s.pendingBadge}><Text style={s.pendingTxt}>Vote Now</Text></View>
                : null}
            </TouchableOpacity>
          ))}

        <View style={{ height: spacing.xxxl }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: colors.background },
  header:  { backgroundColor: colors.primary, paddingHorizontal: spacing.xl, paddingTop: 52, paddingBottom: spacing.xl, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  greeting:{ color: 'rgba(255,255,255,0.8)', fontSize: 14 },
  name:    { color: colors.white, fontSize: 24, fontWeight: '700', marginTop: 2 },
  avatar:  { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: colors.white, fontSize: 20, fontWeight: '700' },
  verBanner: { borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.lg },
  verText:   { fontSize: 13, fontWeight: '600', lineHeight: 20 },
  voteAlert: { backgroundColor: colors.primary, borderRadius: radius.lg, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: spacing.lg, ...shadow.md },
  voteAlertTitle: { color: colors.white, fontWeight: '700', fontSize: 14 },
  voteAlertSub:   { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
  statBox:   { flex: 1, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center' },
  statNum:   { fontSize: 26, fontWeight: '800' },
  statLabel: { fontSize: 11, fontWeight: '500', marginTop: 2 },
  infoCard:  { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg, ...shadow.sm },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.gray800, marginBottom: spacing.md },
  infoRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.gray100 },
  infoLabel: { fontSize: 13, color: colors.textSecondary },
  infoValue: { fontSize: 13, fontWeight: '600', color: colors.gray800 },
  emptyCard: { backgroundColor: colors.white, borderRadius: radius.lg, padding: 40, alignItems: 'center', ...shadow.sm },
  emptyTitle:{ fontSize: 16, fontWeight: '700', color: colors.gray600, marginTop: spacing.md },
  emptyDesc: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  elCard:    { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, flexDirection: 'row', alignItems: 'center', ...shadow.sm },
  elStatus:  { alignSelf: 'flex-start', paddingVertical: 3, paddingHorizontal: 8, borderRadius: radius.full, marginBottom: 6 },
  elStatusTxt: { fontSize: 10, fontWeight: '700' },
  elTitle:   { fontSize: 14, fontWeight: '600', color: colors.gray800, marginBottom: 4 },
  elMeta:    { fontSize: 12, color: colors.textSecondary },
  votedBadge:  { backgroundColor: colors.successLight, paddingVertical: 5, paddingHorizontal: 10, borderRadius: radius.full },
  votedTxt:    { color: colors.success, fontSize: 12, fontWeight: '600' },
  pendingBadge:{ backgroundColor: colors.primary, paddingVertical: 5, paddingHorizontal: 12, borderRadius: radius.full },
  pendingTxt:  { color: colors.white, fontSize: 12, fontWeight: '700' },
});
