import AsyncStorage from "@react-native-async-storage/async-storage";
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

export default function App() {
  const [recording, setRecording] = useState();
  const [audioObjects, setAudioObjects] = useState([]); // [ {uri: "", filename: "", duration: 0} ]
  const [sound, setSound] = useState();
  const [permissionResponse, requestPermission] = Audio.usePermissions();
  const [pulseAnimation] = useState(new Animated.Value(1));

  useEffect(() => {
    getAudioFiles();
    return sound
      ? () => {
          console.log("Unloading Sound");
          sound.unloadAsync();
        }
      : undefined;
  }, [sound]);

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

  async function deleteAudioFile(filename) {
    try {
      await AsyncStorage.removeItem(filename);
      getAudioFiles();
    } catch (e) {
      console.error("Failed to delete audio file", e);
    }
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

  async function playSound(uri) {
    console.log("Loading Sound");
    const { sound } = await Audio.Sound.createAsync({ uri });
    setSound(sound);

    console.log("Playing Sound");
    await sound.playAsync();
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
      <Button
        title={recording ? "Stop Recording" : "Start Recording"}
        onPress={recording ? stopRecording : startRecording}
      />
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
            <Text>{file.filename}</Text>
            <Button
              title="Play"
              onPress={() => playSound(file.uri)}
            />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
});
