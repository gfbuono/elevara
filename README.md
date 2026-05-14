# Elevara

Creator: Gregory Buono  
Course project repository: `gfbuono/elevara`

## Motivation / Overview

Elevara is a mobile workout-tracking app focused on strength training. I chose this project because strength workouts are still often tracked manually: people count reps in their head, write sets down between exercises, or enter everything into an app after the workout. That process is easy to forget and can interrupt the workout itself.

The goal of Elevara is to make workout logging faster by using the phone's motion sensors to help count repetitions during an exercise. The current prototype supports `Bicep Curl` and `Tricep Extension`. A user can teach the app a motion profile for each exercise, start a set, let the app count reps, log weight and notes, use a rest timer, and save finished workouts to a profile/history screen.

This project should be useful to anyone interested in fitness tracking that turns raw device motion into a practical user interface.

## Demonstration

YouTube demo video: **(https://youtu.be/bTE0qtNwAiM?si=eGvCQ3xgVg7wmAqR)**

The demo video shows the main workflow:

1. Open the app and go to the `Exercises` tab.
2. Select an exercise such as `Bicep Curl`.
3. Tap `Learn Rep` and perform one clean rep with the phone.
4. Optionally tap `Learn Stop Gesture` and perform a distinct stop gesture.
5. Go to the `Workout` tab.
6. Enter a weight and optional note.
7. Tap `Start Set`, wait for the countdown, and perform several reps.
8. Log the set and show that the set was saved.
9. Repeat with `Tricep Extension`.
10. Finish the workout and show the saved history in the `Profile` tab.


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

In the future I plan on:

First, I would add more exercises. The current prototype focuses on a small set of arm movements, but a more complete version should support exercises such as shoulder press, bench press, lateral raises, squats, rows, and other strength-training movements. Each exercise would need its own testing because different lifts create different motion patterns.

Second, I would create a cleaner and more polished user interface. The current UI is functional for a prototype, but future versions could improve spacing, navigation, visual hierarchy, charts, button placement, and overall usability during an actual workout.

Third, I would implement the app on the Apple Watch. Since the watch is already worn on the wrist, it would be a natural device for collecting motion data during workouts. An Apple Watch version could make rep counting more convenient because users would not need to hold their phone while exercising.

Finally, I would like to create my own wearable hardware with a Bluetooth connection. This device could use motion sensors to detect reps and then send set data to the mobile app. Building custom hardware would make the project closer to the original idea of a dedicated fitness-tracking wearable.


Known issues and bugs:

- Rep counting can miscount if the phone is held differently than it was during learning.
- Stop gesture detection can conflict with rep motion if the learned stop gesture is too similar to the exercise.
