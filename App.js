import { Audio } from "expo-av";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Button, StyleSheet, Text, View } from "react-native";

export default function App() {
  const [recording, setRecording] = useState();
  const [filepaths, setFilepaths] = useState([]); // [uri1, uri2, uri3, ...
  const [sound, setSound] = useState();
  const [permissionResponse, requestPermission] = Audio.usePermissions();

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
    const uri = recording.getURI();
    setFilepaths((prev) => [...prev, uri]);
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
      <Text>Recordings:</Text>
      {/* list of recording with some padding between them */}
      {filepaths.map((uri, i) => (
        <View key={i}>
          <Button title={uri} onPress={() => playSound(uri)} />
          <View style={{ height: 10 }} />
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
