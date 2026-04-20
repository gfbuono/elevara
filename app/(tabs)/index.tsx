import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from '@react-navigation/native';
import { DeviceMotion } from 'expo-sensors';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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
};

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
const LEARNED_PROFILE_STORAGE_KEY = 'elevara_learned_profiles_v1';
const EXERCISES: ExerciseName[] = ['Bicep Curl', 'Tricep Extension'];
const TARGET_SETS = 5;
const lightPalette = {
  screen: '#dce8ee',
  frame: '#f8fbfd',
  frameBorder: '#bdd0da',
  text: '#173541',
  textMuted: '#6d828c',
  title: '#132c39',
  pill: '#d8eef8',
  pillText: '#27404b',
  card: '#ffffff',
  cardBorder: '#e2edf2',
  cardSelected: '#9ed3ea',
  summary: '#eef5f8',
  summaryLabel: '#5c7280',
  summaryValue: '#193540',
  bottomBarBorder: '#e2eaee',
  inactiveTab: '#a0afb7',
  dock: '#132f3b',
  dockBadge: '#214555',
  dockText: '#f6fbfd',
  dockMuted: '#c4d9e1',
  finishButton: '#edf4f7',
  finishButtonBorder: '#d4e2e8',
  finishButtonText: '#173f51',
  inputBg: '#fbfdfe',
  inputBorder: '#d3e4eb',
  previousBg: '#eef7dc',
  previousText: '#586a1d',
};
const darkPalette = {
  screen: '#0d1519',
  frame: '#111c21',
  frameBorder: '#22353d',
  text: '#edf6fa',
  textMuted: '#98aeb7',
  title: '#f1fafc',
  pill: '#18303a',
  pillText: '#d2e8ef',
  card: '#16242a',
  cardBorder: '#243841',
  cardSelected: '#3e7488',
  summary: '#142127',
  summaryLabel: '#8da3ac',
  summaryValue: '#eef8fb',
  bottomBarBorder: '#23353d',
  inactiveTab: '#72858d',
  dock: '#061015',
  dockBadge: '#17303b',
  dockText: '#f5fbfd',
  dockMuted: '#a9c1ca',
  finishButton: '#1a2a31',
  finishButtonBorder: '#2b434c',
  finishButtonText: '#f0f8fb',
  inputBg: '#0f1b20',
  inputBorder: '#2a3e46',
  previousBg: '#273217',
  previousText: '#d8ebb0',
};

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? darkPalette : lightPalette;
  const [permissionText, setPermissionText] = useState('Checking motion permission...');
  const [accel, setAccel] = useState({ x: 0, y: 0, z: 0 });
  const [smoothedValue, setSmoothedValue] = useState(0);
  const [selectedExercise, setSelectedExercise] = useState<ExerciseName>('Bicep Curl');
  const [running, setRunning] = useState(false);
  const [reps, setReps] = useState(0);
  const [repState, setRepState] = useState('idle');
  const [activeSession, setActiveSession] = useState<WorkoutSession | null>(null);
  const [exerciseSessions, setExerciseSessions] = useState<
    Record<ExerciseName, WorkoutSession | null>
  >({
    'Bicep Curl': null,
    'Tricep Extension': null,
  });
  const [savedProfiles, setSavedProfiles] = useState<Record<ExerciseName, LearnedProfile | null>>({
    'Bicep Curl': null,
    'Tricep Extension': null,
  });
  const [workoutHistory, setWorkoutHistory] = useState<WorkoutSession[]>([]);
  const [learnedAxis, setLearnedAxis] = useState<AxisName | null>(null);
  const [learnedUpSign, setLearnedUpSign] = useState<1 | -1 | null>(null);
  const [upThresholdText, setUpThresholdText] = useState('--');
  const [downThresholdText, setDownThresholdText] = useState('--');
  const [reverseThresholdText, setReverseThresholdText] = useState('--');
  const [clockNow, setClockNow] = useState(() => new Date());
  const [restSecondsLeft, setRestSecondsLeft] = useState(0);
  const [isRestTimerRunning, setIsRestTimerRunning] = useState(false);
  const [weightInputs, setWeightInputs] = useState<Record<ExerciseName, string>>({
    'Bicep Curl': '',
    'Tricep Extension': '',
  });
  const [editingWeightSetId, setEditingWeightSetId] = useState<string | null>(null);
  const [editingWeightValue, setEditingWeightValue] = useState('');

  const runningRef = useRef(false);
  const profileRef = useRef<LearnedProfile | null>(null);
  const logicStateRef = useRef<'ready' | 'up' | 'peak' | 'down'>('ready');
  const smoothWindowRef = useRef<number[]>([]);
  const sawDownPeakRef = useRef(false);
  const lastRepTimeRef = useRef(0);
  const upPeakRef = useRef(0);
  const downStateStartedAtRef = useRef(0);

  useEffect(() => {
    void loadWorkoutHistory();
    void loadSavedProfiles();
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadSavedProfiles();
    }, [])
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setClockNow(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    applyLearnedProfile(savedProfiles[selectedExercise]);
  }, [savedProfiles, selectedExercise]);

  useEffect(() => {
    if (!isRestTimerRunning) {
      return;
    }

    const timer = setInterval(() => {
      setRestSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsRestTimerRunning(false);
          pulseSuccess();
          return 0;
        }

        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isRestTimerRunning]);

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

        if (runningRef.current && profileRef.current) {
          processRunningSample(current);
        }
      });
    };

    start();

    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, []);

  const loadWorkoutHistory = async () => {
    try {
      const raw = await AsyncStorage.getItem(WORKOUT_STORAGE_KEY);
      if (raw) {
        setWorkoutHistory(JSON.parse(raw));
      }
    } catch (error) {
      console.log('Failed to load workout history', error);
    }
  };

  const persistWorkoutHistory = async (history: WorkoutSession[]) => {
    try {
      await AsyncStorage.setItem(WORKOUT_STORAGE_KEY, JSON.stringify(history));
      setWorkoutHistory(history);
    } catch (error) {
      console.log('Failed to save workout history', error);
    }
  };

  const loadSavedProfiles = async () => {
    try {
      const raw = await AsyncStorage.getItem(LEARNED_PROFILE_STORAGE_KEY);
      if (!raw) {
        setSavedProfiles({
          'Bicep Curl': null,
          'Tricep Extension': null,
        });
        clearProfileDisplay();
        return;
      }

      const parsed = JSON.parse(raw) as Record<ExerciseName, LearnedProfile | null>;
      const nextProfiles = {
        'Bicep Curl': parsed['Bicep Curl'] ?? null,
        'Tricep Extension': parsed['Tricep Extension'] ?? null,
      };

      setSavedProfiles(nextProfiles);
      applyLearnedProfile(nextProfiles[selectedExercise]);
    } catch (error) {
      console.log('Failed to load saved profiles', error);
    }
  };

  const clearProfileDisplay = () => {
    profileRef.current = null;
    setLearnedAxis(null);
    setLearnedUpSign(null);
    setUpThresholdText('--');
    setDownThresholdText('--');
    setReverseThresholdText('--');
  };

  const applyLearnedProfile = (profile: LearnedProfile | null) => {
    if (!profile) {
      clearProfileDisplay();
      return;
    }

    profileRef.current = profile;
    setLearnedAxis(profile.axis);
    setLearnedUpSign(profile.upSign);
    setUpThresholdText(profile.upThreshold.toFixed(2));
    setDownThresholdText(profile.downThreshold.toFixed(2));
    setReverseThresholdText(profile.reverseThreshold.toFixed(2));
  };

  const resetCounterState = () => {
    runningRef.current = false;
    setRunning(false);
    setReps(0);
    setSmoothedValue(0);
    setRepState('idle');
    setIsRestTimerRunning(false);
    setRestSecondsLeft(0);
    smoothWindowRef.current = [];
    logicStateRef.current = 'ready';
    sawDownPeakRef.current = false;
    lastRepTimeRef.current = 0;
    upPeakRef.current = 0;
    downStateStartedAtRef.current = 0;
  };

  const handleExerciseChange = (exercise: ExerciseName) => {
    if (running || activeSession) {
      setPermissionText('Finish or discard the current workout before changing exercise');
      return;
    }

    setSelectedExercise(exercise);
    applyLearnedProfile(savedProfiles[exercise]);
    resetCounterState();
    setPermissionText(
      savedProfiles[exercise]
        ? `Selected ${exercise}. Saved profile ready.`
        : `Selected ${exercise}. Save a profile in Exercises first.`
    );
  };

  const getAxisValue = (
    values: { x: number; y: number; z: number },
    axis: AxisName
  ) => values[axis];

  const resetToReady = () => {
    logicStateRef.current = 'ready';
    sawDownPeakRef.current = false;
    upPeakRef.current = 0;
    downStateStartedAtRef.current = 0;
    smoothWindowRef.current = [];
    setRepState('ready');
  };

  const pulseLight = () => {
    void Haptics.selectionAsync();
  };

  const pulseSuccess = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const pulseWarning = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  };

  const startRestTimer = (seconds = 90) => {
    setRestSecondsLeft(seconds);
    setIsRestTimerRunning(true);
  };

  const cancelRestTimer = () => {
    setIsRestTimerRunning(false);
    setRestSecondsLeft(0);
  };

  const completeRep = (timestamp: number) => {
    setReps((prev) => prev + 1);
    lastRepTimeRef.current = timestamp;
    pulseLight();
    resetToReady();
  };

  const processRunningSample = (currentAccel: { x: number; y: number; z: number }) => {
    const profile = profileRef.current;
    if (!profile) return;

    const rawSigned = getAxisValue(currentAccel, profile.axis) * profile.upSign;

    smoothWindowRef.current.push(rawSigned);
    if (smoothWindowRef.current.length > 4) {
      smoothWindowRef.current.shift();
    }

    const smooth =
      smoothWindowRef.current.reduce((sum, v) => sum + v, 0) /
      smoothWindowRef.current.length;

    setSmoothedValue(smooth);

    const now = Date.now();
    const logicState = logicStateRef.current;

    if (logicState === 'ready') {
      if (smooth >= profile.upThreshold && now - lastRepTimeRef.current > 220) {
        logicStateRef.current = 'up';
        upPeakRef.current = smooth;
        sawDownPeakRef.current = false;
        downStateStartedAtRef.current = 0;
        setRepState('moving up');
      }
      return;
    }

    if (logicState === 'up') {
      if (smooth > upPeakRef.current) {
        upPeakRef.current = smooth;
      }

      if (upPeakRef.current < profile.minUpPeak && smooth <= profile.resetThreshold) {
        resetToReady();
        return;
      }

      const peakPct = profile.minUpPeak > 0
        ? Math.min(100, Math.round((upPeakRef.current / profile.minUpPeak) * 100))
        : 0;
      setRepState(`moving up (${peakPct}%)`);

      if (
        upPeakRef.current >= profile.minUpPeak &&
        smooth < upPeakRef.current * 0.7 &&
        smooth < profile.upThreshold * 0.9
      ) {
        logicStateRef.current = 'peak';
        setRepState('at peak');
      }
      return;
    }

    if (logicState === 'peak') {
      if (smooth >= profile.upThreshold) {
        if (smooth > upPeakRef.current) {
          upPeakRef.current = smooth;
        }
        logicStateRef.current = 'up';
        setRepState('moving up');
        return;
      }

      if (smooth <= -profile.reverseThreshold) {
        logicStateRef.current = 'down';
        downStateStartedAtRef.current = now;
        setRepState('moving down');
      }
      return;
    }

    if (logicState === 'down') {
      const neutralBand = Math.max(profile.resetThreshold, profile.downThreshold * 0.45);
      const downElapsed = now - downStateStartedAtRef.current;

      if (smooth <= -profile.downThreshold) {
        sawDownPeakRef.current = true;
      }

      if (
        sawDownPeakRef.current &&
        upPeakRef.current >= profile.minUpPeak &&
        Math.abs(smooth) <= neutralBand &&
        now - lastRepTimeRef.current > 350
      ) {
        completeRep(now);
        return;
      }

      if (
        downElapsed > 1400 &&
        now - lastRepTimeRef.current > 350 &&
        (smooth >= -profile.reverseThreshold * 0.25 ||
          Math.abs(smooth) <= profile.downThreshold * 0.8)
      ) {
        if (sawDownPeakRef.current && upPeakRef.current >= profile.minUpPeak) {
          completeRep(now);
        } else {
          resetToReady();
        }
      }
    }
  };

  const startSet = () => {
    if (!profileRef.current) {
      pulseWarning();
      setPermissionText('No saved profile. Go to Exercises to learn this movement first.');
      return;
    }

    const existingSession = exerciseSessions[selectedExercise];
    const sessionToUse =
      activeSession?.exercise === selectedExercise
        ? activeSession
        : existingSession ??
          ({
            id: Date.now().toString(),
            exercise: selectedExercise,
            startedAt: new Date().toLocaleString(),
            sets: [],
          } as WorkoutSession);

    setActiveSession(sessionToUse);
    setExerciseSessions((prev) => ({
      ...prev,
      [selectedExercise]: sessionToUse,
    }));

    smoothWindowRef.current = [];
    logicStateRef.current = 'ready';
    sawDownPeakRef.current = false;
    lastRepTimeRef.current = 0;
    downStateStartedAtRef.current = 0;
    setReps(0);
    setSmoothedValue(0);
    setRepState('ready');
    cancelRestTimer();
    runningRef.current = true;
    setRunning(true);
    pulseLight();
    setPermissionText(`Set ${sessionToUse.sets.length + 1} running`);
  };

  const stopSet = () => {
    runningRef.current = false;
    setRunning(false);
    setRepState('idle');

    if (reps <= 0) {
      setPermissionText('No reps recorded for this set');
      return;
    }

    const parsedWeight = Number.parseFloat(weightInputs[selectedExercise]);
    const weight = Number.isFinite(parsedWeight) && parsedWeight > 0 ? parsedWeight : null;

    const newSet: WorkoutSet = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      reps,
      weight,
      timestamp: new Date().toLocaleString(),
    };

    const baseSession =
      (activeSession?.exercise === selectedExercise ? activeSession : null) ??
      exerciseSessions[selectedExercise] ??
      ({
        id: Date.now().toString(),
        exercise: selectedExercise,
        startedAt: new Date().toLocaleString(),
        sets: [],
      } as WorkoutSession);

    const nextSession: WorkoutSession = {
      ...baseSession,
      sets: [...baseSession.sets, newSet],
    };
    const nextSetNumber = nextSession.sets.length;

    setActiveSession(nextSession);
    setExerciseSessions((prev) => ({
      ...prev,
      [selectedExercise]: nextSession,
    }));

    startRestTimer();
    pulseSuccess();
    setPermissionText(
      `Set ${nextSetNumber} added: ${reps} reps${weight !== null ? ` @ ${weight} lb` : ''}`
    );
    setReps(0);
    setSmoothedValue(0);
    smoothWindowRef.current = [];
    logicStateRef.current = 'ready';
    sawDownPeakRef.current = false;
    lastRepTimeRef.current = 0;
    upPeakRef.current = 0;
    downStateStartedAtRef.current = 0;
  };

  const finishWorkout = async () => {
    const completedSessions = EXERCISES
      .map((exercise) => exerciseSessions[exercise])
      .filter((session): session is WorkoutSession => Boolean(session && session.sets.length > 0));

    if (completedSessions.length === 0) {
      setPermissionText('No workout session to save');
      return;
    }

    const updatedHistory = [...completedSessions, ...workoutHistory];
    await persistWorkoutHistory(updatedHistory);

    setActiveSession(null);
    setExerciseSessions({
      'Bicep Curl': null,
      'Tricep Extension': null,
    });
    resetCounterState();
    pulseSuccess();
    const totalSets = completedSessions.reduce((sum, session) => sum + session.sets.length, 0);
    const totalReps = completedSessions.reduce(
      (sum, session) => sum + session.sets.reduce((sessionSum, set) => sessionSum + set.reps, 0),
      0
    );
    setPermissionText(`Workout saved (${totalSets} sets, ${totalReps} reps)`);
  };

  const confirmFinishWorkout = () => {
    const hasDraftWorkout = EXERCISES.some((exercise) => Boolean(exerciseSessions[exercise]));

    if (!hasDraftWorkout) {
      setPermissionText('No workout session to save');
      return;
    }

    Alert.alert('Are you sure?', 'Finishing will save this workout to your profile history.', [
      {
        text: 'Continue Workout',
        style: 'cancel',
      },
      {
        text: 'Finish Workout',
        onPress: () => {
          void finishWorkout();
        },
      },
    ]);
  };

  const finishExercise = () => {
    if (!activeSession) {
      pulseWarning();
      setPermissionText('No active exercise to finish');
      return;
    }

    if (activeSession.sets.length === 0) {
      setExerciseSessions((prev) => ({
        ...prev,
        [activeSession.exercise]: null,
      }));
      setActiveSession(null);
      resetCounterState();
      pulseLight();
      setPermissionText(`${activeSession.exercise} closed with no logged sets`);
      return;
    }

    const totalReps = activeSession.sets.reduce((sum, set) => sum + set.reps, 0);
    const nextExercise =
      activeSession.exercise === 'Bicep Curl' ? 'Tricep Extension' : 'Bicep Curl';

    setActiveSession(null);
    setSelectedExercise(nextExercise);
    resetCounterState();
    pulseSuccess();
    setPermissionText(
      `${activeSession.exercise} ready to revisit (${activeSession.sets.length} sets, ${totalReps} reps). ${nextExercise} selected`
    );
  };

  const resetCurrentSet = () => {
    resetCounterState();
    setPermissionText('Current set counter reset');
  };

  const deleteSet = (exercise: ExerciseName, setId: string) => {
    if (running && activeSession?.exercise === exercise) {
      pulseWarning();
      setPermissionText('Stop the current set before deleting logged sets');
      return;
    }

    const sessionToEdit =
      (activeSession?.exercise === exercise ? activeSession : null) ?? exerciseSessions[exercise];

    if (!sessionToEdit) {
      pulseWarning();
      setPermissionText('No editable sets found for that exercise');
      return;
    }

    Alert.alert('Delete set?', 'This will remove the selected set from the current workout.', [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          const remainingSets = sessionToEdit.sets.filter((set) => set.id !== setId);

          if (remainingSets.length === sessionToEdit.sets.length) {
            return;
          }

          const updatedSession: WorkoutSession = {
            ...sessionToEdit,
            sets: remainingSets,
          };

          setExerciseSessions((prev) => ({
            ...prev,
            [exercise]: updatedSession,
          }));

          if (activeSession?.exercise === exercise) {
            setActiveSession(updatedSession);
          }

          pulseLight();
          setPermissionText(
            remainingSets.length > 0
              ? `Deleted a set from ${exercise}. ${remainingSets.length} set${remainingSets.length === 1 ? '' : 's'} remaining`
              : `Deleted the last set from ${exercise}`
          );
        },
      },
    ]);
  };

  const beginWeightEdit = (setId: string, currentWeight: number | null) => {
    setEditingWeightSetId(setId);
    setEditingWeightValue(currentWeight === null ? '' : String(currentWeight));
  };

  const cancelWeightEdit = () => {
    setEditingWeightSetId(null);
    setEditingWeightValue('');
  };

  const saveEditedWeight = (exercise: ExerciseName, setId: string) => {
    const sessionToEdit =
      (activeSession?.exercise === exercise ? activeSession : null) ?? exerciseSessions[exercise];

    if (!sessionToEdit) {
      cancelWeightEdit();
      return;
    }

    const parsedWeight = Number.parseFloat(editingWeightValue);
    const nextWeight = Number.isFinite(parsedWeight) && parsedWeight > 0 ? parsedWeight : null;

    const updatedSession: WorkoutSession = {
      ...sessionToEdit,
      sets: sessionToEdit.sets.map((set) =>
        set.id === setId
          ? {
              ...set,
              weight: nextWeight,
            }
          : set
      ),
    };

    setExerciseSessions((prev) => ({
      ...prev,
      [exercise]: updatedSession,
    }));

    if (activeSession?.exercise === exercise) {
      setActiveSession(updatedSession);
    }

    pulseLight();
    cancelWeightEdit();
    setPermissionText(
      `Updated ${exercise} weight${nextWeight !== null ? ` to ${nextWeight} lb` : ''}`
    );
  };

  const formatTimer = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }

    return `${pad(minutes)}:${pad(seconds)}`;
  };

  const formatClock = (date: Date) =>
    date.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    });

  const formatDate = (date: Date) =>
    date.toLocaleDateString([], {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

  const getDraftWorkoutForExercise = (exercise: ExerciseName) => {
    if (activeSession?.exercise === exercise) {
      return activeSession;
    }

    if (exerciseSessions[exercise]) {
      return exerciseSessions[exercise];
    }

    return null;
  };

  const getLastCompletedWorkout = (exercise: ExerciseName) =>
    workoutHistory.find((session) => session.exercise === exercise) ?? null;

  const currentSession =
    activeSession?.exercise === selectedExercise
      ? activeSession
      : exerciseSessions[selectedExercise];
  const currentSetNumber = Math.min((currentSession?.sets.length ?? 0) + 1, TARGET_SETS);
  const totalRepsForSession = currentSession?.sets.reduce((sum, set) => sum + set.reps, 0) ?? 0;
  const restTimerLabel = formatTimer(restSecondsLeft);
  const selectedWorkoutTitle =
    selectedExercise === 'Bicep Curl' ? 'Biceps Focus' : 'Triceps Focus';
  const liveAxisValue = learnedAxis !== null ? accel[learnedAxis].toFixed(2) : '--';
  const selectedWeightInput = weightInputs[selectedExercise];

  return (
    <View style={[styles.screen, { backgroundColor: theme.screen }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { backgroundColor: theme.screen }]}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.phoneFrame,
            { backgroundColor: theme.frame, borderColor: theme.frameBorder },
          ]}>
        <View style={styles.topMetaRow}>
          <Text style={[styles.metaText, { color: theme.textMuted }]}>{formatDate(clockNow)}</Text>
          <Text style={[styles.metaTime, { color: theme.textMuted }]}>{formatClock(clockNow)}</Text>
        </View>

        <Text style={[styles.pageTitle, { color: theme.title }]}>{selectedWorkoutTitle}</Text>

        <View style={[styles.infoPill, { backgroundColor: theme.pill }]}>
          <Text style={[styles.infoPillLabel, { color: theme.pillText }]}>Current Set</Text>
          <Text style={[styles.infoPillValue, { color: theme.pillText }]}>
            {currentSession ? currentSetNumber : 'Ready'}
          </Text>
        </View>

        <View style={[styles.infoPill, { backgroundColor: theme.pill }]}>
          <Text style={[styles.infoPillLabel, { color: theme.pillText }]}>Rest Timer</Text>
          <Text style={[styles.infoPillValue, { color: theme.pillText }]}>
            {isRestTimerRunning ? restTimerLabel : 'Done'}
          </Text>
        </View>

        {EXERCISES.map((exercise, index) => {
          const isSelected = selectedExercise === exercise;
          const exerciseSession = getDraftWorkoutForExercise(exercise);
          const lastCompletedSession = getLastCompletedWorkout(exercise);
          const editableSession =
            (activeSession?.exercise === exercise ? activeSession : null) ?? exerciseSessions[exercise];
          const loggedSets = exerciseSession?.sets ?? [];
          const isActiveExercise = activeSession?.exercise === exercise;
          const previewSets = loggedSets;
          const exerciseStateLabel = running && isActiveExercise
            ? 'Counting'
            : isActiveExercise
            ? 'Active'
            : isSelected
            ? 'Selected'
            : null;
          const exerciseStateStyle = running && isActiveExercise
            ? styles.exerciseStateCounting
            : isActiveExercise
            ? styles.exerciseStateActive
            : styles.exerciseStateSelected;

          return (
            <Pressable
              key={exercise}
              style={[
                styles.exerciseCard,
                {
                  backgroundColor: theme.card,
                  borderColor: isSelected ? theme.cardSelected : theme.cardBorder,
                },
                isActiveExercise && styles.exerciseCardActive,
                running && !isActiveExercise && styles.exerciseCardMuted,
                isSelected && styles.exerciseCardSelected,
              ]}
              disabled={running && !isActiveExercise}
              onPress={() => handleExerciseChange(exercise)}
            >
              <View style={styles.exerciseHeader}>
                <Text style={[styles.exerciseTitle, { color: theme.text }]}>
                  {index + 1}. {exercise}
                </Text>
                <View style={styles.exerciseHeaderRight}>
                  {exerciseStateLabel && (
                    <View style={[styles.exerciseStateBadge, exerciseStateStyle]}>
                      <Text style={styles.exerciseStateText}>{exerciseStateLabel}</Text>
                    </View>
                  )}
                  <Ionicons
                    name={isSelected ? 'ellipsis-horizontal-circle' : 'ellipsis-horizontal'}
                    size={20}
                    color={theme.textMuted}
                  />
                </View>
              </View>

              {lastCompletedSession && (
                <View style={[styles.lastWorkoutBanner, { backgroundColor: theme.previousBg }]}>
                  <Text style={[styles.lastWorkoutBannerText, { color: theme.previousText }]}>
                    Previous: {lastCompletedSession.startedAt}
                  </Text>
                </View>
              )}

              {lastCompletedSession && (
                <View style={styles.previousChipRow}>
                  {lastCompletedSession.sets.map((set, setIndex) => (
                    <View
                      key={`last-${set.id}`}
                      style={[styles.previousChip, { backgroundColor: theme.previousBg }]}>
                      <Text style={[styles.previousChipText, { color: theme.previousText }]}>
                        P{setIndex + 1}: {set.reps}
                        {set.weight !== null ? ` @ ${set.weight}` : ''}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {previewSets.length > 0 ? (
                previewSets.map((set, setIndex) => (
                  <View key={set.id} style={styles.setRow}>
                    <View style={styles.setInfo}>
                      <Ionicons
                        name="checkmark-circle"
                        size={18}
                        color={setIndex < loggedSets.length ? theme.text : theme.textMuted}
                      />
                      <View style={styles.setTextWrap}>
                        <Text style={[styles.setText, { color: theme.text }]}>
                          Set {setIndex + 1}: {set.reps} Reps
                        </Text>
                        {editableSession && (
                          editingWeightSetId === set.id ? (
                            <View style={styles.inlineWeightEditor}>
                              <TextInput
                                value={editingWeightValue}
                                onChangeText={(value) => setEditingWeightValue(value.replace(/[^0-9.]/g, ''))}
                                keyboardType="decimal-pad"
                                placeholder="lb"
                                placeholderTextColor={theme.textMuted}
                                style={[
                                  styles.inlineWeightInput,
                                  {
                                    backgroundColor: theme.inputBg,
                                    borderColor: theme.inputBorder,
                                    color: theme.text,
                                  },
                                ]}
                              />
                              <Pressable
                                style={styles.inlineWeightAction}
                                onPress={() => saveEditedWeight(exercise, set.id)}>
                                <Text style={styles.inlineWeightActionText}>Save</Text>
                              </Pressable>
                              <Pressable
                                style={styles.inlineWeightCancel}
                                onPress={cancelWeightEdit}>
                                <Text style={styles.inlineWeightCancelText}>Cancel</Text>
                              </Pressable>
                            </View>
                          ) : (
                            <Pressable
                              hitSlop={6}
                              onPress={() => beginWeightEdit(set.id, set.weight)}>
                              <Text style={[styles.setWeightText, { color: theme.textMuted }]}>
                                {set.weight !== null ? `@ ${set.weight} lb` : '@ add weight'}
                              </Text>
                            </Pressable>
                          )
                        )}
                        {!editableSession && set.weight !== null && (
                          <Text style={[styles.setWeightText, { color: theme.textMuted }]}>
                            @ {set.weight} lb
                          </Text>
                        )}
                      </View>
                    </View>
                    {editableSession && (
                      <Pressable
                        style={styles.deleteSetButton}
                        onPress={() => deleteSet(exercise, set.id)}
                      >
                        <Ionicons name="trash-outline" size={16} color="#b45353" />
                      </Pressable>
                    )}
                  </View>
                ))
              ) : (
                <View style={styles.setRow}>
                  <Ionicons name="ellipse-outline" size={18} color={theme.textMuted} />
                  <Text style={[styles.setPlaceholder, { color: theme.textMuted }]}>No sets logged yet</Text>
                </View>
              )}

              {isSelected && (
                <>
                  <View style={styles.liveSetRow}>
                    <Text style={[styles.liveSetLabel, { color: theme.text }]}>Set {currentSetNumber}:</Text>
                    <View style={[styles.metricChip, { borderColor: theme.inputBorder, backgroundColor: theme.frame }]}>
                      <Text style={[styles.metricChipValue, { color: theme.text }]}>{reps}</Text>
                      <Text style={[styles.metricChipLabel, { color: theme.textMuted }]}>Reps</Text>
                    </View>
                    <View style={[styles.metricChip, { borderColor: theme.inputBorder, backgroundColor: theme.frame }]}>
                      <Text style={[styles.metricChipValue, { color: theme.text }]}>{smoothedValue.toFixed(2)}</Text>
                      <Text style={[styles.metricChipLabel, { color: theme.textMuted }]}>Signal</Text>
                    </View>
                  </View>

                  <View style={styles.weightRow}>
                    <Text style={[styles.weightLabel, { color: theme.text }]}>Weight</Text>
                    <TextInput
                      value={selectedWeightInput}
                      onChangeText={(value) =>
                        setWeightInputs((prev) => ({
                          ...prev,
                          [selectedExercise]: value.replace(/[^0-9.]/g, ''),
                        }))
                      }
                      editable={!running}
                      keyboardType="decimal-pad"
                      placeholder="lbs"
                      placeholderTextColor={theme.textMuted}
                      style={[
                        styles.weightInput,
                        {
                          backgroundColor: theme.inputBg,
                          borderColor: theme.inputBorder,
                          color: theme.text,
                        },
                      ]}
                    />
                    <Text style={[styles.weightUnit, { color: theme.textMuted }]}>lb</Text>
                  </View>

                  <Pressable
                    style={[styles.primaryButton, running ? styles.primaryButtonActive : styles.primaryButtonIdle]}
                    onPress={running ? stopSet : startSet}
                  >
                    <Text style={styles.primaryButtonText}>
                      {running ? 'Log Set' : 'Start Set'}
                    </Text>
                  </Pressable>

                  <View style={styles.inlineButtonRow}>
                    <Pressable
                      style={[styles.secondaryButton, running && styles.secondaryButtonDisabled]}
                      disabled={running}
                      onPress={resetCurrentSet}>
                      <Text style={styles.secondaryButtonText}>Reset Set</Text>
                    </Pressable>
                  </View>

                  {isActiveExercise && (
                    <Pressable style={styles.finishExerciseButton} onPress={finishExercise}>
                      <Text style={styles.finishExerciseButtonText}>Finish Exercise</Text>
                    </Pressable>
                  )}
                </>
              )}
            </Pressable>
          );
        })}

        <View style={[styles.summaryPanel, { backgroundColor: theme.summary }]}>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: theme.summaryLabel }]}>Status</Text>
            <Text style={[styles.summaryValue, { color: theme.summaryValue }]}>{permissionText}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: theme.summaryLabel }]}>Rep State</Text>
            <Text style={[styles.summaryValue, { color: theme.summaryValue }]}>{repState}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: theme.summaryLabel }]}>Learned Axis</Text>
            <Text style={[styles.summaryValue, { color: theme.summaryValue }]}>{learnedAxis ?? '--'}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: theme.summaryLabel }]}>Live Axis</Text>
            <Text style={[styles.summaryValue, { color: theme.summaryValue }]}>{liveAxisValue}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: theme.summaryLabel }]}>Up / Reverse / Down</Text>
            <Text style={[styles.summaryValue, { color: theme.summaryValue }]}>
              {upThresholdText} / {reverseThresholdText} / {downThresholdText}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: theme.summaryLabel }]}>Profile</Text>
            <Text style={[styles.summaryValue, { color: theme.summaryValue }]}>
              {learnedUpSign === null ? '--' : learnedUpSign === 1 ? '+' : '-'} direction
            </Text>
          </View>
        </View>

        <View style={[styles.bottomTabBar, { borderTopColor: theme.bottomBarBorder }]}>
          <View style={styles.bottomTabItem}>
            <Ionicons name="barbell-outline" size={20} color={theme.text} />
            <Text style={[styles.bottomTabTextActive, { color: theme.text }]}>Workouts</Text>
          </View>
          <View style={styles.bottomTabItem}>
            <Ionicons name="options-outline" size={20} color={theme.inactiveTab} />
            <Text style={[styles.bottomTabText, { color: theme.inactiveTab }]}>Exercises</Text>
          </View>
          <View style={styles.bottomTabItem}>
            <Ionicons name="person-outline" size={20} color={theme.inactiveTab} />
            <Text style={[styles.bottomTabText, { color: theme.inactiveTab }]}>Profile</Text>
          </View>
          <View style={styles.bottomTabItem}>
            <Ionicons name="settings-outline" size={20} color={theme.inactiveTab} />
            <Text style={[styles.bottomTabText, { color: theme.inactiveTab }]}>Settings</Text>
          </View>
        </View>

        <View style={styles.microStats}>
          <Text style={[styles.microStatsText, { color: theme.textMuted }]}>
            Session reps: {totalRepsForSession}   x {accel.x.toFixed(2)}   y {accel.y.toFixed(2)}   z{' '}
            {accel.z.toFixed(2)}
          </Text>
        </View>

        <Pressable
          style={[
            styles.bottomFinishButton,
            { backgroundColor: theme.finishButton, borderColor: theme.finishButtonBorder },
          ]}
          onPress={confirmFinishWorkout}>
          <Text style={[styles.bottomFinishButtonText, { color: theme.finishButtonText }]}>Finish Workout</Text>
        </Pressable>
        </View>
      </ScrollView>

      <View style={[styles.stickyDock, { backgroundColor: theme.dock }]}>
        <View style={styles.stickyDockTop}>
          <View>
            <Text style={[styles.stickyDockEyebrow, { color: theme.dockMuted }]}>{selectedExercise}</Text>
            <Text style={[styles.stickyDockState, { color: theme.dockText }]}>
              {running ? 'Counting live' : currentSession ? `Set ${currentSetNumber} ready` : 'Ready to start'}
            </Text>
          </View>
          <View style={[styles.stickyRepBadge, { backgroundColor: theme.dockBadge }]}>
            <Text style={[styles.stickyRepValue, { color: theme.dockText }]}>{reps}</Text>
            <Text style={[styles.stickyRepLabel, { color: theme.dockMuted }]}>REPS</Text>
          </View>
        </View>

        <View style={styles.stickyDockActions}>
          <Pressable
            style={[styles.stickyPrimaryButton, running ? styles.stickyPrimaryButtonActive : styles.stickyPrimaryButtonIdle]}
            onPress={running ? stopSet : startSet}>
            <Text style={styles.stickyPrimaryButtonText}>{running ? 'Log Set' : 'Start Set'}</Text>
          </Pressable>

          {activeSession?.exercise === selectedExercise && (
            <Pressable style={styles.stickySecondaryButton} onPress={finishExercise}>
              <Text style={styles.stickySecondaryButtonText}>Finish Exercise</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.restDockRow}>
          <View style={styles.restDockInfo}>
            <Text style={[styles.restDockLabel, { color: theme.dockMuted }]}>Rest Timer</Text>
            <Text style={[styles.restDockValue, { color: theme.dockText }]}>
              {isRestTimerRunning ? restTimerLabel : 'Ready'}
            </Text>
          </View>
          <Pressable
            style={styles.restDockButton}
            onPress={isRestTimerRunning ? cancelRestTimer : () => startRestTimer()}>
            <Text style={styles.restDockButtonText}>
              {isRestTimerRunning ? 'Cancel Rest' : 'Start Rest'}
            </Text>
          </Pressable>
        </View>

      </View>
    </View>
  );
}

