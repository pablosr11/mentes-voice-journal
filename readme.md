Small app to record and transcript your thoughts. or ideas. or emotions.

## Development

`npx expo install`
`npx expo start`
`npx expo install --check`
`npx expo-doctor`

`firebase login`
`firebase init functions`
`firebase emulators:start` - to start local firebase emulator for the fns
`firebase deploy --only functions:on_request_example` - to deploy a function

## issues

## next step

- generate transcript and data - log status in db

## todo

- refactor code (dry, data models, minimal local storage so we dont have to sync.)
- add auth
- read: https://firebase.google.com/docs/projects/api-keys + same for storage + firestore
- integrate firebase OR at least trigger pipeline of transcribe etc.
- do everything on device - no third party doing transcription/processing.
- set firebase bucket to private. only public during dev. FB storage > rules
  - enable app check. https://firebase.google.com/docs/storage/web/start#next_steps
- can we make app fully workable offline? keep track of sized of stuff locally? only connnectionr equired when generating transcript or updating.
- clean storage periodically (based on db entries.)

## decisions

- asyncstorage vs https://rnfirebase.io -> keep things simpler and think about online integration later.
- local device ID -> once auth is introduced we can group local ids against email/id (in case of multiple devices etc. )

## questions/doubts/to-think

- what to store locally? and online? -- whats the minimum locally? what would be latency to rerieve files etc?
