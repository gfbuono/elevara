import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';

type ExerciseName = 'Bicep Curl' | 'Tricep Extension';

type WorkoutSet = {
  id: string;
  reps: number;
  weight: number | null;
  note?: string;
  timestamp: string;
};

type WorkoutSession = {
  id: string;
  exercise: ExerciseName;
  startedAt: string;
  sets: WorkoutSet[];
};

type WorkoutRecord = {
  id: string;
  startedAt: string;
  title: string;
  note: string;
  exercises: WorkoutSession[];
};

type WorkoutDraft = {
  selectedExercise: ExerciseName;
  activeExercise: ExerciseName | null;
  exerciseSessions: Record<ExerciseName, WorkoutSession | null>;
  title: string;
  note: string;
  exerciseOrder: ExerciseName[];
};

const WORKOUT_STORAGE_KEY = 'elevara_workout_history_v1';
const WORKOUT_DRAFT_STORAGE_KEY = 'elevara_workout_draft_v1';
const EXERCISES: ExerciseName[] = ['Bicep Curl', 'Tricep Extension'];

const lightPalette = {
  screen: '#eef5f8',
  header: '#163746',
  headerMuted: '#bfd3dd',
  card: '#ffffff',
  workoutCard: '#f3f8fb',
  workoutBorder: '#dce8ee',
  text: '#173541',
  muted: '#6a818c',
  statCard: '#21495a',
  statText: '#ffffff',
  accent: '#d8eef8',
  accentText: '#27404b',
};
const darkPalette = {
  screen: '#0d1519',
  header: '#10242d',
  headerMuted: '#98b1bc',
  card: '#111c21',
  workoutCard: '#16242a',
  workoutBorder: '#243841',
  text: '#eef8fb',
  muted: '#91a7b0',
  statCard: '#1a3440',
  statText: '#ffffff',
  accent: '#18303a',
  accentText: '#d2e8ef',
};

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? darkPalette : lightPalette;
  const [workoutHistory, setWorkoutHistory] = useState<WorkoutRecord[]>([]);
  const [workoutDraft, setWorkoutDraft] = useState<WorkoutDraft | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [historyRaw, draftRaw] = await Promise.all([
        AsyncStorage.getItem(WORKOUT_STORAGE_KEY),
        AsyncStorage.getItem(WORKOUT_DRAFT_STORAGE_KEY),
      ]);

      setWorkoutHistory(historyRaw ? normalizeWorkoutHistory(JSON.parse(historyRaw)) : []);
      setWorkoutDraft(draftRaw ? normalizeWorkoutDraft(JSON.parse(draftRaw)) : null);
    } catch (error) {
      console.log('Failed to load profile data', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const totalWorkouts = workoutHistory.length;
  const totalSets = workoutHistory.reduce(
    (sum, workout) =>
      sum + workout.exercises.reduce((exerciseSum, exercise) => exerciseSum + exercise.sets.length, 0),
    0
  );
  const totalReps = workoutHistory.reduce(
    (sum, workout) =>
      sum +
      workout.exercises.reduce(
        (exerciseSum, exercise) =>
          exerciseSum + exercise.sets.reduce((setSum, set) => setSum + set.reps, 0),
        0
      ),
    0
  );

  const analytics = useMemo(() => {
    const allSessions = workoutHistory.flatMap((workout) =>
      workout.exercises.map((exercise) => ({
        ...exercise,
        workoutTitle: workout.title,
        workoutStartedAt: workout.startedAt,
      }))
    );

    return EXERCISES.map((exercise) => {
      const sessions = allSessions.filter((session) => session.exercise === exercise);
      const recentSession = sessions[0] ?? null;
      const lastWeightedSet =
        sessions.flatMap((session) => session.sets).find((set) => set.weight !== null) ?? null;
      const bestSet =
        sessions
          .flatMap((session) => session.sets)
          .sort((a, b) => {
            const weightA = a.weight ?? 0;
            const weightB = b.weight ?? 0;
            if (weightB !== weightA) {
              return weightB - weightA;
            }
            return b.reps - a.reps;
          })[0] ?? null;

      return {
        exercise,
        recentSession,
        lastWeightedSet,
        bestSet,
      };
    });
  }, [workoutHistory]);

  const insightStats = useMemo(() => {
    const now = new Date();
    const startOfWeek = new Date(now);
    const dayOffset = (startOfWeek.getDay() + 6) % 7;
    startOfWeek.setDate(startOfWeek.getDate() - dayOffset);
    startOfWeek.setHours(0, 0, 0, 0);

    const workoutsThisWeek = workoutHistory.filter((workout) => new Date(workout.startedAt) >= startOfWeek);
    const setsThisWeek = workoutsThisWeek.reduce(
      (sum, workout) => sum + workout.exercises.reduce((exerciseSum, exercise) => exerciseSum + exercise.sets.length, 0),
      0
    );
    const repsThisWeek = workoutsThisWeek.reduce(
      (sum, workout) =>
        sum +
        workout.exercises.reduce(
          (exerciseSum, exercise) =>
            exerciseSum + exercise.sets.reduce((setSum, set) => setSum + set.reps, 0),
          0
        ),
      0
    );

    const workoutDays = new Set(
      workoutHistory.map((workout) => new Date(workout.startedAt).toDateString())
    );

    let streak = 0;
    for (let i = 0; i < 30; i += 1) {
      const day = new Date();
      day.setDate(day.getDate() - i);
      if (workoutDays.has(day.toDateString())) {
        streak += 1;
      } else if (i > 0) {
        break;
      }
    }

    return {
      workoutsThisWeek: workoutsThisWeek.length,
      setsThisWeek,
      repsThisWeek,
      recentDays: workoutDays.size,
      streak,
    };
  }, [workoutHistory]);

  const personalRecords = useMemo(() => {
    return EXERCISES.map((exercise) => {
      const sets = workoutHistory
        .flatMap((workout) => workout.exercises)
        .filter((session) => session.exercise === exercise)
        .flatMap((session) => session.sets);

      const bestWeight = sets.reduce((best, set) => Math.max(best, set.weight ?? 0), 0);
      const bestReps = sets.reduce((best, set) => Math.max(best, set.reps), 0);

      return {
        exercise,
        bestWeight,
        bestReps,
      };
    });
  }, [workoutHistory]);

  const draftSessions = workoutDraft
    ? workoutDraft.exerciseOrder
        .map((exercise) => workoutDraft.exerciseSessions[exercise])
        .filter((session): session is WorkoutSession => Boolean(session && session.sets.length > 0))
    : [];
  const draftSets = draftSessions.reduce((sum, session) => sum + session.sets.length, 0);
  const draftReps = draftSessions.reduce(
    (sum, session) => sum + session.sets.reduce((sessionSum, set) => sessionSum + set.reps, 0),
    0
  );

  return (
    <ScrollView
      contentContainerStyle={[styles.scrollContent, { backgroundColor: theme.screen }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}>
      <View style={[styles.headerCard, { backgroundColor: theme.header }]}>
        <Text style={[styles.pageTitle, { color: theme.statText }]}>Profile</Text>
        <Text style={[styles.pageSubtitle, { color: theme.headerMuted }]}>
          Track your current draft, finished workouts, and quick progress trends.
        </Text>

        <View style={styles.statGrid}>
          <View style={[styles.statCard, { backgroundColor: theme.statCard }]}>
            <Text style={[styles.statValue, { color: theme.statText }]}>{totalWorkouts}</Text>
            <Text style={[styles.statLabel, { color: theme.headerMuted }]}>Workouts</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.statCard }]}>
            <Text style={[styles.statValue, { color: theme.statText }]}>{totalSets}</Text>
            <Text style={[styles.statLabel, { color: theme.headerMuted }]}>Sets</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.statCard }]}>
            <Text style={[styles.statValue, { color: theme.statText }]}>{totalReps}</Text>
            <Text style={[styles.statLabel, { color: theme.headerMuted }]}>Reps</Text>
          </View>
        </View>
      </View>

      <View style={[styles.sectionCard, { backgroundColor: theme.card }]}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Current Draft</Text>
        </View>

        {!workoutDraft || draftSessions.length === 0 ? (
          <Text style={[styles.emptyText, { color: theme.muted }]}>
            Start a workout and any unfinished sets will show up here if the app closes.
          </Text>
        ) : (
          <View
            style={[
              styles.workoutCard,
              { backgroundColor: theme.workoutCard, borderColor: theme.workoutBorder },
            ]}>
            <Text style={[styles.workoutTitle, { color: theme.text }]}>
              {workoutDraft.title.trim() || 'Current workout'}
            </Text>
            {Boolean(workoutDraft.note.trim()) && (
              <Text style={[styles.workoutNote, { color: theme.muted }]}>{workoutDraft.note}</Text>
            )}
            <View style={styles.workoutMetaRow}>
              <Text style={[styles.workoutMeta, { color: theme.text }]}>{draftSessions.length} exercises</Text>
              <Text style={[styles.workoutMeta, { color: theme.text }]}>{draftSets} sets</Text>
              <Text style={[styles.workoutMeta, { color: theme.text }]}>{draftReps} reps</Text>
            </View>

            {draftSessions.map((exercise) => (
              <View key={exercise.id} style={styles.exerciseBlock}>
                <Text style={[styles.exerciseTitle, { color: theme.text }]}>{exercise.exercise}</Text>
                {exercise.sets.map((set, index) => (
                  <View key={set.id} style={[styles.setRow, { backgroundColor: theme.card }]}>
                    <Text style={[styles.setText, { color: theme.text }]}>
                      Set {index + 1}: {set.reps} reps
                      {set.weight !== null ? ` @ ${set.weight} lb` : ''}
                    </Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={[styles.sectionCard, { backgroundColor: theme.card }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Quick Analytics</Text>
        {analytics.map((item) => (
          <View
            key={item.exercise}
            style={[
              styles.analyticsCard,
              { backgroundColor: theme.workoutCard, borderColor: theme.workoutBorder },
            ]}>
            <Text style={[styles.analyticsTitle, { color: theme.text }]}>{item.exercise}</Text>
            <Text style={[styles.analyticsText, { color: theme.muted }]}>
              Last weight: {item.lastWeightedSet?.weight !== null && item.lastWeightedSet ? `${item.lastWeightedSet.weight} lb` : 'No weighted set yet'}
            </Text>
            <Text style={[styles.analyticsText, { color: theme.muted }]}>
              Best set: {item.bestSet ? `${item.bestSet.reps} reps${item.bestSet.weight !== null ? ` @ ${item.bestSet.weight} lb` : ''}` : 'No finished set yet'}
            </Text>
            <Text style={[styles.analyticsText, { color: theme.muted }]}>
              Recent workout: {item.recentSession ? item.recentSession.startedAt : 'No recent workout yet'}
            </Text>
          </View>
        ))}
      </View>

      <View style={[styles.sectionCard, { backgroundColor: theme.card }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Personal Records</Text>
        {personalRecords.map((record) => (
          <View
            key={record.exercise}
            style={[
              styles.analyticsCard,
              { backgroundColor: theme.workoutCard, borderColor: theme.workoutBorder },
            ]}>
            <Text style={[styles.analyticsTitle, { color: theme.text }]}>{record.exercise}</Text>
            <Text style={[styles.analyticsText, { color: theme.muted }]}>
              Best weight: {record.bestWeight > 0 ? `${record.bestWeight} lb` : 'No weighted set yet'}
            </Text>
            <Text style={[styles.analyticsText, { color: theme.muted }]}>
              Best reps: {record.bestReps > 0 ? `${record.bestReps} reps` : 'No sets yet'}
            </Text>
          </View>
        ))}
      </View>

      <View style={[styles.sectionCard, { backgroundColor: theme.card }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Consistency</Text>
        <View style={styles.statGrid}>
          <View style={[styles.statCard, { backgroundColor: theme.statCard }]}>
            <Text style={[styles.statValue, { color: theme.statText }]}>{insightStats.workoutsThisWeek}</Text>
            <Text style={[styles.statLabel, { color: theme.headerMuted }]}>This Week</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.statCard }]}>
            <Text style={[styles.statValue, { color: theme.statText }]}>{insightStats.recentDays}</Text>
            <Text style={[styles.statLabel, { color: theme.headerMuted }]}>Active Days</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.statCard }]}>
            <Text style={[styles.statValue, { color: theme.statText }]}>{insightStats.streak}</Text>
            <Text style={[styles.statLabel, { color: theme.headerMuted }]}>Day Streak</Text>
          </View>
        </View>
        <View style={styles.workoutMetaRow}>
          <Text style={[styles.workoutMeta, { color: theme.text }]}>{insightStats.setsThisWeek} sets this week</Text>
          <Text style={[styles.workoutMeta, { color: theme.text }]}>{insightStats.repsThisWeek} reps this week</Text>
        </View>
      </View>

      <View style={[styles.sectionCard, { backgroundColor: theme.card }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Past Workouts</Text>
        {workoutHistory.length === 0 ? (
          <Text style={[styles.emptyText, { color: theme.muted }]}>
            Finish a workout from the main screen and it will show up here.
          </Text>
        ) : (
          workoutHistory.map((workout, workoutIndex) => {
            const workoutSets = workout.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
            const workoutReps = workout.exercises.reduce(
              (sum, exercise) => sum + exercise.sets.reduce((setSum, set) => setSum + set.reps, 0),
              0
            );

            return (
              <View
                key={`${workout.id}-${workoutIndex}`}
                style={[
                  styles.workoutCard,
                  { backgroundColor: theme.workoutCard, borderColor: theme.workoutBorder },
                ]}>
                <View style={styles.workoutHeader}>
                  <Text style={[styles.workoutTitle, { color: theme.text }]}>
                    {workout.title.trim() || `Workout ${workoutIndex + 1}`}
                  </Text>
                  <Text style={[styles.workoutDate, { color: theme.muted }]}>{workout.startedAt}</Text>
                </View>

                {Boolean(workout.note.trim()) && (
                  <Text style={[styles.workoutNote, { color: theme.muted }]}>{workout.note}</Text>
                )}

                <View style={styles.workoutMetaRow}>
                  <Text style={[styles.workoutMeta, { color: theme.text }]}>{workout.exercises.length} exercises</Text>
                  <Text style={[styles.workoutMeta, { color: theme.text }]}>{workoutSets} sets</Text>
                  <Text style={[styles.workoutMeta, { color: theme.text }]}>{workoutReps} reps</Text>
                </View>

                {workout.exercises.map((exercise) => (
                  <View key={exercise.id} style={styles.exerciseBlock}>
                    <Text style={[styles.exerciseTitle, { color: theme.text }]}>{exercise.exercise}</Text>
                    {exercise.sets.map((set, setIndex) => (
                      <View key={set.id} style={[styles.setRow, { backgroundColor: theme.card }]}>
                        <Text style={[styles.setText, { color: theme.text }]}>
                          Set {setIndex + 1}: {set.reps} reps
                          {set.weight !== null ? ` @ ${set.weight} lb` : ''}
                        </Text>
                        {Boolean(set.note) && (
                          <Text style={[styles.setSubtext, { color: theme.muted }]}>{set.note}</Text>
                        )}
                        <Text style={[styles.setSubtext, { color: theme.muted }]}>{set.timestamp}</Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    backgroundColor: '#eef5f8',
    padding: 18,
  },
  headerCard: {
    backgroundColor: '#163746',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
  },
  pageTitle: {
    color: '#f5fbff',
    fontSize: 30,
    fontWeight: '800',
  },
  pageSubtitle: {
    color: '#bfd3dd',
    fontSize: 15,
    marginTop: 6,
    marginBottom: 18,
  },
  statGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#21495a',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  statValue: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
  },
  statLabel: {
    color: '#c9dde6',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#163746',
    fontSize: 22,
    fontWeight: '800',
  },
  emptyText: {
    color: '#6b8390',
    fontSize: 15,
    lineHeight: 21,
  },
  workoutCard: {
    backgroundColor: '#f3f8fb',
    borderRadius: 18,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#dce8ee',
  },
  workoutHeader: {
    marginBottom: 6,
  },
  workoutTitle: {
    color: '#173541',
    fontSize: 20,
    fontWeight: '800',
  },
  workoutDate: {
    color: '#6a818c',
    fontSize: 13,
    marginTop: 2,
  },
  workoutNote: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  workoutMetaRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  workoutMeta: {
    color: '#3c5f6e',
    fontSize: 14,
    fontWeight: '700',
  },
  analyticsCard: {
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    marginTop: 12,
  },
  analyticsTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  analyticsText: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 3,
  },
  exerciseBlock: {
    marginTop: 10,
  },
  exerciseTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 2,
  },
  setRow: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
  },
  setText: {
    color: '#173541',
    fontSize: 16,
    fontWeight: '700',
  },
  setSubtext: {
    color: '#76909b',
    fontSize: 13,
    marginTop: 4,
  },
});

function normalizeWorkoutHistory(raw: unknown): WorkoutRecord[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.map((entry, index) => {
    if (
      entry &&
      typeof entry === 'object' &&
      'exercises' in entry &&
      Array.isArray((entry as WorkoutRecord).exercises)
    ) {
      const record = entry as WorkoutRecord;
      return {
        id: record.id ?? `workout-${index}`,
        startedAt: record.startedAt ?? new Date().toLocaleString(),
        title: record.title ?? 'Workout',
        note: record.note ?? '',
        exercises: record.exercises ?? [],
      };
    }

    const session = entry as WorkoutSession;
    return {
      id: session.id ?? `workout-${index}`,
      startedAt: session.startedAt ?? new Date().toLocaleString(),
      title: session.exercise ?? 'Workout',
      note: '',
      exercises: [session],
    };
  });
}

function normalizeWorkoutDraft(raw: unknown): WorkoutDraft | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const draft = raw as Partial<WorkoutDraft>;
  const exerciseOrder = normalizeExerciseOrder(draft.exerciseOrder);

  return {
    selectedExercise: draft.selectedExercise ?? exerciseOrder[0],
    activeExercise: draft.activeExercise ?? null,
    exerciseSessions: {
      'Bicep Curl': draft.exerciseSessions?.['Bicep Curl'] ?? null,
      'Tricep Extension': draft.exerciseSessions?.['Tricep Extension'] ?? null,
    },
    title: draft.title ?? 'Arms Day',
    note: draft.note ?? '',
    exerciseOrder,
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
