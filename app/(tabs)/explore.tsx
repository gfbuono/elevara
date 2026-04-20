import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';

type ExerciseName = 'Bicep Curl' | 'Tricep Extension';

type WorkoutSet = {
  id: string;
  reps: number;
  weight: number | null;
  timestamp: string;
};

type WorkoutSession = {
  id: string;
  exercise: ExerciseName;
  startedAt: string;
  sets: WorkoutSet[];
};

const WORKOUT_STORAGE_KEY = 'elevara_workout_history_v1';
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
};

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? darkPalette : lightPalette;
  const [workoutHistory, setWorkoutHistory] = useState<WorkoutSession[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadWorkoutHistory = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(WORKOUT_STORAGE_KEY);
      if (raw) {
        setWorkoutHistory(JSON.parse(raw));
      } else {
        setWorkoutHistory([]);
      }
    } catch (error) {
      console.log('Failed to load workout history', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadWorkoutHistory();
    }, [loadWorkoutHistory])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadWorkoutHistory();
    setRefreshing(false);
  }, [loadWorkoutHistory]);

  const totalWorkouts = workoutHistory.length;
  const totalSets = workoutHistory.reduce((sum, workout) => sum + workout.sets.length, 0);
  const totalReps = workoutHistory.reduce(
    (sum, workout) => sum + workout.sets.reduce((setSum, set) => setSum + set.reps, 0),
    0
  );

  return (
    <ScrollView
      contentContainerStyle={[styles.scrollContent, { backgroundColor: theme.screen }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}>
      <View style={[styles.headerCard, { backgroundColor: theme.header }]}>
        <Text style={[styles.pageTitle, { color: theme.statText }]}>Profile</Text>
        <Text style={[styles.pageSubtitle, { color: theme.headerMuted }]}>Your saved workout history lives here.</Text>

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
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Saved Workouts</Text>
        {workoutHistory.length === 0 ? (
          <Text style={[styles.emptyText, { color: theme.muted }]}>
            Finish a workout from the main screen and it will show up here.
          </Text>
        ) : (
          workoutHistory.map((workout, workoutIndex) => {
            const workoutReps = workout.sets.reduce((sum, set) => sum + set.reps, 0);

            return (
              <View
                key={`${workout.id}-${workoutIndex}`}
                style={[
                  styles.workoutCard,
                  { backgroundColor: theme.workoutCard, borderColor: theme.workoutBorder },
                ]}>
                <View style={styles.workoutHeader}>
                  <Text style={[styles.workoutTitle, { color: theme.text }]}>{workout.exercise}</Text>
                  <Text style={[styles.workoutDate, { color: theme.muted }]}>{workout.startedAt}</Text>
                </View>

                <View style={styles.workoutMetaRow}>
                  <Text style={[styles.workoutMeta, { color: theme.text }]}>{workout.sets.length} sets</Text>
                  <Text style={[styles.workoutMeta, { color: theme.text }]}>{workoutReps} reps</Text>
                </View>

                {workout.sets.map((set, setIndex) => (
                  <View key={set.id} style={[styles.setRow, { backgroundColor: theme.card }]}>
                    <Text style={[styles.setText, { color: theme.text }]}>
                      Set {setIndex + 1}: {set.reps} reps
                      {set.weight !== null ? ` @ ${set.weight} lb` : ''}
                    </Text>
                    <Text style={[styles.setSubtext, { color: theme.muted }]}>{set.timestamp}</Text>
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
  },
  sectionTitle: {
    color: '#163746',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 12,
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
  workoutMetaRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 4,
  },
  workoutMeta: {
    color: '#3c5f6e',
    fontSize: 14,
    fontWeight: '700',
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
