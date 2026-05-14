# Elevara

Creator: Gregory Buono  
Course project repository: `gfbuono/elevara`

## Motivation / Overview

Elevara is a mobile workout-tracking app focused on strength training. I chose this project because strength workouts are still often tracked manually: people count reps in their head, write sets down between exercises, or enter everything into an app after the workout. That process is easy to forget and can interrupt the workout itself.

The goal of Elevara is to make workout logging faster by using the phone's motion sensors to help count repetitions during an exercise. The current prototype supports `Bicep Curl` and `Tricep Extension`. A user can teach the app a motion profile for each exercise, start a set, let the app count reps, log weight and notes, use a rest timer, and save finished workouts to a profile/history screen.

This project should be useful to anyone interested in fitness tracking, mobile app development, sensor-based interaction, or prototypes that turn raw device motion into a practical user interface.

## Demonstration

YouTube demo video: **TODO: add YouTube link here**

The demo video should show the main workflow:

1. Open the app and go to the `Exercises` tab.
2. Select an exercise such as `Bicep Curl`.
3. Tap `Learn Rep` and perform one clean rep with the phone.
4. Optionally tap `Learn Stop Gesture` and perform a distinct stop gesture.
5. Go to the `Workout` tab.
6. Enter a weight and optional note.
7. Tap `Start Set`, wait for the countdown, and perform several reps.
8. Log the set and show that the set was saved.
9. Finish the workout and show the saved history in the `Profile` tab.

Suggested screenshots or images to add to the `media/` folder:

- `media/exercises-screen.png`: the exercise learning screen.
- `media/workout-screen.png`: the main workout screen before starting a set.
- `media/live-counting.png`: the live rep-counting overlay.
- `media/profile-history.png`: the profile/history screen after saving a workout.

## Installation Instructions

This project is built with Expo and React Native. To recreate the project, install Node.js first, then clone the repository and install the dependencies.

### Required Software

- Node.js
- npm
- Expo Go app on a phone, or an Android/iOS simulator
- Git

### Clone the Repository

```bash
git clone https://github.com/gfbuono/elevara.git
cd elevara
```

### Install Dependencies

```bash
npm install
```

### Optional: Check the Project

```bash
npx tsc --noEmit
npm run lint
```

## How to Run the Code

Start the Expo development server:

```bash
npm start
```

If the app opens an old cached version, clear the Metro cache:

```bash
npm start -- --clear
```

Then run the app using one of these options:

- Scan the QR code with Expo Go on your phone.
- Press `a` in the terminal to open Android.
- Press `i` in the terminal to open iOS on macOS.
- Press `w` in the terminal to open the web version.

You can also run platform-specific commands:

```bash
npm run android
npm run ios
npm run web
```

## How to Use the App

1. Open the `Exercises` tab.
2. Choose `Bicep Curl` or `Tricep Extension`.
3. Tap `Learn Rep` and perform one slow, clean rep.
4. Tap `Learn Stop Gesture` if you want to end sets with a motion gesture.
5. Open the `Workout` tab.
6. Enter a weight and optional set note.
7. Tap `Start Set`.
8. Wait for the countdown, then perform reps.
9. Tap `Log Set` when finished.
10. Finish the workout to save it to history.
11. Open the `Profile` tab to view saved workouts, totals, and personal records.

## Structure of the Repo

```text
elevara/
├── app/
│   ├── (tabs)/
│   │   ├── index.tsx       # Main workout and rep-counting screen
│   │   ├── exercises.tsx   # Exercise learning and stop gesture screen
│   │   ├── explore.tsx     # Profile, history, and analytics screen
│   │   └── _layout.tsx     # Bottom tab navigation
│   ├── _layout.tsx         # Root Expo Router layout
│   └── modal.tsx           # Default modal route
├── assets/
│   └── images/             # App icons and image assets
├── components/             # Shared React Native components
├── constants/              # Theme constants
├── hooks/                  # Shared React hooks
├── media/                  # Screenshots and demo media for README
├── scripts/                # Utility scripts
├── app.json                # Expo app configuration
├── eas.json                # EAS build configuration
├── package.json            # Dependencies and npm scripts
└── README.md               # Project documentation
```

## References

Helpful references:

- [Expo documentation](https://docs.expo.dev/) helped with project setup, running the app, and Expo configuration.
- [Expo Router documentation](https://docs.expo.dev/router/introduction/) helped with the tab-based file routing structure.
- [React Native documentation](https://reactnative.dev/docs/getting-started) helped with core UI components such as `View`, `Text`, `ScrollView`, `Pressable`, and `TextInput`.
- [Expo Sensors documentation](https://docs.expo.dev/versions/latest/sdk/sensors/) helped with reading phone motion data through `DeviceMotion`.
- [AsyncStorage documentation](https://react-native-async-storage.github.io/async-storage/) helped with saving learned profiles, workout drafts, and workout history locally.
- [Expo Haptics documentation](https://docs.expo.dev/versions/latest/sdk/haptics/) helped with vibration feedback after reps, saved sets, and timer completion.

Less helpful or limited references:

- General fitness tracker articles were useful for understanding the problem, but they did not provide much implementation detail for custom rep counting.
- Generic accelerometer tutorials were helpful at a high level, but many focused on step counting or device orientation instead of strength-training motions.
- Some React Native animation examples were too complex for this prototype, so the app uses simpler built-in `Animated` effects.

## Future Work

If I had more time, I would improve Elevara in several ways.

First, I would make the motion recognition more reliable. The current app learns one motion profile per exercise and uses thresholds to detect reps. This works for a prototype, but it can be sensitive to phone position, speed, and how consistently the user performs the movement. A future version could collect multiple sample reps, average them, and store a more robust profile. It could also ask the user where the phone is being held, such as hand, wrist, or pocket.

Second, I would improve the stop gesture. The app currently supports a learned stop gesture, but it can still conflict with normal rep motion if the gesture is too similar to the exercise. A better version would require a more distinct gesture, such as a side-to-side shake or double flick, and would ignore stop detection while a rep is actively being counted.

Third, I would add more exercises. The prototype only supports `Bicep Curl` and `Tricep Extension`. Future versions could add shoulder press, bench press, lateral raises, squats, and other movements. This would require more testing because each exercise produces different motion data.

Fourth, I would improve the workout analytics. The profile screen currently shows workout history, totals, and simple personal records. Future analytics could include weekly volume, best estimated one-rep max, progress charts, rest-time trends, and exercise-specific history.

Fifth, I would improve testing and validation. The app needs more real gym testing with different users, different phones, and different exercise speeds. It would also benefit from unit tests around the rep-counting state machine and storage normalization functions.

Known issues and bugs:

- Rep counting can miscount if the phone is held differently than it was during learning.
- Stop gesture detection can conflict with rep motion if the learned stop gesture is too similar to the exercise.
- Expo may open a cached project if a previous Metro server is still running; restarting Expo with `npm start -- --clear` usually fixes this.
- Some lint warnings remain in the workout screen related to React hook dependencies. The app runs, but these should be cleaned up in a future refactor.
