import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ScreenShellProps {
  title: string;
  children: ReactNode;
  actionLabel?: string;
  onActionPress?: () => void;
}

export function ScreenShell({ title, children, actionLabel, onActionPress }: ScreenShellProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}> 
      <View style={styles.header}> 
        <Text style={styles.title}>{title}</Text>
        {actionLabel ? (
          <Pressable onPress={onActionPress} style={styles.actionButton}> 
            <Text style={styles.actionText}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f8fd',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#14213d',
  },
  actionButton: {
    borderRadius: 999,
    backgroundColor: '#e8f2ff',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionText: {
    color: '#2456f5',
    fontSize: 13,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
});
