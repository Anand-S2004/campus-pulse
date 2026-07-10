import { useQuery } from '@tanstack/react-query';
import { StyleSheet, Text, View } from 'react-native';

import { ScreenShell } from '../../src/components/ScreenShell';
import { fetchWeeklyRecap } from '../../src/lib/api';

export default function RecapScreen() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['weekly-recap'],
    queryFn: fetchWeeklyRecap,
  });

  return (
    <ScreenShell title="Weekly recap">
      <View style={styles.card}>
        {isLoading ? <Text style={styles.body}>Preparing your encouraging recap…</Text> : null}
        {error ? <Text style={styles.body}>A recap will appear here once the weekly summary is ready.</Text> : null}
        {data ? (
          <>
            <Text style={styles.eyebrow}>This week’s gentle highlights</Text>
            <Text style={styles.headline}>{data.headline}</Text>
            <Text style={styles.body}>{data.body}</Text>
          </>
        ) : null}
        {!isLoading && !error && !data ? (
          <Text style={styles.body}>A recap will appear here once your weekly summary is ready.</Text>
        ) : null}
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
  },
  eyebrow: {
    color: '#2456f5',
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headline: {
    fontSize: 20,
    fontWeight: '700',
    color: '#14213d',
    marginBottom: 10,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: '#4b5563',
  },
});
