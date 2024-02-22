Small app to record and transcript your thoughts. or ideas. or emotions.

## Development

`npx expo install`
`npx expo start`
`npx expo install --check`
`npx expo-doctor`

`firebase login`
`firebase init functions`
`firebase emulators:start` - to start local firebase emulator for the fns
`firebase deploy --only functions` - to deploy a function (set env vars in .env or in the console)

## issues

## next step
- publish to android store
  - check expo eas build to do it as manually seems tedius/complex for the experiment. 
  - currently failing for firebase config. should we commit? if so - what protections on the DB to avoide abuse missue etc? 


## todo
- check talknotes -- 
- add usage limits until payment included? or some way of reducing costs. -- openai limit is 25mb per audio. limit N notes of M minutes as a test - should be plenty enough for more than a couple days. ()
- only backend writes to DB - frontend only reads
- text search on notes!
- styling the notes w date + title. 
- refactor data models and data flows -> copy to offline and dont pull again. if status == complete. what are implications.
- refactor code (dry, data models, minimal local storage so we dont have to sync.)
- read: https://firebase.google.com/docs/projects/api-keys + same for storage + firestore
- do everything on device - no third party doing transcription/processing.
- set firebase bucket to private. only public during dev. FB storage > rules
  - enable app check. https://firebase.google.com/docs/storage/web/start#next_steps
- can we make app fully workable offline? keep track of sized of stuff locally? only connnectionr equired when generating transcript or updating.
- clean storage periodically (based on db entries.) - issues sync offline and online datastores (local file deletion.. what about db.)
- check if we could sync external to local db periodically. (or on demand)

## decisions

- asyncstorage vs https://rnfirebase.io -> keep things simpler and think about online integration later.
- soft delete + on demand deletion. every entry has isDeleted flag. and a delete button

## questions/doubts/to-think

- what to store locally? and online? -- whats the minimum locally? what would be latency to rerieve files etc?
- trigger from file saved instead of http on stopreecording?
