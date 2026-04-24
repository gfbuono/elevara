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
  learnedAt?: string;
};

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
  noteInputs: Record<ExerciseName, string>;
};

type FinishedWorkoutSummary = {
  title: string;
  note: string;
  totalSets: number;
  totalReps: number;
  exercises: {
    exercise: ExerciseName;
    sets: number;
    reps: number;
  }[];
};

const WORKOUT_STORAGE_KEY = 'elevara_workout_history_v1';
const LEARNED_PROFILE_STORAGE_KEY = 'elevara_learned_profiles_v1';
const WORKOUT_DRAFT_STORAGE_KEY = 'elevara_workout_draft_v1';
const EXERCISE_ORDER_STORAGE_KEY = 'elevara_exercise_order_v1';
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
  const [smoothedValue, setSmoothedValue] = useState(0);
  const [selectedExercise, setSelectedExercise] = useState<ExerciseName>('Bicep Curl');
  const [exerciseOrder, setExerciseOrder] = useState<ExerciseName[]>(EXERCISES);
  const [workoutTitle, setWorkoutTitle] = useState('Arms Day');
  const [workoutNote, setWorkoutNote] = useState('');
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
  const [workoutHistory, setWorkoutHistory] = useState<WorkoutRecord[]>([]);
  const [clockNow, setClockNow] = useState(() => new Date());
  const [restSecondsLeft, setRestSecondsLeft] = useState(0);
  const [isRestTimerRunning, setIsRestTimerRunning] = useState(false);
  const [startCountdown, setStartCountdown] = useState<number | null>(null);
  const [weightInputs, setWeightInputs] = useState<Record<ExerciseName, string>>({
    'Bicep Curl': '',
    'Tricep Extension': '',
  });
  const [setNoteInputs, setSetNoteInputs] = useState<Record<ExerciseName, string>>({
    'Bicep Curl': '',
    'Tricep Extension': '',
  });
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [editingSetWeightValue, setEditingSetWeightValue] = useState('');
  const [editingSetRepValue, setEditingSetRepValue] = useState('');
  const [editingSetNoteValue, setEditingSetNoteValue] = useState('');
  const [finishedSummary, setFinishedSummary] = useState<FinishedWorkoutSummary | null>(null);
  const [signalSpread, setSignalSpread] = useState(0);

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
    void loadExerciseOrder();
    void loadWorkoutDraft();
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
    void persistWorkoutDraft();
  }, [
    activeSession,
    exerciseSessions,
    selectedExercise,
    workoutTitle,
    workoutNote,
    exerciseOrder,
    setNoteInputs,
  ]);

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
    if (startCountdown === null) {
      return;
    }

    if (startCountdown <= 0) {
      runningRef.current = true;
      setRunning(true);
      setStartCountdown(null);
      pulseSuccess();
      setPermissionText(
        `Set ${((activeSession?.sets.length ?? exerciseSessions[selectedExercise]?.sets.length ?? 0) + 1)} running`
      );
      return;
    }

    const timer = setTimeout(() => {
      setStartCountdown((prev) => (prev === null ? null : prev - 1));
    }, 1000);

    return () => clearTimeout(timer);
  }, [activeSession, exerciseSessions, selectedExercise, startCountdown]);

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
        setWorkoutHistory(normalizeWorkoutHistory(JSON.parse(raw)));
      }
    } catch (error) {
      console.log('Failed to load workout history', error);
    }
  };

  const persistWorkoutHistory = async (history: WorkoutRecord[]) => {
    try {
      await AsyncStorage.setItem(WORKOUT_STORAGE_KEY, JSON.stringify(history));
      setWorkoutHistory(history);
    } catch (error) {
      console.log('Failed to save workout history', error);
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
      const normalized = normalizeExerciseOrder(parsed);
      setExerciseOrder(normalized);
    } catch (error) {
      console.log('Failed to load exercise order', error);
    }
  };

  const loadWorkoutDraft = async () => {
    try {
      const raw = await AsyncStorage.getItem(WORKOUT_DRAFT_STORAGE_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as WorkoutDraft;
      const normalizedOrder = normalizeExerciseOrder(parsed.exerciseOrder);
      setExerciseOrder(normalizedOrder);
      setWorkoutTitle(parsed.title || 'Arms Day');
      setWorkoutNote(parsed.note || '');
      setSetNoteInputs({
        'Bicep Curl': parsed.noteInputs?.['Bicep Curl'] ?? '',
        'Tricep Extension': parsed.noteInputs?.['Tricep Extension'] ?? '',
      });
      setExerciseSessions({
        'Bicep Curl': parsed.exerciseSessions?.['Bicep Curl'] ?? null,
        'Tricep Extension': parsed.exerciseSessions?.['Tricep Extension'] ?? null,
      });
      setSelectedExercise(parsed.selectedExercise ?? normalizedOrder[0]);

      if (parsed.activeExercise) {
        const restoredSession =
          parsed.exerciseSessions?.[parsed.activeExercise as ExerciseName] ?? null;
        setActiveSession(restoredSession);
      } else {
        setActiveSession(null);
      }
    } catch (error) {
      console.log('Failed to load workout draft', error);
    }
  };

  const persistWorkoutDraft = async () => {
    try {
      const draft: WorkoutDraft = {
        selectedExercise,
        activeExercise: activeSession?.exercise ?? null,
        exerciseSessions,
        title: workoutTitle,
        note: workoutNote,
        exerciseOrder,
        noteInputs: setNoteInputs,
      };

      const hasAnySession = draft.exerciseOrder.some((exercise) => Boolean(draft.exerciseSessions[exercise]));
      const hasMeta = Boolean(
        draft.title.trim() ||
          draft.note.trim() ||
          Object.values(draft.noteInputs).some((value) => value.trim().length > 0)
      );

      if (!hasAnySession && !hasMeta) {
        await AsyncStorage.removeItem(WORKOUT_DRAFT_STORAGE_KEY);
        return;
      }

      await AsyncStorage.setItem(WORKOUT_DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch (error) {
      console.log('Failed to save workout draft', error);
    }
  };

  const clearWorkoutDraft = async () => {
    try {
      await AsyncStorage.removeItem(WORKOUT_DRAFT_STORAGE_KEY);
    } catch (error) {
      console.log('Failed to clear workout draft', error);
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
        'Bicep Curl': normalizeLearnedProfile(parsed['Bicep Curl'] ?? null),
        'Tricep Extension': normalizeLearnedProfile(parsed['Tricep Extension'] ?? null),
      };

      setSavedProfiles(nextProfiles);
      applyLearnedProfile(nextProfiles[selectedExercise]);
    } catch (error) {
      console.log('Failed to load saved profiles', error);
    }
  };

  const clearProfileDisplay = () => {
    profileRef.current = null;
  };

  const applyLearnedProfile = (profile: LearnedProfile | null) => {
    if (!profile) {
      clearProfileDisplay();
      return;
    }

    profileRef.current = profile;
  };

  const resetCounterState = () => {
    runningRef.current = false;
    setRunning(false);
    setStartCountdown(null);
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
    setSignalSpread(0);
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

  const startRestTimer = (seconds = 120) => {
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
    const spread =
      Math.max(...smoothWindowRef.current) - Math.min(...smoothWindowRef.current);

    setSmoothedValue(smooth);
    setSignalSpread(spread);

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
    runningRef.current = false;
    setRunning(false);
    setStartCountdown(10);
    pulseLight();
    setPermissionText(`Starting set ${sessionToUse.sets.length + 1} in 10 seconds`);
  };

  const cancelStartCountdown = () => {
    if (startCountdown === null) {
      return;
    }

    const sessionToUse =
      (activeSession?.exercise === selectedExercise ? activeSession : null) ??
      exerciseSessions[selectedExercise];

    if (sessionToUse && sessionToUse.sets.length === 0) {
      setExerciseSessions((prev) => ({
        ...prev,
        [selectedExercise]: null,
      }));
      if (activeSession?.exercise === selectedExercise) {
        setActiveSession(null);
      }
    }

    resetCounterState();
    setPermissionText('Set start canceled');
    pulseWarning();
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
      note: setNoteInputs[selectedExercise].trim() || undefined,
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
    setSetNoteInputs((prev) => ({
      ...prev,
      [selectedExercise]: '',
    }));
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
    const completedSessions = exerciseOrder
      .map((exercise) => exerciseSessions[exercise])
      .filter((session): session is WorkoutSession => Boolean(session && session.sets.length > 0));

    if (completedSessions.length === 0) {
      setPermissionText('No workout session to save');
      return;
    }

    const nextWorkoutRecord: WorkoutRecord = {
      id: Date.now().toString(),
      startedAt: new Date().toLocaleString(),
      title: workoutTitle.trim() || 'Workout',
      note: workoutNote.trim(),
      exercises: completedSessions,
    };
    const updatedHistory = [nextWorkoutRecord, ...workoutHistory];
    await persistWorkoutHistory(updatedHistory);

    const totalSets = completedSessions.reduce((sum, session) => sum + session.sets.length, 0);
    const totalReps = completedSessions.reduce(
      (sum, session) => sum + session.sets.reduce((sessionSum, set) => sessionSum + set.reps, 0),
      0
    );
    setFinishedSummary({
      title: nextWorkoutRecord.title,
      note: nextWorkoutRecord.note,
      totalSets,
      totalReps,
      exercises: completedSessions.map((session) => ({
        exercise: session.exercise,
        sets: session.sets.length,
        reps: session.sets.reduce((sum, set) => sum + set.reps, 0),
      })),
    });

    setActiveSession(null);
    setExerciseSessions({
      'Bicep Curl': null,
      'Tricep Extension': null,
    });
    setSetNoteInputs({
      'Bicep Curl': '',
      'Tricep Extension': '',
    });
    setWorkoutTitle('Arms Day');
    setWorkoutNote('');
    setSelectedExercise(exerciseOrder[0] ?? 'Bicep Curl');
    await clearWorkoutDraft();
    resetCounterState();
    pulseSuccess();
    setPermissionText(`Workout saved (${totalSets} sets, ${totalReps} reps)`);
  };

  const confirmFinishWorkout = () => {
    const hasDraftWorkout = exerciseOrder.some((exercise) => Boolean(exerciseSessions[exercise]));

    if (!hasDraftWorkout) {
      setPermissionText('No workout session to save');
      return;
    }

    const exerciseSummary = exerciseOrder
      .map((exercise) => exerciseSessions[exercise])
      .filter((session): session is WorkoutSession => Boolean(session && session.sets.length > 0))
      .map((session) => {
        const repsTotal = session.sets.reduce((sum, set) => sum + set.reps, 0);
        return `${session.exercise}: ${session.sets.length} sets, ${repsTotal} reps`;
      })
      .join('\n');

    Alert.alert(
      'Finish workout?',
      `${workoutTitle.trim() || 'Workout'}\n${workoutNote.trim() || 'No note'}\n\n${exerciseSummary}`,
      [
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
      ]
    );
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
    const currentIndex = exerciseOrder.indexOf(activeSession.exercise);
    const nextExercise = exerciseOrder[(currentIndex + 1) % exerciseOrder.length] ?? activeSession.exercise;

    setActiveSession(null);
    setSelectedExercise(nextExercise);
    resetCounterState();
    pulseSuccess();
    setPermissionText(
      `${activeSession.exercise} ready to revisit (${activeSession.sets.length} sets, ${totalReps} reps). ${nextExercise} selected`
    );
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

  const beginSetEdit = (set: WorkoutSet) => {
    setEditingSetId(set.id);
    setEditingSetRepValue(String(set.reps));
    setEditingSetWeightValue(set.weight === null ? '' : String(set.weight));
    setEditingSetNoteValue(set.note ?? '');
  };

  const cancelSetEdit = () => {
    setEditingSetId(null);
    setEditingSetRepValue('');
    setEditingSetWeightValue('');
    setEditingSetNoteValue('');
  };

  const saveEditedSet = (exercise: ExerciseName, setId: string) => {
    const sessionToEdit =
      (activeSession?.exercise === exercise ? activeSession : null) ?? exerciseSessions[exercise];

    if (!sessionToEdit) {
      cancelSetEdit();
      return;
    }

    const parsedReps = Number.parseInt(editingSetRepValue, 10);
    const nextReps = Number.isFinite(parsedReps) && parsedReps > 0 ? parsedReps : null;
    if (nextReps === null) {
      pulseWarning();
      setPermissionText('Reps must be a positive number');
      return;
    }

    const parsedWeight = Number.parseFloat(editingSetWeightValue);
    const nextWeight = Number.isFinite(parsedWeight) && parsedWeight > 0 ? parsedWeight : null;

    const updatedSession: WorkoutSession = {
      ...sessionToEdit,
      sets: sessionToEdit.sets.map((set) =>
        set.id === setId
          ? {
              ...set,
              reps: nextReps,
              weight: nextWeight,
              note: editingSetNoteValue.trim() || undefined,
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
    cancelSetEdit();
    setPermissionText(
      `Updated ${exercise} set to ${nextReps} reps${nextWeight !== null ? ` @ ${nextWeight} lb` : ''}`
    );
  };

  const adjustRepCount = (delta: 1 | -1) => {
    if (running) {
      setReps((prev) => Math.max(0, prev + delta));
      pulseLight();
      return;
    }

    const sessionToAdjust =
      (activeSession?.exercise === selectedExercise ? activeSession : null) ??
      exerciseSessions[selectedExercise];
    const lastSet = sessionToAdjust ? sessionToAdjust.sets[sessionToAdjust.sets.length - 1] : null;

    if (!sessionToAdjust || !lastSet) {
      pulseWarning();
      setPermissionText('No recent set available to adjust');
      return;
    }

    const nextReps = Math.max(1, lastSet.reps + delta);
    const updatedSession: WorkoutSession = {
      ...sessionToAdjust,
      sets: sessionToAdjust.sets.map((set) =>
        set.id === lastSet.id
          ? {
              ...set,
              reps: nextReps,
            }
          : set
      ),
    };

    setExerciseSessions((prev) => ({
      ...prev,
      [selectedExercise]: updatedSession,
    }));

    if (activeSession?.exercise === selectedExercise) {
      setActiveSession(updatedSession);
    }

    pulseLight();
    setPermissionText(`Adjusted last ${selectedExercise} set to ${nextReps} reps`);
  };

  const duplicateLastWorkout = () => {
    const lastWorkout = workoutHistory[0];
    if (!lastWorkout) {
      pulseWarning();
      setPermissionText('No previous workout available to duplicate');
      return;
    }

    setWorkoutTitle(lastWorkout.title || 'Arms Day');
    setWorkoutNote(lastWorkout.note || '');
    setWeightInputs((prev) => {
      const nextInputs = { ...prev };
      EXERCISES.forEach((exercise) => {
        const weightedSets =
          lastWorkout.exercises
            .find((session) => session.exercise === exercise)
            ?.sets.filter((set) => set.weight !== null) ?? [];
        const lastSet = weightedSets[weightedSets.length - 1] ?? null;
        nextInputs[exercise] = lastSet?.weight !== null ? String(lastSet.weight) : '';
      });
      return nextInputs;
    });
    setPermissionText('Last workout title, note, and weights loaded');
    pulseLight();
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
    workoutHistory
      .flatMap((workout) => workout.exercises)
      .find((session) => session.exercise === exercise) ?? null;

  const currentSession =
    activeSession?.exercise === selectedExercise
      ? activeSession
      : exerciseSessions[selectedExercise];
  const isPreparingSet = startCountdown !== null;
  const currentSetNumber = Math.min((currentSession?.sets.length ?? 0) + 1, TARGET_SETS);
  const restTimerLabel = formatTimer(restSecondsLeft);
  const selectedWeightInput = weightInputs[selectedExercise];
  const selectedSetNoteInput = setNoteInputs[selectedExercise];
  const activeProfile = savedProfiles[selectedExercise];
  const signalConfidence = !activeProfile
    ? 'No profile'
    : running
      ? signalSpread <= 0.12
        ? 'Stable'
        : signalSpread <= 0.28
          ? 'Watch'
          : 'Noisy'
      : null;

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

        <View
          style={[
            styles.workoutMetaCard,
            { backgroundColor: theme.card, borderColor: theme.cardBorder },
          ]}>
          <View style={styles.workoutMetaHeader}>
            <Text style={[styles.metaSectionTitle, { color: theme.text }]}>Workout</Text>
            <Pressable style={styles.duplicateWorkoutButton} onPress={duplicateLastWorkout}>
              <Text style={styles.duplicateWorkoutButtonText}>Duplicate Last</Text>
            </Pressable>
          </View>
          <TextInput
            value={workoutTitle}
            onChangeText={setWorkoutTitle}
            placeholder="Workout title"
            placeholderTextColor={theme.textMuted}
            style={[
              styles.workoutTitleInput,
              { color: theme.text, borderColor: theme.inputBorder, backgroundColor: theme.inputBg },
            ]}
          />
          <TextInput
            value={workoutNote}
            onChangeText={setWorkoutNote}
            placeholder="Add a note like Hotel Gym or Travel Day"
            placeholderTextColor={theme.textMuted}
            style={[
              styles.workoutNoteInput,
              { color: theme.text, borderColor: theme.inputBorder, backgroundColor: theme.inputBg },
            ]}
            multiline
          />
        </View>

        <View style={[styles.helpCard, { backgroundColor: theme.pill }]}>
          <Text style={[styles.helpCardTitle, { color: theme.pillText }]}>How it works</Text>
          <Text style={[styles.helpCardText, { color: theme.pillText }]}>
            Learn Exercise once in the Exercises tab, start a set here, then use Finish Exercise when you want to move to the next movement.
          </Text>
        </View>

        {finishedSummary && (
          <View style={[styles.finishSummaryCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <View style={styles.finishSummaryHeader}>
              <View style={styles.finishSummaryHeaderText}>
                <Text style={[styles.finishSummaryTitle, { color: theme.text }]}>Last Workout Saved</Text>
                <Text style={[styles.finishSummarySubtitle, { color: theme.textMuted }]}>
                  {finishedSummary.title}
                  {finishedSummary.note ? ` • ${finishedSummary.note}` : ''}
                </Text>
              </View>
              <Pressable onPress={() => setFinishedSummary(null)}>
                <Text style={[styles.finishSummaryDismiss, { color: theme.textMuted }]}>Hide</Text>
              </Pressable>
            </View>
            <Text style={[styles.finishSummaryMeta, { color: theme.text }]}>
              {finishedSummary.totalSets} sets • {finishedSummary.totalReps} reps
            </Text>
            <View style={styles.previousChipRow}>
              {finishedSummary.exercises.map((exercise) => (
                <View
                  key={`summary-${exercise.exercise}`}
                  style={[styles.previousChip, { backgroundColor: theme.previousBg }]}>
                  <Text style={[styles.previousChipText, { color: theme.previousText }]}>
                    {exercise.exercise}: {exercise.sets} sets / {exercise.reps} reps
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={[styles.infoPill, { backgroundColor: theme.pill }]}>
          <Text style={[styles.infoPillLabel, { color: theme.pillText }]}>Current Set</Text>
            <Text style={[styles.infoPillValue, { color: theme.pillText }]}>
            {isPreparingSet ? `Starting in ${startCountdown}` : currentSession ? currentSetNumber : 'Ready'}
          </Text>
        </View>

        <View style={[styles.infoPill, { backgroundColor: theme.pill }]}>
          <Text style={[styles.infoPillLabel, { color: theme.pillText }]}>Rest Timer</Text>
          <Text style={[styles.infoPillValue, { color: theme.pillText }]}>
            {isRestTimerRunning ? restTimerLabel : 'Done'}
          </Text>
        </View>

        {exerciseOrder.map((exercise, index) => {
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
                          editingSetId === set.id ? (
                            <View style={styles.inlineWeightEditor}>
                              <TextInput
                                value={editingSetRepValue}
                                onChangeText={(value) => setEditingSetRepValue(value.replace(/[^0-9]/g, ''))}
                                keyboardType="number-pad"
                                placeholder="reps"
                                placeholderTextColor={theme.textMuted}
                                style={[
                                  styles.inlineRepInput,
                                  {
                                    backgroundColor: theme.inputBg,
                                    borderColor: theme.inputBorder,
                                    color: theme.text,
                                  },
                                ]}
                              />
                              <TextInput
                                value={editingSetWeightValue}
                                onChangeText={(value) => setEditingSetWeightValue(value.replace(/[^0-9.]/g, ''))}
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
                              <TextInput
                                value={editingSetNoteValue}
                                onChangeText={setEditingSetNoteValue}
                                placeholder="note"
                                placeholderTextColor={theme.textMuted}
                                style={[
                                  styles.inlineNoteInput,
                                  {
                                    backgroundColor: theme.inputBg,
                                    borderColor: theme.inputBorder,
                                    color: theme.text,
                                  },
                                ]}
                              />
                              <Pressable
                                style={styles.inlineWeightAction}
                                onPress={() => saveEditedSet(exercise, set.id)}>
                                <Text style={styles.inlineWeightActionText}>Save</Text>
                              </Pressable>
                              <Pressable
                                style={styles.inlineWeightCancel}
                                onPress={cancelSetEdit}>
                                <Text style={styles.inlineWeightCancelText}>Cancel</Text>
                              </Pressable>
                            </View>
                          ) : (
                            <Pressable
                              hitSlop={6}
                              onPress={() => beginSetEdit(set)}>
                              <Text style={[styles.setWeightText, { color: theme.textMuted }]}>
                                {set.weight !== null ? `${set.reps} reps @ ${set.weight} lb` : `${set.reps} reps @ add weight`}
                              </Text>
                              {Boolean(set.note) && (
                                <Text style={[styles.setNoteText, { color: theme.textMuted }]}>{set.note}</Text>
                              )}
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
                    {signalConfidence && (
                      <View style={[styles.metricChip, { borderColor: theme.inputBorder, backgroundColor: theme.frame }]}>
                        <Text style={[styles.metricChipValue, { color: theme.text }]}>{signalConfidence}</Text>
                        <Text style={[styles.metricChipLabel, { color: theme.textMuted }]}>Confidence</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.quickAdjustRow}>
                    <Pressable style={styles.quickAdjustButton} onPress={() => adjustRepCount(-1)}>
                      <Text style={styles.quickAdjustButtonText}>-1 Rep</Text>
                    </Pressable>
                    <Pressable style={styles.quickAdjustButton} onPress={() => adjustRepCount(1)}>
                      <Text style={styles.quickAdjustButtonText}>+1 Rep</Text>
                    </Pressable>
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

                  <View style={styles.weightRow}>
                    <Text style={[styles.weightLabel, { color: theme.text }]}>Note</Text>
                    <TextInput
                      value={selectedSetNoteInput}
                      onChangeText={(value) =>
                        setSetNoteInputs((prev) => ({
                          ...prev,
                          [selectedExercise]: value,
                        }))
                      }
                      editable={!running}
                      placeholder="easy, bad form, left arm weak"
                      placeholderTextColor={theme.textMuted}
                      style={[
                        styles.noteInput,
                        {
                          backgroundColor: theme.inputBg,
                          borderColor: theme.inputBorder,
                          color: theme.text,
                        },
                      ]}
                    />
                  </View>

                  <Pressable
                    style={[styles.primaryButton, running ? styles.primaryButtonActive : styles.primaryButtonIdle]}
                    onPress={running ? stopSet : isPreparingSet ? cancelStartCountdown : startSet}
                  >
                    <Text style={styles.primaryButtonText}>
                      {running ? 'Log Set' : isPreparingSet ? `Cancel ${startCountdown}` : 'Start Set'}
                    </Text>
                  </Pressable>

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
            <Text style={[styles.summaryLabel, { color: theme.summaryLabel }]}>Confidence</Text>
            <Text style={[styles.summaryValue, { color: theme.summaryValue }]}>{signalConfidence ?? '--'}</Text>
          </View>
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
              {running
                ? 'Counting live'
                : isPreparingSet
                  ? `Starting in ${startCountdown}s`
                  : currentSession
                    ? `Set ${currentSetNumber} ready`
                    : 'Ready to start'}
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
            onPress={running ? stopSet : isPreparingSet ? cancelStartCountdown : startSet}>
            <Text style={styles.stickyPrimaryButtonText}>
              {running ? 'Log Set' : isPreparingSet ? `Cancel ${startCountdown}` : 'Start Set'}
            </Text>
          </Pressable>

          {activeSession?.exercise === selectedExercise && (
            <Pressable style={styles.stickySecondaryButton} onPress={finishExercise}>
              <Text style={styles.stickySecondaryButtonText}>Finish Exercise</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.restDockRow}>
          <Text style={[styles.restDockLabel, { color: theme.dockMuted }]}>Rest Timer</Text>
          <View style={styles.restInlineControls}>
            <Pressable
              style={[styles.restPresetButton, !isRestTimerRunning && styles.restPresetButtonDisabled]}
              disabled={!isRestTimerRunning}
              onPress={() => {
                setRestSecondsLeft((prev) => Math.max(10, prev - 10));
              }}>
              <Text style={styles.restPresetButtonText}>-10s</Text>
            </Pressable>
            <View style={styles.restBaseTimerChip}>
              <Text style={styles.restBaseTimerChipText}>
                {isRestTimerRunning ? restTimerLabel : '2:00'}
              </Text>
            </View>
            <Pressable
              style={[styles.restPresetButton, !isRestTimerRunning && styles.restPresetButtonDisabled]}
              disabled={!isRestTimerRunning}
              onPress={() => {
                setRestSecondsLeft((prev) => prev + 10);
              }}>
              <Text style={styles.restPresetButtonText}>+10s</Text>
            </Pressable>
          </View>
        </View>

      </View>
    </View>
  );
}

function pad(value: number) {
  return value.toString().padStart(2, '0');
}

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

function normalizeLearnedProfile(profile: LearnedProfile | null) {
  if (!profile) {
    return null;
  }

  return {
    ...profile,
    learnedAt: profile.learnedAt ?? new Date().toISOString(),
  };
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
  workoutMetaCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
    gap: 10,
  },
  workoutMetaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaSectionTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  duplicateWorkoutButton: {
    backgroundColor: '#173f51',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  duplicateWorkoutButtonText: {
    color: '#f5fbff',
    fontSize: 13,
    fontWeight: '800',
  },
  workoutTitleInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 17,
    fontWeight: '700',
  },
  workoutNoteInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    minHeight: 68,
    fontSize: 15,
    fontWeight: '600',
    textAlignVertical: 'top',
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
  helpCard: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
  },
  helpCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  helpCardText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  finishSummaryCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  finishSummaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 6,
  },
  finishSummaryHeaderText: {
    flex: 1,
  },
  finishSummaryTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  finishSummarySubtitle: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  finishSummaryDismiss: {
    fontSize: 13,
    fontWeight: '700',
  },
  finishSummaryMeta: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
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
  setNoteText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
    fontStyle: 'italic',
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
  inlineRepInput: {
    minWidth: 64,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 14,
    fontWeight: '700',
  },
  inlineNoteInput: {
    minWidth: 120,
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 14,
    fontWeight: '600',
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
    flexWrap: 'wrap',
    marginTop: 12,
    marginBottom: 12,
    gap: 8,
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
  quickAdjustRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  quickAdjustButton: {
    flex: 1,
    backgroundColor: '#deebf1',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  quickAdjustButtonText: {
    color: '#173f51',
    fontSize: 14,
    fontWeight: '800',
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
  noteInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d3e4eb',
    backgroundColor: '#fbfdfe',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#173541',
    fontSize: 14,
    fontWeight: '600',
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
  restInlineControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  restPresetButton: {
    backgroundColor: '#214555',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    minWidth: 48,
    alignItems: 'center',
  },
  restPresetButtonDisabled: {
    opacity: 0.38,
  },
  restPresetButtonText: {
    color: '#f5fbfd',
    fontSize: 13,
    fontWeight: '800',
  },
  restBaseTimerChip: {
    backgroundColor: '#0f2430',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 68,
    alignItems: 'center',
  },
  restBaseTimerChipText: {
    color: '#f5fbfd',
    fontSize: 14,
    fontWeight: '800',
  },
});
