// ResultsScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, StatusBar } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { getResults } from '../../services/api';
import { colors, spacing, radius, shadow } from '../../utils/theme';

export default function ResultsScreen() {
  const route = useRoute();
  const { election_id } = route.params;
  const [data, setData]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getResults(election_id)
      .then(r => { setData(r.data); setLoading(false); })
      .catch(err => { setError(err); setLoading(false); });
  }, [election_id]);

  if (loading) return <View style={s.centered}><ActivityIndicator size="large" color={colors.primary} /><Text style={{ marginTop: 16, color: colors.textSecondary }}>Loading results…</Text></View>;

  if (error) return (
    <View style={s.centered}>
      <Text style={{ fontSize: 48 }}>{error.must_vote_first ? '🗳️' : '❌'}</Text>
      <Text style={s.errTitle}>{error.must_vote_first ? 'Vote First!' : 'Cannot Load Results'}</Text>
      <Text style={s.errDesc}>{error.message}</Text>
    </View>
  );

  const { election, results, stats } = data;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg }} showsVerticalScrollIndicator={false}>
        {/* Header card */}
        <View style={s.headerCard}>
          <Text style={s.hTitle}>{election.title}</Text>
          <Text style={s.hSub}>{election.academic_year} · {election.semester} semester</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.lg, marginBottom: spacing.md }}>
            {[['Total Votes', stats.total_votes], ['Eligible', stats.total_eligible], ['Turnout', `${stats.turnout}%`]].map(([l, v]) => (
              <View key={l} style={{ alignItems: 'center', flex: 1 }}>
                <Text style={{ fontSize: 24, fontWeight: '800', color: colors.white }}>{v}</Text>
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>{l}</Text>
              </View>
            ))}
          </View>
          <View style={s.turnoutBar}><View style={[s.turnoutFill, { width: `${Math.min(stats.turnout, 100)}%` }]} /></View>
          <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 6 }}>{stats.turnout}% voter turnout</Text>
        </View>

        {results?.map(({ position, candidates, total_votes }) => (
          <View key={position.id} style={s.posCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.gray100 }}>
              <Text style={s.posTitle}>{position.title}</Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary }}>{total_votes} votes</Text>
            </View>
            {!candidates.length
              ? <Text style={{ color: colors.textSecondary, fontSize: 13 }}>No candidates</Text>
              : candidates.map((c, i) => {
                const pct = parseFloat(c.percentage);
                const win = i === 0 && total_votes > 0;
                return (
                  <View key={c.id} style={[s.candRow, win && s.candRowWin]}>
                    <View style={[s.rank, win && { backgroundColor: '#f59e0b' }]}>
                      <Text style={[s.rankTxt, win && { color: colors.white }]}>{win ? '🏆' : `${i+1}`}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[s.candName, win && { color: colors.primary }]}>{c.full_name}</Text>
                        {win && total_votes > 0 && <View style={{ backgroundColor: colors.primary, paddingVertical: 2, paddingHorizontal: 7, borderRadius: radius.full }}><Text style={{ fontSize: 9, fontWeight: '700', color: colors.white }}>Winner</Text></View>}
                      </View>
                      {c.nickname && <Text style={{ fontSize: 12, color: colors.textSecondary, fontStyle: 'italic' }}>"{c.nickname}"</Text>}
                      <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2, marginBottom: 6 }}>{c.program} · Level {c.level}</Text>
                      <View style={s.resultBar}><View style={[s.resultFill, { width: `${pct}%`, backgroundColor: win ? colors.success : colors.primary }]} /></View>
                    </View>
                    <View style={{ alignItems: 'flex-end', marginLeft: spacing.sm }}>
                      <Text style={[s.voteNum, win && { color: colors.success }]}>{c.vote_count}</Text>
                      <Text style={{ fontSize: 11, color: colors.textSecondary }}>{pct}%</Text>
                    </View>
                  </View>
                );
              })}
          </View>
        ))}
        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:     { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  headerCard: { backgroundColor: colors.primary, borderRadius: radius.xl, padding: spacing.xl, marginBottom: spacing.lg },
  hTitle:   { fontSize: 18, fontWeight: '800', color: colors.white, marginBottom: 4 },
  hSub:     { fontSize: 13, color: 'rgba(255,255,255,0.7)' },
  turnoutBar: { height: 8, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: radius.full, overflow: 'hidden' },
  turnoutFill:{ height: '100%', backgroundColor: colors.white, borderRadius: radius.full },
  posCard:  { backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.lg, ...shadow.sm },
  posTitle: { fontSize: 16, fontWeight: '700', color: colors.gray800 },
  candRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.gray50 },
  candRowWin: { backgroundColor: colors.primaryLight, borderWidth: 1.5, borderColor: colors.primary },
  rank:     { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.gray200, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginRight: spacing.sm },
  rankTxt:  { fontSize: 12, fontWeight: '700', color: colors.gray600 },
  candName: { fontSize: 14, fontWeight: '700', color: colors.gray800 },
  resultBar:{ height: 5, backgroundColor: colors.gray200, borderRadius: radius.full, overflow: 'hidden' },
  resultFill:{ height: '100%', borderRadius: radius.full },
  voteNum:  { fontSize: 18, fontWeight: '800', color: colors.primary },
  errTitle: { fontSize: 20, fontWeight: '700', color: colors.gray700, marginTop: 12, marginBottom: 8, textAlign: 'center' },
  errDesc:  { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
});
