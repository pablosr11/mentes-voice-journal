Small app to record and transcript your thoughts. or ideas. or emotions.

## Development

`npx expo install`
`npx expo start`
`npx expo install --check`
`npx expo-doctor`

## issues

## next step
- generate transcript and data - log status in db

## todo


- refactor code
- add auth
- read: https://firebase.google.com/docs/projects/api-keys + same for storage + firestore
- integrate firebase OR at least trigger pipeline of transcribe etc.
- do everything on device - no third party doing transcription/processing.
- can we make app fully workable offline? keep track of sized of stuff locally? only connnectionr equired when generating transcript or updating.
- clean storage periodically (based on db entries.)

## decisions

- asyncstorage vs https://rnfirebase.io -> keep things simpler and think about online integration later.
- local device ID -> once auth is introduced we can group local ids against email/id (in case of multiple devices etc. )

## questions/doubts/to-think
