import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { DeviceMotion } from 'expo-sensors';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';

type AxisName = 'x' | 'y' | 'z';
type ExerciseName = 'Bicep Curl' | 'Tricep Extension';

type LearnedProfile = {
  axis: AxisName;
  upSign: 1 | -1;
  upThreshold: number;
  downThreshold: number;
  reverseThreshold: number;
  resetThreshold: number;
  minUpPeak: number;
  learnedAt?: string;
};

const EXERCISES: ExerciseName[] = ['Bicep Curl', 'Tricep Extension'];
const LEARNED_PROFILE_STORAGE_KEY = 'elevara_learned_profiles_v1';
const EXERCISE_ORDER_STORAGE_KEY = 'elevara_exercise_order_v1';

const lightPalette = {
  screen: '#e6f0f4',
  card: '#ffffff',
  cardBorder: '#d6e4eb',
  text: '#173541',
  muted: '#708792',
  accent: '#d8eef8',
  accentText: '#27404b',
  success: '#39be60',
  warning: '#f2c94c',
  destructive: '#d95b5b',
  neutral: '#4e7383',
};

const darkPalette = {
  screen: '#0d1519',
  card: '#142127',
  cardBorder: '#243841',
  text: '#eef8fb',
  muted: '#91a7b0',
  accent: '#18303a',
  accentText: '#d2e8ef',
  success: '#2f9c52',
  warning: '#d2ad3d',
  destructive: '#b94b4b',
  neutral: '#355565',
};