function pad(value: number) {
  return value.toString().padStart(2, '0');
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#dce8ee',
  },
  scrollContent: {
    flexGrow: 1,
    backgroundColor: '#dce8ee',
    paddingVertical: 22,
    paddingHorizontal: 12,
    paddingBottom: 320,
  },
  phoneFrame: {
    backgroundColor: '#f8fbfd',
    borderRadius: 28,
    paddingTop: 22,
    paddingHorizontal: 14,
    paddingBottom: 18,
    borderWidth: 1,
    borderColor: '#bdd0da',
    shadowColor: '#21404d',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  topMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  metaText: {
    fontSize: 15,
    color: '#2f4550',
    fontWeight: '600',
  },
  metaTime: {
    fontSize: 15,
    color: '#2f4550',
    fontWeight: '700',
  },
  pageTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
    color: '#132c39',
    marginBottom: 10,
  },
  infoPill: {
    backgroundColor: '#d8eef8',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoPillLabel: {
    color: '#27404b',
    fontSize: 16,
    fontWeight: '600',
  },
  infoPillValue: {
    color: '#27404b',
    fontSize: 16,
    fontWeight: '700',
  },
  exerciseCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#e2edf2',
  },
  exerciseCardSelected: {
    borderColor: '#9ed3ea',
    shadowColor: '#1d4656',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  exerciseCardActive: {
    borderWidth: 2,
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  exerciseCardMuted: {
    opacity: 0.68,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  exerciseHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  exerciseStateBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  exerciseStateCounting: {
    backgroundColor: '#d94b4b',
  },
  exerciseStateActive: {
    backgroundColor: '#f2c94c',
  },
  exerciseStateSelected: {
    backgroundColor: '#5c7c8a',
  },
  exerciseStateText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  lastWorkoutBanner: {
    backgroundColor: '#eef7dc',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 4,
  },
  lastWorkoutBannerText: {
    color: '#586a1d',
    fontSize: 13,
    fontWeight: '700',
  },
  previousChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  previousChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  previousChipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  exerciseTitle: {
    color: '#1b2f38',
    fontSize: 22,
    fontWeight: '800',
    flex: 1,
    paddingRight: 8,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  setInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 10,
  },
  setTextWrap: {
    marginLeft: 8,
    flex: 1,
  },
  setText: {
    color: '#2a414c',
    fontSize: 17,
    fontWeight: '500',
  },
  setWeightText: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  inlineWeightEditor: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 6,
    flexWrap: 'wrap',
  },
  inlineWeightInput: {
    minWidth: 70,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 14,
    fontWeight: '700',
  },
  inlineWeightAction: {
    backgroundColor: '#dfeef4',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  inlineWeightActionText: {
    color: '#173f51',
    fontSize: 13,
    fontWeight: '800',
  },
  inlineWeightCancel: {
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  inlineWeightCancelText: {
    color: '#8a99a1',
    fontSize: 13,
    fontWeight: '700',
  },
  deleteSetButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff1f1',
    borderWidth: 1,
    borderColor: '#f2d3d3',
  },
  setPlaceholder: {
    marginLeft: 8,
    color: '#8ba1ac',
    fontSize: 16,
  },
  liveSetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 12,
  },
  liveSetLabel: {
    color: '#253b44',
    fontSize: 18,
    fontWeight: '700',
    marginRight: 10,
  },
  metricChip: {
    borderWidth: 1,
    borderColor: '#d3e4eb',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginRight: 8,
    minWidth: 78,
    alignItems: 'center',
  },
  weightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  weightLabel: {
    color: '#253b44',
    fontSize: 16,
    fontWeight: '700',
    marginRight: 10,
  },
  weightInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d3e4eb',
    backgroundColor: '#fbfdfe',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#173541',
    fontSize: 16,
    fontWeight: '700',
  },
  weightUnit: {
    color: '#6d828c',
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 10,
  },
  metricChipValue: {
    color: '#173541',
    fontSize: 18,
    fontWeight: '800',
  },
  metricChipLabel: {
    color: '#7d929c',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  primaryButton: {
    backgroundColor: '#41c063',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  primaryButtonIdle: {
    backgroundColor: '#36b95d',
  },
  primaryButtonActive: {
    backgroundColor: '#d94b4b',
  },
  primaryButtonText: {
    color: '#effff2',
    fontSize: 18,
    fontWeight: '700',
  },
  inlineButtonRow: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 8,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#deebf1',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
  },
  secondaryButtonDisabled: {
    opacity: 0.45,
  },
  secondaryButtonText: {
    color: '#4d6672',
    fontSize: 15,
    fontWeight: '600',
  },
  finishExerciseButton: {
    marginTop: 10,
    backgroundColor: '#f2c94c',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  finishExerciseButtonText: {
    color: '#5b4700',
    fontSize: 16,
    fontWeight: '800',
  },
  summaryPanel: {
    marginTop: 12,
    backgroundColor: '#eef5f8',
    borderRadius: 16,
    padding: 14,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 5,
    gap: 12,
  },
  summaryLabel: {
    color: '#5c7280',
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  summaryValue: {
    color: '#193540',
    fontSize: 14,
    fontWeight: '600',
    flex: 1.2,
    textAlign: 'right',
  },
  bottomTabBar: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2eaee',
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  bottomTabItem: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomTabTextActive: {
    color: '#173f51',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
  bottomTabText: {
    color: '#a0afb7',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  microStats: {
    marginTop: 10,
    alignItems: 'center',
  },
  microStatsText: {
    color: '#8097a2',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  bottomFinishButton: {
    marginTop: 14,
    backgroundColor: '#edf4f7',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#d4e2e8',
  },
  bottomFinishButtonText: {
    color: '#173f51',
    fontSize: 18,
    fontWeight: '800',
  },
  stickyDock: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    backgroundColor: '#132f3b',
    borderRadius: 22,
    padding: 14,
    shadowColor: '#0f2430',
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  stickyDockTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  stickyDockEyebrow: {
    color: '#c4d9e1',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  stickyDockState: {
    color: '#f6fbfd',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
  },
  stickyRepBadge: {
    minWidth: 84,
    backgroundColor: '#214555',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  stickyRepValue: {
    color: '#ffffff',
    fontSize: 42,
    fontWeight: '900',
    lineHeight: 46,
  },
  stickyRepLabel: {
    color: '#b8d1db',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  stickyDockActions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  stickyPrimaryButton: {
    flex: 1.2,
    borderRadius: 14,
    minHeight: 72,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickyPrimaryButtonIdle: {
    backgroundColor: '#39be60',
  },
  stickyPrimaryButtonActive: {
    backgroundColor: '#d94b4b',
  },
  stickyPrimaryButtonText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
  },
  stickySecondaryButton: {
    flex: 1,
    backgroundColor: '#f2c94c',
    borderRadius: 14,
    minHeight: 72,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickySecondaryButtonText: {
    color: '#5b4700',
    fontSize: 18,
    fontWeight: '800',
  },
  restDockRow: {
    marginTop: 2,
    backgroundColor: '#17303b',
    borderRadius: 16,
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  restDockInfo: {
    flex: 1,
    paddingRight: 10,
  },
  restDockLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  restDockValue: {
    fontSize: 24,
    fontWeight: '900',
    marginTop: 3,
  },
  restDockButton: {
    backgroundColor: '#edf4f7',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minWidth: 112,
    alignItems: 'center',
  },
  restDockButtonText: {
    color: '#173f51',
    fontSize: 15,
    fontWeight: '800',
  },
});
