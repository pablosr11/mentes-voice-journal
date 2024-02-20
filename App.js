import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Audio } from "expo-av";
import * as Crypto from "expo-crypto";
import * as Device from "expo-device";
import * as SecureStore from "expo-secure-store";
import { StatusBar } from "expo-status-bar";
import { getApps, initializeApp } from "firebase/app";
import {
  addDoc,
  collection,
  doc,
  getFirestore,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getStorage, ref, uploadBytes } from "firebase/storage";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Button,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import firebaseConfig from "./firebaseConfig";

// To avoid reinitializing the app on every refresh
if (!getApps().length) {
  var app = initializeApp(firebaseConfig);
}

const blobStorage = getStorage();
const Stack = createNativeStackNavigator();
const db = getFirestore(app);

const functions = getFunctions(app, "europe-west2");
const onRequestTranscription = httpsCallable(functions, "on_request_example");

function DetailsScreen({ route, navigation }) {
  const { file } = route.params;
  const [sound, setSound] = useState();

  useEffect(() => {
    return sound
      ? () => {
          sound.unloadAsync();
        }
      : undefined;
  }, [sound]);

  async function playSound(uri) {
    console.log("Loading Sound");
    const { sound } = await Audio.Sound.createAsync({ uri });
    setSound(sound);
    console.log("Playing Sound");
    await sound.playAsync();
  }

  async function deleteAudioFile() {
    try {
      const audioObjectRef = doc(db, "voiceNotes", file.docId);
      await updateDoc(audioObjectRef, {
        hasBeenDeleted: true,
        updatedAt: serverTimestamp(),
      });

      navigation.navigate("Home");
    } catch (e) {
      console.error("Failed to delete audio file", e);
    }
  }
  if (file.status === "ERROR") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text>Failed to process {file.data.title || file.filename} </Text>
        <View style={{ height: 10 }} />
        <Button title="Delete" onPress={() => deleteAudioFile(file.filename)} />
        <View style={{ height: 30 }} />
        <Button
          title="Go to Home"
          onPress={() => navigation.navigate("Home")}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Text>{file.filename}</Text>
      <Text>Duration: {file.durationMs / 1000} seconds</Text>
      <Text>Size: {file.sizeBytes / 1000} KB</Text>
      <View style={{ height: 10 }} />
      <Text>Title: {file.data.title}</Text>
      <Text>Summary: {file.data.summary}</Text>
      <Text>
        Keywords:{" "}
        {file.data.keywords ? file.data.keywords.join(", ") : "No keywords"}
      </Text>
      <Text>Transcription: {file.data.transcript}</Text>
      <View style={{ height: 10 }} />

      <View style={{ height: 20 }} />
      <Button
        title="Play"
        onPress={() => playSound(file.device.deviceStoragePath)}
      />
      <View style={{ height: 10 }} />
      <Button title="Delete" onPress={() => deleteAudioFile(file.filename)} />
      <View style={{ height: 30 }} />
      <Button title="Go to Home" onPress={() => navigation.navigate("Home")} />
    </View>
  );
}

