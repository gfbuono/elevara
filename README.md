# Elevara

Creator
- Gregory Buono, gfbuono@buffalo.edu

## Overview
Elevara is a mobile workout-tracking app focused on strength training. The current version uses phone motion data to help count reps during `Bicep Curl` and `Tricep Extension`, while also letting the user log sets, weights, notes, rest time, and workout history in one place. The project is aimed at making gym tracking faster and more automatic than manually writing workouts down after each set.

Instead of trying to recognize every possible lift, the app currently uses a learned motion profile for each supported exercise. The user teaches the app a movement in the `Exercises` tab, then uses the `Workout` tab to run sets, review previous performance, correct small miscounts, and save completed workouts. The `Profile` tab stores grouped workout history, draft progress, analytics, and personal records.

## Current Features
- Motion-based rep counting for `Bicep Curl` and `Tricep Extension`
- Saved exercise-learning profiles with relearn support
- Workout drafting and restore after the app closes
- Set logging with reps, weight, and optional set notes
- Manual rep and weight correction tools
- Automatic rest timer with adjustment controls
- Finish-exercise and finish-workout flow
- Grouped workout history on the Profile tab
- Personal records and simple consistency insights

## App Structure
- [app/(tabs)/index.tsx](C:/Users/grego/elevara/app/(tabs)/index.tsx): main workout flow
- [app/(tabs)/exercises.tsx](C:/Users/grego/elevara/app/(tabs)/exercises.tsx): learning and managing motion profiles
- [app/(tabs)/explore.tsx](C:/Users/grego/elevara/app/(tabs)/explore.tsx): profile, history, and analytics
- [app/(tabs)/_layout.tsx](C:/Users/grego/elevara/app/(tabs)/_layout.tsx): tab navigation

## Setup
1. Install dependencies with `npm install`
2. Start the app with `npm start`
3. Open it in Expo Go or an emulator
4. Learn an exercise profile in the `Exercises` tab before using live rep counting on the workout screen

## Progress Report
This project has moved from a basic prototype into a more complete workout app. The app now has a dedicated workout screen, a separate exercise-learning screen, and a profile/history screen. The workout flow supports only two movements right now, but it already includes motion-based rep tracking, saved exercise profiles, draft workout recovery, weight logging, set notes, rest timing, workout naming, and grouped workout history. The app also gives the user ways to correct mistakes by editing logged sets and adjusting reps when a count is slightly off.

The biggest progress so far has been improving usability and reliability. The interface has been simplified around real gym use, with larger controls, clearer active states, automatic rest timing, previous-workout references, and a finish-workout summary. On top of that, the app now stores personal records and simple consistency insights on the profile screen. While the system is still limited to a small number of exercises and needs more real-world testing, it already demonstrates the core goal of making strength-training tracking faster, smarter, and easier to manage directly from the phone.

## Next Steps
- Test rep counting more extensively in real gym conditions
- Expand support beyond the current two exercises
- Improve learned-profile robustness for different phone positions
- Add more long-term workout analytics and polish
