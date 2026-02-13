import React, { useState } from "react";
import { SafeAreaView, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import HomeScreen from "./src/screens/HomeScreen";
import RecordingScreen from "./src/screens/RecordingScreen";
import CreatingSummaryScreen from "./src/screens/CreatingSummaryScreen";
import AudioFileScreen from "./src/screens/AudioFileScreen";

export default function App() {
    const [activeScreen, setActiveScreen] = useState("home");
    const [meetingName, setMeetingName] = useState("New Meeting");

    const handleStartRecording = (name) => {
        setMeetingName(name || "New Meeting");
        setActiveScreen("recording");
    };

    const handleUploadRecording = (name) => {
        setMeetingName(name || "New Meeting");
        setActiveScreen("audioFile");
    };

    const handleBackHome = () => setActiveScreen("home");

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="dark" />
            {activeScreen === "home" ? (
                <HomeScreen
                    onStartRecording={handleStartRecording}
                    onUploadRecording={handleUploadRecording}
                />
            ) : activeScreen === "audioFile" ? (
                <AudioFileScreen meetingName={meetingName} onBack={handleBackHome} />
            ) : activeScreen === "creatingSummary" ? (
                <CreatingSummaryScreen meetingName={meetingName} onBack={handleBackHome} />
            ) : (
                <RecordingScreen meetingName={meetingName} onBack={handleBackHome} />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F8FAFC"
    }
});
