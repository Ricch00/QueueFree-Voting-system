import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert, StatusBar } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { getElections } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, radius, shadow } from '../../utils/theme';

export default function ElectionsScreen() {
  const { student }   = useAuth();
  const navigation    = useNavigation();
  const [elections, setElections] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading]     = useState(true);

  const load = async () => {
    try { const r = await getElections(); setElections(r.data || []); }
    catch (err) { Alert.alert('Error', err.message || 'Failed to load elections'); }
    finally { setLoading(false); }
  };
  useFocusEffect(useCallback(() => { load(); }, []));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const onPress = e => {
    if (student?.verification_status !== 'verified')
      return Alert.alert('Not Verified', 'Your account must be verified by the Electoral Commission before you can vote.');
    if (e.has_voted || e.status === 'results_published')
      return navigation.navigate('Results', { election_id: e.id, title: e.title });
    if (!e.has_active_token && e.status === 'active')
      return Alert.alert('No Token', 'You do not have an active voting token. Contact the Electoral Commission.');
    if (e.status === 'active' && !e.has_voted)
      return navigation.navigate('Voting', { election_id: e.id, title: e.title });
    Alert.alert('Election', `This election is ${e.status.replace(/_/g,' ')}.`);
  };

  const active = elections.filter(e => e.status === 'active');
  const past   = elections.filter(e => ['closed','results_published'].includes(e.status));

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />
      <View style={s.header}>
        <Text style={s.headerTitle}>Elections</Text>
        <Text style={s.headerSub}>{student?.verification_status !== 'verified' ? '⚠️ Account pending verification' : `${active.length} active election${active.length !== 1 ? 's' : ''}`}</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}>

        {student?.verification_status !== 'verified' && (
          <View style={s.warnBanner}>
            <Text style={s.warnTitle}>⏳ Verification Pending</Text>
            <Text style={s.warnDesc}>You can view elections but cannot vote until verified by the Electoral Commission.</Text>
          </View>
        )}

        {loading && !elections.length
          ? <View style={{ alignItems: 'center', paddingVertical: 60 }}><Text style={{ fontSize: 40 }}>🗳️</Text><Text style={{ color: colors.textSecondary, marginTop: 12 }}>Loading elections…</Text></View>
          : !elections.length
          ? <View style={{ alignItems: 'center', paddingVertical: 60 }}><Text style={{ fontSize: 56 }}>🗳️</Text><Text style={s.emptyTitle}>No Elections Available</Text><Text style={s.emptyDesc}>Pull down to refresh or check back later</Text></View>
          : <>
            {active.length > 0 && <>
              <Text style={s.sectionLabel}>Active Elections</Text>
              {active.map(e => <ElectionCard key={e.id} election={e} onPress={onPress} />)}
            </>}
            {past.length > 0 && <>
              <Text style={s.sectionLabel}>Past Elections</Text>
              {past.map(e => <ElectionCard key={e.id} election={e} onPress={onPress} />)}
            </>}
          </>}
        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

function ElectionCard({ election: e, onPress }) {
  const cfgs = { active: { label: '● LIVE', bg: colors.successLight, color: colors.success }, closed: { label: 'CLOSED', bg: colors.gray100, color: colors.gray500 }, results_published: { label: 'RESULTS OUT', bg: colors.infoLight, color: colors.info } };
  const cfg  = cfgs[e.status] || cfgs.closed;
  const turnout = e.total_eligible > 0 ? ((e.total_votes / e.total_eligible) * 100).toFixed(0) : 0;
  return (
    <TouchableOpacity style={s.card} onPress={() => onPress(e)} activeOpacity={0.8}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
        <View style={[s.statusBadge, { backgroundColor: cfg.bg }]}><Text style={[s.statusTxt, { color: cfg.color }]}>{cfg.label}</Text></View>
        {e.has_voted
          ? <View style={s.votedBadge}><Text style={s.votedTxt}>✓ Voted</Text></View>
          : e.has_active_token && e.status === 'active'
          ? <View style={s.tokenBadge}><Text style={s.tokenTxt}>🗳 Vote Available</Text></View>
          : null}
      </View>
      <Text style={s.cardTitle}>{e.title}</Text>
      <Text style={s.cardMeta}>{e.academic_year} · {e.semester} semester</Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginVertical: spacing.md }}>
        {[['Positions', e.position_count], ['Candidates', e.candidate_count], ['Votes Cast', e.total_votes], ['Turnout', `${turnout}%`]].map(([l, v]) => (
          <View key={l} style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.primary }}>{v}</Text>
            <Text style={{ fontSize: 10, color: colors.textSecondary, marginTop: 2 }}>{l}</Text>
          </View>
        ))}
      </View>
      <View style={s.progressBar}><View style={[s.progressFill, { width: `${Math.min(turnout, 100)}%`, backgroundColor: e.status === 'active' ? colors.success : colors.primary }]} /></View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm }}>
        <Text style={{ fontSize: 12, color: colors.textSecondary }}>{e.status === 'active' ? `Ends ${new Date(e.end_date).toLocaleDateString()}` : `Ended ${new Date(e.end_date).toLocaleDateString()}`}</Text>
        {(e.has_voted || e.status === 'results_published') && <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '600' }}>View Results →</Text>}
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: colors.background },
  header:  { backgroundColor: colors.primary, padding: spacing.xl, paddingTop: 52 },
  headerTitle: { color: colors.white, fontSize: 26, fontWeight: '800' },
  headerSub:   { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 4 },
  warnBanner:  { backgroundColor: colors.warningLight, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg, borderLeftWidth: 4, borderLeftColor: colors.warning },
  warnTitle:   { fontSize: 14, fontWeight: '700', color: colors.warning, marginBottom: 4 },
  warnDesc:    { fontSize: 13, color: '#92400e', lineHeight: 20 },
  sectionLabel:{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing.md, marginTop: spacing.sm },
  emptyTitle:  { fontSize: 18, fontWeight: '700', color: colors.gray600, marginTop: spacing.md },
  emptyDesc:   { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  card:     { backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.lg, ...shadow.md },
  statusBadge: { paddingVertical: 3, paddingHorizontal: 10, borderRadius: radius.full },
  statusTxt:   { fontSize: 10, fontWeight: '700' },
  votedBadge:  { backgroundColor: colors.successLight, paddingVertical: 3, paddingHorizontal: 10, borderRadius: radius.full },
  votedTxt:    { color: colors.success, fontSize: 11, fontWeight: '600' },
  tokenBadge:  { backgroundColor: colors.primaryLight, paddingVertical: 3, paddingHorizontal: 10, borderRadius: radius.full },
  tokenTxt:    { color: colors.primary, fontSize: 11, fontWeight: '600' },
  cardTitle:   { fontSize: 16, fontWeight: '700', color: colors.gray800, marginBottom: 4 },
  cardMeta:    { fontSize: 12, color: colors.textSecondary },
  progressBar: { height: 6, backgroundColor: colors.gray100, borderRadius: radius.full, overflow: 'hidden' },
  progressFill:{ height: '100%', borderRadius: radius.full },
});