export default function ExercisesScreen() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? darkPalette : lightPalette;
  const [permissionText, setPermissionText] = useState('Checking motion permission...');
  const [selectedExercise, setSelectedExercise] = useState<ExerciseName>('Bicep Curl');
  const [exerciseOrder, setExerciseOrder] = useState<ExerciseName[]>(EXERCISES);
  const [learning, setLearning] = useState(false);
  const [savedProfiles, setSavedProfiles] = useState<Record<ExerciseName, LearnedProfile | null>>({
    'Bicep Curl': null,
    'Tricep Extension': null,
  });
  const [accel, setAccel] = useState({ x: 0, y: 0, z: 0 });
  const [smoothedValue, setSmoothedValue] = useState(0);

  const learningRef = useRef(false);
  const learningSamplesRef = useRef<{ x: number; y: number; z: number }[]>([]);
  const learningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void loadSavedProfiles();
    void loadExerciseOrder();
  }, []);

  useEffect(() => {
    let subscription: any = null;

    const start = async () => {
      const available = await DeviceMotion.isAvailableAsync();
      if (!available) {
        setPermissionText('Device motion is not available on this phone.');
        return;
      }

      const permission = await DeviceMotion.requestPermissionsAsync();
      if (!permission.granted) {
        setPermissionText('Motion permission not granted.');
        return;
      }

      setPermissionText('Motion ready');
      DeviceMotion.setUpdateInterval(20);

      subscription = DeviceMotion.addListener((data: any) => {
        const a = data.acceleration ?? { x: 0, y: 0, z: 0 };
        const current = {
          x: a.x ?? 0,
          y: a.y ?? 0,
          z: a.z ?? 0,
        };

        setAccel(current);

        if (learningRef.current) {
          learningSamplesRef.current.push(current);
        }

        const axis = savedProfiles[selectedExercise]?.axis;
        const sign = savedProfiles[selectedExercise]?.upSign;

        if (axis && sign) {
          setSmoothedValue(current[axis] * sign);
        } else {
          setSmoothedValue(0);
        }
      });
    };

    void start();

    return () => {
      if (subscription) {
        subscription.remove();
      }
      clearLearningTimer();
    };
  }, [savedProfiles, selectedExercise]);

  const clearLearningTimer = () => {
    if (learningTimerRef.current) {
      clearTimeout(learningTimerRef.current);
      learningTimerRef.current = null;
    }
  };

  const loadSavedProfiles = async () => {
    try {
      const raw = await AsyncStorage.getItem(LEARNED_PROFILE_STORAGE_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as Record<ExerciseName, LearnedProfile | null>;
      setSavedProfiles({
        'Bicep Curl': normalizeLearnedProfile(parsed['Bicep Curl'] ?? null),
        'Tricep Extension': normalizeLearnedProfile(parsed['Tricep Extension'] ?? null),
      });
    } catch (error) {
      console.log('Failed to load saved profiles', error);
    }
  };

  const persistSavedProfiles = async (profiles: Record<ExerciseName, LearnedProfile | null>) => {
    try {
      await AsyncStorage.setItem(LEARNED_PROFILE_STORAGE_KEY, JSON.stringify(profiles));
      setSavedProfiles(profiles);
    } catch (error) {
      console.log('Failed to save learned profiles', error);
    }
  };

  const loadExerciseOrder = async () => {
    try {
      const raw = await AsyncStorage.getItem(EXERCISE_ORDER_STORAGE_KEY);
      if (!raw) {
        setExerciseOrder(EXERCISES);
        return;
      }

      const parsed = JSON.parse(raw) as ExerciseName[];
      setExerciseOrder(normalizeExerciseOrder(parsed));
    } catch (error) {
      console.log('Failed to load exercise order', error);
    }
  };

  const persistExerciseOrder = async (order: ExerciseName[]) => {
    try {
      await AsyncStorage.setItem(EXERCISE_ORDER_STORAGE_KEY, JSON.stringify(order));
      setExerciseOrder(order);
    } catch (error) {
      console.log('Failed to save exercise order', error);
    }
  };

  const moveExercise = async (exercise: ExerciseName, direction: -1 | 1) => {
    const currentIndex = exerciseOrder.indexOf(exercise);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= exerciseOrder.length) {
      return;
    }

    const nextOrder = [...exerciseOrder];
    [nextOrder[currentIndex], nextOrder[nextIndex]] = [nextOrder[nextIndex], nextOrder[currentIndex]];
    await persistExerciseOrder(nextOrder);
    setPermissionText(`${exercise} moved to position ${nextIndex + 1}`);
    void Haptics.selectionAsync();
  };

  const startLearning = () => {
    learningSamplesRef.current = [];
    setLearning(true);
    learningRef.current = true;
    setPermissionText(`Do 1 slow full ${selectedExercise.toLowerCase()} rep now`);
    void Haptics.selectionAsync();

    clearLearningTimer();
    learningTimerRef.current = setTimeout(() => {
      void finishLearning();
    }, 3000);
  };

  const finishLearning = async () => {
    learningRef.current = false;
    setLearning(false);
    clearLearningTimer();

    const samples = learningSamplesRef.current;

    if (samples.length < 20) {
      setPermissionText('Not enough motion captured. Try again with one clean rep.');
      return;
    }

    const axisRanges: Record<AxisName, number> = {
      x: getRange(samples.map((sample) => sample.x)),
      y: getRange(samples.map((sample) => sample.y)),
      z: getRange(samples.map((sample) => sample.z)),
    };

    const axis: AxisName =
      axisRanges.x >= axisRanges.y && axisRanges.x >= axisRanges.z
        ? 'x'
        : axisRanges.y >= axisRanges.z
          ? 'y'
          : 'z';

    const axisSeries = samples.map((sample) => sample[axis]);
    const maxAbs = Math.max(...axisSeries.map((value) => Math.abs(value)));

    if (maxAbs < 0.6) {
      setPermissionText('Sample rep was too small. Move more clearly and try again.');
      return;
    }

    const firstMajorThreshold = maxAbs * 0.3;
    const firstMajorValue =
      axisSeries.find((value) => Math.abs(value) >= firstMajorThreshold) ?? axisSeries[0];

    const upSign: 1 | -1 = firstMajorValue >= 0 ? 1 : -1;
    const signedSeries = axisSeries.map((value) => value * upSign);

    const upPeak = Math.max(...signedSeries);
    const downPeak = Math.max(...signedSeries.map((value) => -value));

    const learnedProfile: LearnedProfile = {
      axis,
      upSign,
      upThreshold: Math.max(0.8, upPeak * 0.5),
      reverseThreshold: Math.max(0.15, upPeak * 0.18),
      downThreshold: Math.max(0.6, downPeak * 0.55),
      resetThreshold: Math.max(0.18, downPeak * 0.22),
      minUpPeak: Math.max(Math.max(0.8, upPeak * 0.5) * 1.15, upPeak * 0.85),
      learnedAt: new Date().toISOString(),
    };

    const nextProfiles = {
      ...savedProfiles,
      [selectedExercise]: learnedProfile,
    };

    await persistSavedProfiles(nextProfiles);
    setPermissionText(`${selectedExercise} profile saved`);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const clearExerciseProfile = async (exercise: ExerciseName) => {
    const nextProfiles = {
      ...savedProfiles,
      [exercise]: null,
    };

    await persistSavedProfiles(nextProfiles);
    if (selectedExercise === exercise) {
      setSmoothedValue(0);
    }
    setPermissionText(`${exercise} profile removed`);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  };

  return (
    <ScrollView
      contentContainerStyle={[styles.scrollContent, { backgroundColor: theme.screen }]}
      showsVerticalScrollIndicator={false}>
      <Text style={[styles.pageTitle, { color: theme.text }]}>Exercises</Text>
      <Text style={[styles.pageSubtitle, { color: theme.muted }]}>
        Learn or relearn each movement here so the workout screen stays focused on sets.
      </Text>

      <View style={[styles.statusCard, { backgroundColor: theme.accent }]}>
        <Text style={[styles.statusText, { color: theme.accentText }]}>{permissionText}</Text>
      </View>

      {exerciseOrder.map((exercise, index) => {
        const profile = savedProfiles[exercise];
        const isSelected = selectedExercise === exercise;
        const freshness = getProfileFreshness(profile?.learnedAt);
        const learnedLabel = profile?.learnedAt
          ? `Saved ${formatRelativeDate(profile.learnedAt)}`
          : 'No saved motion profile yet';

        return (
          <Pressable
            key={exercise}
            style={[
              styles.exerciseCard,
              {
                backgroundColor: theme.card,
                borderColor: isSelected ? theme.success : theme.cardBorder,
              },
            ]}
            onPress={() => setSelectedExercise(exercise)}>
            <View style={styles.cardHeader}>
              <View style={styles.titleWrap}>
                <Text style={[styles.orderIndex, { color: theme.muted }]}>{index + 1}</Text>
                <Text style={[styles.exerciseTitle, { color: theme.text }]}>{exercise}</Text>
              </View>
              <View
                style={[
                  styles.stateBadge,
                  { backgroundColor: profile ? freshness.color : theme.accent },
                ]}>
                <Text style={[styles.stateBadgeText, { color: profile ? '#ffffff' : theme.accentText }]}>
                  {profile ? freshness.label : 'Not learned'}
                </Text>
              </View>
            </View>

            <Text style={[styles.detailText, { color: theme.muted }]}>{learnedLabel}</Text>
            <Text style={[styles.detailText, { color: theme.muted }]}>
              {profile
                ? `Axis ${profile.axis.toUpperCase()} | ${profile.upSign === 1 ? '+' : '-'} direction`
                : 'Run Learn Exercise once to save a motion profile'}
            </Text>

            {profile && (
              <Text style={[styles.detailText, { color: theme.muted }]}>
                Up {profile.upThreshold.toFixed(2)} | Down {profile.downThreshold.toFixed(2)}
              </Text>
            )}

            <View style={styles.orderRow}>
              <Text style={[styles.orderLabel, { color: theme.text }]}>Workout order</Text>
              <View style={styles.orderButtons}>
                <Pressable
                  style={[styles.orderButton, { backgroundColor: theme.neutral }, index === 0 && styles.disabledButton]}
                  disabled={index === 0}
                  onPress={() => {
                    void moveExercise(exercise, -1);
                  }}>
                  <Text style={styles.orderButtonText}>Up</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.orderButton,
                    { backgroundColor: theme.neutral },
                    index === exerciseOrder.length - 1 && styles.disabledButton,
                  ]}
                  disabled={index === exerciseOrder.length - 1}
                  onPress={() => {
                    void moveExercise(exercise, 1);
                  }}>
                  <Text style={styles.orderButtonText}>Down</Text>
                </Pressable>
              </View>
            </View>

            {isSelected && (
              <View style={styles.actionsBlock}>
                <View style={styles.liveRow}>
                  <Text style={[styles.liveLabel, { color: theme.text }]}>Live x/y/z</Text>
                  <Text style={[styles.liveValue, { color: theme.muted }]}>
                    {accel.x.toFixed(2)} / {accel.y.toFixed(2)} / {accel.z.toFixed(2)}
                  </Text>
                </View>
                <View style={styles.liveRow}>
                  <Text style={[styles.liveLabel, { color: theme.text }]}>Signed signal</Text>
                  <Text style={[styles.liveValue, { color: theme.muted }]}>{smoothedValue.toFixed(2)}</Text>
                </View>

                <Pressable
                  style={[styles.primaryButton, { backgroundColor: theme.success }]}
                  onPress={startLearning}>
                  <Text style={styles.primaryButtonText}>
                    {learning ? 'Learning...' : profile ? 'Relearn Exercise' : 'Learn Exercise'}
                  </Text>
                </Pressable>

                {profile && (
                  <Pressable
                    style={[styles.secondaryButton, { backgroundColor: theme.warning }]}
                    onPress={startLearning}>
                    <Text style={styles.secondaryButtonText}>Relearn if phone position changes</Text>
                  </Pressable>
                )}

                {profile && (
                  <Pressable
                    style={[styles.deleteButton, { backgroundColor: theme.destructive }]}
                    onPress={() => {
                      void clearExerciseProfile(exercise);
                    }}>
                    <Text style={styles.deleteButtonText}>Delete Saved Profile</Text>
                  </Pressable>
                )}
              </View>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function getRange(values: number[]) {
  return Math.max(...values) - Math.min(...values);
}

function normalizeLearnedProfile(profile: LearnedProfile | null) {
  if (!profile) {
    return null;
  }

  return {
    ...profile,
    learnedAt: profile.learnedAt ?? new Date().toISOString(),
  };
}

function normalizeExerciseOrder(raw: unknown): ExerciseName[] {
  if (!Array.isArray(raw)) {
    return EXERCISES;
  }

  const seen = new Set<ExerciseName>();
  const normalized = raw.filter((entry): entry is ExerciseName => {
    return EXERCISES.includes(entry as ExerciseName) && !seen.has(entry as ExerciseName)
      ? (seen.add(entry as ExerciseName), true)
      : false;
  });

  return [...normalized, ...EXERCISES.filter((exercise) => !seen.has(exercise))];
}

function getProfileFreshness(learnedAt?: string) {
  if (!learnedAt) {
    return { label: 'Not learned', color: '#6b8794' };
  }

  const learnedTime = new Date(learnedAt).getTime();
  const ageDays = (Date.now() - learnedTime) / (1000 * 60 * 60 * 24);

  if (ageDays <= 7) {
    return { label: 'Fresh', color: '#39be60' };
  }

  if (ageDays <= 21) {
    return { label: 'Okay', color: '#f2c94c' };
  }

  return { label: 'Relearn', color: '#d95b5b' };
}

function formatRelativeDate(value: string) {
  const date = new Date(value);
  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  });
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    padding: 18,
  },
  pageTitle: {
    fontSize: 30,
    fontWeight: '800',
  },
  pageSubtitle: {
    fontSize: 15,
    marginTop: 6,
    marginBottom: 16,
    lineHeight: 21,
  },
  statusCard: {
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
  },
  statusText: {
    fontSize: 15,
    fontWeight: '700',
  },
  exerciseCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  orderIndex: {
    fontSize: 18,
    fontWeight: '800',
    width: 18,
  },
  exerciseTitle: {
    fontSize: 22,
    fontWeight: '800',
    flex: 1,
  },
  stateBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  stateBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  detailText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  orderRow: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  orderLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  orderButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  orderButton: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  disabledButton: {
    opacity: 0.35,
  },
  actionsBlock: {
    marginTop: 14,
  },
  liveRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    gap: 10,
  },
  liveLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  liveValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  primaryButton: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
  },
  secondaryButton: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  secondaryButtonText: {
    color: '#4f4100',
    fontSize: 15,
    fontWeight: '800',
  },
  deleteButton: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  deleteButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
});