function HomeScreen({ navigation }) {
  const [recording, setRecording] = useState();
  const [audioObjects, setAudioObjects] = useState([]);
  const [permissionResponse, requestPermission] = Audio.usePermissions();
  const [pulseAnimation] = useState(new Animated.Value(1));
  const [isProcessing, setIsProcessing] = useState(false);
  const [userId, setUserId] = useState();

  useEffect(() => {
    if (recording) {
      startPulseAnimation();
    } else {
      stopPulseAnimation();
    }
  }, [recording]);

  useEffect(() => {
    if (!userId) {
      getLocalUserId();
      return;
    }
    const q = query(
      collection(db, "voiceNotes"),
      where("userId", "==", userId)
    );
    const unsubscribe = onSnapshot(q, {
      next: (querySnapshot) => {
        const voiceNotes = [];
        console.log("Updating audio objects..");
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          if (!data.hasBeenDeleted) {
            voiceNotes.push({ docId: doc.id, ...data });
          }
        });

        setAudioObjects(voiceNotes);
      },
      error: (e) => {
        console.error("Error getting documents: ", e);
      },
    });
    return unsubscribe;
  }, [setAudioObjects, userId]);

  function startPulseAnimation() {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnimation, {
          toValue: 0.8,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnimation, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }

  function stopPulseAnimation() {
    pulseAnimation.setValue(1);
  }

  async function getLocalUserId() {
    const fetchUUID = await SecureStore.getItemAsync("secure_deviceid");
    if (fetchUUID) {
      console.log("Fetched UUID from secure storage");
      const cleanUUID = fetchUUID.replace(/['"]+/g, "");
      uuid = cleanUUID;
    } else {
      uuid = Crypto.randomUUID();
      await SecureStore.setItemAsync("secure_deviceid", JSON.stringify(uuid));
      console.log("Generated new UUID and stored in secure storage");
    }
    setUserId(uuid);
    return uuid;
  }

  async function generateFilename() {
    const date = new Date();
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const seconds = date.getSeconds().toString().padStart(2, "0");
    return `VoiceNote_${day}${month}${year}_${hours}${minutes}${seconds}.m4a`;
  }

  async function startRecording() {
    try {
      if (permissionResponse.status !== "granted") {
        console.log("Requesting permission..");
        await requestPermission();
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      console.log("Starting recording..");
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      console.log("Recording started");
    } catch (err) {
      console.error("Failed to start recording", err);
    }
  }

  async function stopRecording() {
    console.log("Stopping recording..");
    setRecording(undefined);
    setIsProcessing(true);
    await recording.stopAndUnloadAsync();
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
    });

    const { durationMillis: durationMs } = await recording.getStatusAsync();
    const deviceStoragePath = recording.getURI();
    const response = await fetch(deviceStoragePath);
    const blob = await response.blob();

    const sizeBytes = blob.size;
    const userId = await getLocalUserId();
    const filename = await generateFilename();
    const blobStoragePath = `audios/${userId}/${filename}`;

    const { osName, osVersion, modelName } = Device;

    const audioObject = {
      filename,
      sizeBytes,
      durationMs,
      status: "PROCESSING",
      data: {
        title: null,
        summary: null,
        keywords: null,
        transcript: null,
      },
      userId,
      blobStoragePath,
      hasBeenDeleted: false,
      createdAt: serverTimestamp(),
      device: {
        osName,
        osVersion,
        modelName,
        deviceStoragePath,
      },
    };

    const storageRef = ref(blobStorage, blobStoragePath);
    await uploadBytes(storageRef, blob);

    try {
      const docRef = await addDoc(collection(db, "voiceNotes"), audioObject);
      console.log("Document written externally");
      audioObject.docId = docRef.id;
      await onRequestTranscription({
        docId: docRef.id,
        blobStoragePath,
      });
      console.log("Requested transcription");
    } catch (e) {
      try {
        const audioObjectRef = doc(db, "voiceNotes", audioObject.docId);
        await updateDoc(audioObjectRef, {
          status: "ERROR",
          updatedAt: serverTimestamp(),
        });
      } catch (e) {
        console.error("Error updating document: ", e);
      }

      console.error("Error connecting with database: ", e);
    }

    console.log("Recording stopped");
    setIsProcessing(false);
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.recordButton}
        onPress={recording ? stopRecording : startRecording}
        disabled={isProcessing}
      >
        <Animated.Text
          style={[
            styles.buttonText,
            {
              transform: [{ scale: pulseAnimation }],
            },
          ]}
        >
          {recording ? "Stop" : "Record"}
        </Animated.Text>
      </TouchableOpacity>
      <View style={{ height: 20 }} />
      <View style={{ height: 20 }} />

      <Text>Notes:</Text>
      <View style={{ height: 20 }} />
      {audioObjects
        .filter((audioObject) => !audioObject.hasBeenDeleted)
        .sort((b, a) => b.createdAt - a.createdAt)
        .map((audioObject) => {
          if (audioObject.status === "COMPLETE") {
            return (
              <View key={audioObject.docId}>
                <Button
                  title={audioObject.data.title}
                  onPress={() =>
                    navigation.navigate("Details", { file: audioObject })
                  }
                />
                <View style={{ height: 10 }} />
              </View>
            );
          } else if (audioObject.status === "ERROR") {
            return (
              <View key={audioObject.docId}>
                <Button
                  title={audioObject.filename}
                  onPress={() =>
                    navigation.navigate("Details", { file: audioObject })
                  }
                />
                <View style={{ height: 10 }} />
              </View>
            );
          } else {
            return (
              <View key={audioObject.docId}>
                <ActivityIndicator size="large" color="#0000ff" />
                <View style={{ height: 10 }} />
              </View>
            );
          }
        })}

      <StatusBar style="auto" />
    </View>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Home">
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Details" component={DetailsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  recordButton: {
    backgroundColor: "green",
    padding: 10,
    borderRadius: 5,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
  },
});
