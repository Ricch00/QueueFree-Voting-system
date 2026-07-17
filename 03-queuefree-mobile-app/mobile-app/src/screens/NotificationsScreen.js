import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, StatusBar } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getNotifications } from '../services/api';
import { colors, spacing, radius, shadow } from '../utils/theme';

const TYPE = {
  election_open:  { emoji: '🗳️', color: colors.success,  bg: colors.successLight },
  election_close: { emoji: '🔒', color: colors.warning,  bg: colors.warningLight },
  results:        { emoji: '📊', color: colors.info,     bg: colors.infoLight },
  verification:   { emoji: '✅', color: colors.primary,  bg: colors.primaryLight },
  system:         { emoji: '📢', color: colors.gray600,  bg: colors.gray100 },
};

const timeAgo = dateStr => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
};

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState([]);
  const [refreshing, setRefreshing]       = useState(false);
  const [loading, setLoading]             = useState(true);

  const load = async () => {
    try {
      const r = await getNotifications();
      setNotifications(r.data || []);
    } catch (_) {}
    finally { setLoading(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />
      <View style={s.header}>
        <Text style={s.headerTitle}>Notifications</Text>
        <Text style={s.headerSub}>
          {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={s.empty}>
            <Text style={{ fontSize: 40 }}>🔔</Text>
            <Text style={s.emptyDesc}>Loading…</Text>
          </View>
        ) : !notifications.length ? (
          <View style={s.empty}>
            <Text style={{ fontSize: 56 }}>🔕</Text>
            <Text style={s.emptyTitle}>No Notifications</Text>
            <Text style={s.emptyDesc}>Election updates and announcements will appear here</Text>
          </View>
        ) : (
          notifications.map(n => {
            const cfg = TYPE[n.type] || TYPE.system;
            return (
              <View key={n.id} style={s.card}>
                <View style={[s.iconWrap, { backgroundColor: cfg.bg }]}>
                  <Text style={{ fontSize: 22 }}>{cfg.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={s.cardTop}>
                    <Text style={s.nTitle} numberOfLines={2}>{n.title}</Text>
                    <Text style={s.nTime}>{timeAgo(n.created_at)}</Text>
                  </View>
                  <Text style={s.nMsg}>{n.message}</Text>
                </View>
              </View>
            );
          })
        )}
        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: colors.background },
  header:     { backgroundColor: colors.primary, padding: spacing.xl, paddingTop: 52 },
  headerTitle:{ color: colors.white, fontSize: 26, fontWeight: '800' },
  headerSub:  { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 4 },
  empty:      { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.gray600 },
  emptyDesc:  { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },
  card:       { backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.md, flexDirection: 'row', gap: spacing.md, ...shadow.sm },
  iconWrap:   { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  nTitle:     { fontSize: 14, fontWeight: '700', color: colors.gray800, flex: 1, marginRight: spacing.sm },
  nMsg:       { fontSize: 13, color: colors.textSecondary, lineHeight: 20 },
  nTime:      { fontSize: 11, color: colors.textLight },
});
