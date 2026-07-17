import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, BackHandler } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { getElectionCandidates, getVotingToken, castVote } from '../../services/api';
import { colors, spacing, radius, shadow } from '../../utils/theme';

export default function VotingScreen() {
  const route      = useRoute();
  const navigation = useNavigation();
  const { election_id, title } = route.params;

  const [positions,    setPositions]    = useState([]);
  const [selections,   setSelections]   = useState({});
  const [votingToken,  setVotingToken]  = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [submitting,   setSubmitting]   = useState(false);
  const [step,         setStep]         = useState('selecting'); // selecting | review | success
  const [tokenError,   setTokenError]   = useState(null);

  useEffect(() => {
    loadData();
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step === 'success') return true;
      Alert.alert('Leave Voting?', 'Your selections will be lost.', [
        { text: 'Stay', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: () => navigation.goBack() }
      ]);
      return true;
    });
    return () => back.remove();
  }, []);

  const loadData = async () => {
    try {
      const [posRes, tokenRes] = await Promise.all([
        getElectionCandidates(election_id),
        getVotingToken(election_id)
      ]);
      setPositions(posRes.data || []);
      setVotingToken(tokenRes.data?.token);
    } catch (err) {
      if (err.already_voted) setStep('success');
      else setTokenError(err.message || 'Failed to load election data');
    } finally { setLoading(false); }
  };

  const select = (posId, candId) => {
    if (step === 'review') return;
    setSelections(prev => {
      if (prev[posId] === candId) { const u = { ...prev }; delete u[posId]; return u; }
      return { ...prev, [posId]: candId };
    });
  };

  const submitVote = async () => {
    Alert.alert('⚠️ Confirm Your Vote',
      'Once submitted, your vote CANNOT be changed. This is final and your voting token will be consumed.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Submit Vote', style: 'destructive', onPress: async () => {
          setSubmitting(true);
          try {
            const votes = Object.entries(selections).map(([pos_id, cand_id]) => ({
              position_id: parseInt(pos_id), candidate_id: parseInt(cand_id)
            }));
            await castVote({ election_id, voting_token: votingToken, votes });
            setStep('success');
          } catch (err) {
            Alert.alert('Vote Failed', err.message || 'Failed to submit. Please try again.');
          } finally { setSubmitting(false); }
        }}
      ]
    );
  };

  if (loading) return <View style={s.centered}><ActivityIndicator size="large" color={colors.primary} /><Text style={{ marginTop: 16, color: colors.textSecondary }}>Loading election…</Text></View>;

  if (tokenError) return (
    <View style={s.centered}>
      <Text style={{ fontSize: 48 }}>❌</Text>
      <Text style={s.errTitle}>Cannot Vote</Text>
      <Text style={s.errDesc}>{tokenError}</Text>
      <TouchableOpacity style={[s.btn, { marginTop: 24 }]} onPress={() => navigation.goBack()}><Text style={s.btnTxt}>Go Back</Text></TouchableOpacity>
    </View>
  );

  if (step === 'success') return (
    <View style={[s.centered, { padding: spacing.xxl }]}>
      <Text style={{ fontSize: 72 }}>✅</Text>
      <Text style={s.successTitle}>Vote Cast Successfully!</Text>
      <Text style={s.successDesc}>Your vote has been recorded securely and anonymously. Your voting token has been consumed — you cannot vote again in this election.</Text>
      <View style={s.successInfo}>
        <Text style={s.successInfoTxt}>🔒 Vote is anonymised and encrypted</Text>
        <Text style={s.successInfoTxt}>📊 Results available after election closes</Text>
        <Text style={s.successInfoTxt}>✓ One device, one vote enforced</Text>
      </View>
      <TouchableOpacity style={[s.btn, { marginTop: 24, width: '100%' }]} onPress={() => navigation.navigate('Results', { election_id, title })}>
        <Text style={s.btnTxt}>View Live Results →</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[s.btnOutline, { marginTop: 12, width: '100%' }]} onPress={() => navigation.navigate('Main')}>
        <Text style={s.btnOutlineTxt}>Back to Home</Text>
      </TouchableOpacity>
    </View>
  );

  const total    = positions.length;
  const selected = Object.keys(selections).length;

  return (
    <View style={s.root}>
      {/* Progress bar */}
      <View style={s.progressWrap}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.gray700 }}>
            {step === 'review' ? '📋 Review your votes before submitting' : `${selected} of ${total} positions selected`}
          </Text>
          <View style={{ backgroundColor: colors.successLight, paddingVertical: 2, paddingHorizontal: 8, borderRadius: radius.full }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: colors.success }}>🔒 Secure</Text>
          </View>
        </View>
        <View style={s.progressBar}>
          <View style={[s.progressFill, { width: step === 'review' ? '100%' : `${total > 0 ? (selected / total) * 100 : 0}%` }]} />
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg }} showsVerticalScrollIndicator={false}>
        {step === 'review' && (
          <View style={s.reviewBanner}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.warning, marginBottom: 4 }}>⚠️ Review Your Selections</Text>
            <Text style={{ fontSize: 13, color: '#92400e', lineHeight: 20 }}>Please review carefully. Once submitted, your vote cannot be changed.</Text>
          </View>
        )}

        {positions.map(pos => (
          <View key={pos.id} style={s.posCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={s.posTitle}>{pos.title}</Text>
              {selections[pos.id]
                ? <View style={{ backgroundColor: colors.successLight, paddingVertical: 3, paddingHorizontal: 8, borderRadius: radius.full }}><Text style={{ color: colors.success, fontSize: 11, fontWeight: '600' }}>✓ Selected</Text></View>
                : <View style={{ backgroundColor: colors.gray100, paddingVertical: 3, paddingHorizontal: 8, borderRadius: radius.full }}><Text style={{ color: colors.gray500, fontSize: 11 }}>Select 1</Text></View>}
            </View>
            {pos.description ? <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: spacing.md }}>{pos.description}</Text> : null}

            {!pos.candidates?.length
              ? <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: 'center', padding: spacing.md }}>No candidates</Text>
              : pos.candidates.map(c => {
                const sel = selections[pos.id] === c.id;
                return (
                  <TouchableOpacity key={c.id} style={[s.candCard, sel && s.candCardSel]}
                    onPress={() => select(pos.id, c.id)} disabled={step === 'review'} activeOpacity={0.8}>
                    <View style={[s.candAvatar, sel && { backgroundColor: colors.primary }]}>
                      <Text style={[s.candInitial, sel && { color: colors.white }]}>{(c.nickname || c.full_name).charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.candName, sel && { color: colors.primary }]}>{c.nickname || c.full_name}</Text>
                      {c.nickname && <Text style={{ fontSize: 12, color: colors.textSecondary }}>{c.full_name}</Text>}
                      <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{c.program} · Level {c.level}</Text>
                      {c.manifesto ? <Text style={{ fontSize: 12, color: colors.gray500, marginTop: 4, fontStyle: 'italic', lineHeight: 17 }} numberOfLines={2}>{c.manifesto}</Text> : null}
                    </View>
                    <View style={[s.radio, sel && s.radioSel]}>{sel && <View style={s.radioDot} />}</View>
                  </TouchableOpacity>
                );
              })}
          </View>
        ))}
        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={s.bottomBar}>
        {step === 'selecting'
          ? <TouchableOpacity style={[s.btn, selected === 0 && { backgroundColor: colors.gray300 }]} onPress={() => setStep('review')} disabled={selected === 0}>
              <Text style={s.btnTxt}>Review My Vote ({selected} selected)</Text>
            </TouchableOpacity>
          : <View style={{ gap: 10 }}>
              <TouchableOpacity style={s.btn} onPress={submitVote} disabled={submitting}>
                {submitting ? <ActivityIndicator color={colors.white} /> : <Text style={s.btnTxt}>✓ Submit Final Vote</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={s.btnOutline} onPress={() => setStep('selecting')}>
                <Text style={s.btnOutlineTxt}>← Edit Selections</Text>
              </TouchableOpacity>
            </View>}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: colors.background },
  centered:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl, backgroundColor: colors.background },
  progressWrap:{ backgroundColor: colors.white, padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  progressBar: { height: 6, backgroundColor: colors.gray100, borderRadius: radius.full, overflow: 'hidden' },
  progressFill:{ height: '100%', backgroundColor: colors.primary, borderRadius: radius.full },
  reviewBanner:{ backgroundColor: colors.warningLight, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg, borderLeftWidth: 4, borderLeftColor: colors.warning },
  posCard:     { backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.lg, ...shadow.sm },
  posTitle:    { fontSize: 16, fontWeight: '700', color: colors.gray800, flex: 1 },
  candCard:    { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, borderWidth: 2, borderColor: colors.border, marginTop: spacing.md },
  candCardSel: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  candAvatar:  { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.gray100, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  candInitial: { fontSize: 20, fontWeight: '700', color: colors.gray600 },
  candName:    { fontSize: 15, fontWeight: '700', color: colors.gray800 },
  radio:       { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.gray300, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  radioSel:    { borderColor: colors.primary },
  radioDot:    { width: 11, height: 11, borderRadius: 6, backgroundColor: colors.primary },
  bottomBar:   { padding: spacing.lg, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.border },
  btn:         { backgroundColor: colors.primary, borderRadius: radius.lg, padding: 15, alignItems: 'center' },
  btnTxt:      { color: colors.white, fontSize: 15, fontWeight: '700' },
  btnOutline:  { borderRadius: radius.lg, padding: 13, alignItems: 'center', borderWidth: 1.5, borderColor: colors.primary },
  btnOutlineTxt: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  errTitle:    { fontSize: 20, fontWeight: '700', color: colors.danger, marginTop: 12, marginBottom: 8 },
  errDesc:     { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  successTitle:{ fontSize: 26, fontWeight: '800', color: colors.success, marginTop: 12, marginBottom: 12, textAlign: 'center' },
  successDesc: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: spacing.xl },
  successInfo: { backgroundColor: colors.successLight, borderRadius: radius.lg, padding: spacing.lg, gap: 8, width: '100%' },
  successInfoTxt: { fontSize: 13, color: colors.success, fontWeight: '500' },
});
