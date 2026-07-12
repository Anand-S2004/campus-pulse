import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, Animated, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ScreenShell } from '../../src/components/ScreenShell';
import { createPost } from '../../src/lib/api';
import type { PostCategory } from '../../src/types';

type FormValues = {
  description: string;
  locationLabel: string;
  category: PostCategory;
};

const CATEGORY_OPTIONS: Array<{ value: PostCategory; label: string }> = [
  { value: 'kindness', label: 'Kindness' },
  { value: 'academic', label: 'Academic' },
  { value: 'food', label: 'Food' },
  { value: 'social', label: 'Social' },
  { value: 'music', label: 'Music' },
  { value: 'sports', label: 'Sports' },
  { value: 'other', label: 'Other' },
];

export default function CreateScreen() {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [success, setSuccess] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [bounce] = useState(new Animated.Value(1));

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<FormValues>({
    defaultValues: {
      description: '',
      locationLabel: 'Campus community',
      category: 'kindness',
    },
  });

  useEffect(() => {
    if (!success) {
      return;
    }

    Animated.sequence([
      Animated.timing(bounce, { toValue: 1.08, duration: 160, useNativeDriver: true }),
      Animated.timing(bounce, { toValue: 1, duration: 140, useNativeDriver: true }),
    ]).start();
  }, [bounce, success]);

  const onSubmit = async (values: FormValues) => {
    if (!values.description.trim() || values.description.trim().length > 280) {
      Alert.alert('Keep it short and warm', 'Share a brief positive moment or a kind thought.');
      return;
    }

    if (!values.locationLabel.trim()) {
      Alert.alert('Add a location label', 'A simple place name helps the post feel grounded.');
      return;
    }

    setBusy(true);
    setSuccess(false);
    setProgress(0);

    const interval = setInterval(() => {
      setProgress((current) => (current >= 90 ? 90 : current + 18));
    }, 120);

    try {
      await createPost({
        description: values.description,
        locationLabel: values.locationLabel,
        category: values.category,
      });
      clearInterval(interval);
      setProgress(100);
      setSuccess(true);
      reset();
      setImageUri(null);
      setTimeout(() => router.back(), 900);
    } catch (error) {
      clearInterval(interval);
      Alert.alert('Could not share', error instanceof Error ? error.message : 'Please try again in a moment.');
    } finally {
      clearInterval(interval);
      setBusy(false);
      setTimeout(() => setProgress(0), 1200);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access if you want to attach a local preview.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, quality: 0.8 });
    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  };

  return (
    <ScreenShell title="Share a gentle moment" actionLabel="Back" onActionPress={() => router.back()}>
      <View style={styles.card}>
        <Text style={styles.copy}>Your post will be reviewed before appearing in the feed, so it stays calm and respectful.</Text>

        <Controller
          control={control}
          name="description"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={styles.textArea}
              placeholder="What felt uplifting today?"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              multiline
              maxLength={280}
            />
          )}
        />
        {errors.description ? <Text style={styles.error}>{errors.description.message}</Text> : null}

        <Controller
          control={control}
          name="locationLabel"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={styles.input}
              placeholder="Where did it happen?"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
            />
          )}
        />
        {errors.locationLabel ? <Text style={styles.error}>{errors.locationLabel.message}</Text> : null}

        <View style={styles.categoryRow}>
          {CATEGORY_OPTIONS.map((option) => {
            const active = watch('category') === option.value;
            return (
              <Pressable
                key={option.value}
                style={[styles.categoryChip, active && styles.categoryChipActive]}
                onPress={() => setValue('category', option.value)}
              >
                <Text style={[styles.categoryText, active && styles.categoryTextActive]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable style={styles.photoButton} onPress={pickImage}>
          <Text style={styles.photoButtonText}>{imageUri ? 'Change photo preview' : 'Add an optional photo preview'}</Text>
        </Pressable>
        {imageUri ? <Image source={{ uri: imageUri }} style={styles.previewImage} /> : null}

        <Pressable style={styles.primaryButton} onPress={handleSubmit(onSubmit)}>
          <Text style={styles.primaryButtonText}>{busy ? 'Sharing…' : 'Share now'}</Text>
        </Pressable>

        {busy ? <View style={styles.progressBar}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View> : null}
        {success ? (
          <Animated.View style={[styles.successBox, { transform: [{ scale: bounce }] }]}> 
            <Text style={styles.successText}>Shared and added to the feed.</Text>
          </Animated.View>
        ) : null}
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    gap: 10,
  },
  copy: {
    color: '#4b5563',
    fontSize: 13,
    lineHeight: 19,
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 110,
    textAlignVertical: 'top',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#eff6ff',
  },
  categoryChipActive: {
    backgroundColor: '#2456f5',
  },
  categoryText: {
    color: '#2456f5',
    fontSize: 12,
    fontWeight: '600',
  },
  categoryTextActive: {
    color: '#ffffff',
  },
  photoButton: {
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  photoButtonText: {
    color: '#1f2937',
    fontWeight: '600',
  },
  previewImage: {
    width: '100%',
    height: 180,
    borderRadius: 12,
  },
  primaryButton: {
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: '#2456f5',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  progressBar: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2456f5',
  },
  successBox: {
    backgroundColor: '#ecfdf3',
    borderRadius: 12,
    padding: 12,
  },
  successText: {
    color: '#166534',
    fontWeight: '600',
  },
  error: {
    color: '#b91c1c',
    fontSize: 12,
  },
});
