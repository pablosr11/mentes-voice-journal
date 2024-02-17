import AsyncStorage from "@react-native-async-storage/async-storage";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Audio } from "expo-av";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
  Animated,
  Button,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { getApps, initializeApp } from "firebase/app";
import firebaseConfig from "./firebaseConfig"; // TODO: should this be commited?
import { getStorage, ref, uploadBytes } from "firebase/storage";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";

// Editing this file with fast refresh will reinitialize the app on every refresh, let's not do that
if (!getApps().length) {
  initializeApp(firebaseConfig);
}

const storage = getStorage();
const Stack = createNativeStackNavigator();

function DetailsScreen({ route, navigation }) {
  const { file } = route.params;
  const [sound, setSound] = useState();

  useEffect(() => {
    return sound
      ? () => {
          console.log("Unloading Sound");
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

  async function deleteAudioFile(filename) {
    try {
      await AsyncStorage.removeItem(filename);
      navigation.navigate("Home");
    } catch (e) {
      console.error("Failed to delete audio file", e);
    }
  }

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Text>{file.filename}</Text>
      <Text>Duration: {file.duration / 1000} seconds</Text>
      <Text>Summary: ~~100 random chars </Text>
      <Text>Bullets points: xxx </Text>
      <Text>Tags: #tag1 #tag2 #tag3 </Text>
      <View style={{ height: 20 }} />
      <Button title="Play" onPress={() => playSound(file.uri)} />
      <View style={{ height: 10 }} />
      <Button title="Delete" onPress={() => deleteAudioFile(file.filename)} />
      <View style={{ height: 30 }} />
      <Button title="Go to Home" onPress={() => navigation.navigate("Home")} />
    </View>
  );
}

function HomeScreen({ navigation }) {
  const [recording, setRecording] = useState();
  const [audioObjects, setAudioObjects] = useState([]); // [ {uri: "", filename: "", duration: 0} ]
  const [permissionResponse, requestPermission] = Audio.usePermissions();
  const [pulseAnimation] = useState(new Animated.Value(1));

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      getAudioFiles();
    });
    return unsubscribe;
  }, [navigation]);

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
    return `Note_${day}${month}${year}_${hours}${minutes}${seconds}.m4a`;
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
    await recording.stopAndUnloadAsync();
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
    });

    const { durationMillis } = await recording.getStatusAsync();
    const uri = recording.getURI();
    const audioName = await generateFilename();

    const audioObject = {
      uri,
      filename: audioName,
      duration: durationMillis,
    };

    await storeAudioLocally(audioObject);

    console.log("Recording stopped and stored at", uri);
  }
  return (
    <View style={styles.container}>
      <Text>Tap to start recording!</Text>
      <View style={{ height: 20 }} />
      <Animated.View style={{ transform: [{ scale: pulseAnimation }] }}>
        <TouchableOpacity
          style={
            recording
              ? [styles.recordButton, { backgroundColor: "red" }]
              : styles.recordButton
          }
          onPress={recording ? stopRecording : startRecording}
        >
          <Text style={styles.buttonText}>
            {recording ? "Stop Recording" : "Start Recording"}
          </Text>
        </TouchableOpacity>
      </Animated.View>
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
