Small app to record and transcript your thoughts. or ideas. or emotions.

## Development
`npx expo install`
`npx expo start`
`npx expo install --check`
`npx expo-doctor`


## next step
- on stop recording, send to backend.
    - where, how? 
    - with a user id (do we generate on auth, can we avoid auth to start?) -> generate uuid, store securely on device and use as userid.
    - can we make app fully workable offline? keep track of sized of stuff locally? only connnectionr equired when generating transcript or updating. 

## todo
- integrate firebase OR at least trigger pipeline of transcribe etc. 


## decisions
- asyncstorage vs https://rnfirebase.io -> keep things simpler and think about online integration later.