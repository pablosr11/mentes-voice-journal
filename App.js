import AsyncStorage from "@react-native-async-storage/async-storage";
import { NavigationContainer, useFocusEffect } from "@react-navigation/native";
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
  getDoc,
  getFirestore,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getStorage, ref, uploadBytes } from "firebase/storage";
import { useCallback, useEffect, useState } from "react";
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
  const [dataObject, setDataObject] = useState({ data: null });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    return sound
      ? () => {
          sound.unloadAsync();
        }
      : undefined;
  }, [sound]);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      fetchData();
      return () => {};
    }, [])
  );

  async function fetchData() {
    const docRef = doc(db, "voiceNotes", file.docId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      setDataObject(data);
      setIsLoading(false);
    } else {
      console.log("No such document!");
    }
  }

  async function playSound(uri) {
    console.log("Loading Sound");
    const { sound } = await Audio.Sound.createAsync({ uri });
    setSound(sound);

    console.log("Playing Sound");
    await sound.playAsync();
  }

  async function deleteAudioFile(filename) {
    try {
        updatedAt: serverTimestamp(),
      navigation.navigate("Home");
    } catch (e) {
      console.error("Failed to delete audio file", e);
    }
  }

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Text>{file.filename}</Text>
      <Text>Duration: {file.durationMs / 1000} seconds</Text>
      <Text>Size: {file.sizeBytes / 1000} KB</Text>
      <View style={{ height: 10 }} />
      <Text>Title: {dataObject.data.title}</Text>
      <Text>Summary: {dataObject.data.summary}</Text>
      <Text>
        Keywords:{" "}
        {dataObject.data.keywords ? dataObject.data.keywords.join(", ") : ""}
      </Text>
      <Text>Transcription: {dataObject.data.transcript}</Text>
      <View style={{ height: 10 }} />

      <View style={{ height: 20 }} />
      <Button
        title="Play"
        onPress={() => playSound(dataObject.device.onDeviceUri)}
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

  useEffect(() => {
    if (recording) {
      startPulseAnimation();
    } else {
      stopPulseAnimation();
    }
  }, [recording]);

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
    return uuid;
  }

  async function getAudioFiles() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const items = await AsyncStorage.multiGet(keys);
      setAudioObjects(items.map((item) => JSON.parse(item[1])));
    } catch (e) {
      console.error("Failed to get audio files", e);
    }
  }

  async function storeAudioLocally(audioObject) {
    const filename = audioObject.filename;
    try {
      await AsyncStorage.setItem(filename, JSON.stringify(audioObject));
      await getAudioFiles();
    } catch (e) {
      console.error("Failed to store audio", e);
    }
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
        await updateDoc(collection(db, "voiceNotes"), {
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
      {audioObjects.map((file) => (
        <View key={file.filename}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Button
              title={file.filename}
              onPress={() => navigation.navigate("Details", { file })}
            />
            <View style={{ width: 10 }} />
            {/* button to delete by filename */}
            <Button
              title="Delete"
              onPress={() => deleteAudioFile(file.filename)}
            />
          </View>
          <View style={{ height: 20 }} />
        </View>
      ))}
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
