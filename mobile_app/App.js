import "react-native-gesture-handler";
import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, View, Text, TouchableOpacity, Pressable, SafeAreaView } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";

import HomeScreen from "./src/screens/HomeScreen";
import RecordingScreen from "./src/screens/RecordingScreen";
import CreatingSummaryScreen from "./src/screens/CreatingSummaryScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import AudioFileScreen from "./src/screens/AudioFileScreen";
import MeetingNameScreen from "./src/screens/MeetingNameScreen";

export default function App() {
    const [activeScreen, setActiveScreen] = useState("home");
    const [touchProbeOn, setTouchProbeOn] = useState(false);
    const [libraryItems, setLibraryItems] = useState([]);
    const [uploadMeetingName, setUploadMeetingName] = useState("");
    const [recordingMeetingName, setRecordingMeetingName] = useState("New Meeting");
    const [openDetailRecordId, setOpenDetailRecordId] = useState(null);

    const addToLibrary = (record) => {
        if (record && record.id) {
            setLibraryItems((prev) => [...prev, record]);
        }
    };

    const handleUploadRecording = (meetingName) => {
        setUploadMeetingName(meetingName?.trim() || "Meeting");
        setActiveScreen("audio");
    };

    const handleSaveFromAudio = (record) => {
        addToLibrary(record);
        setOpenDetailRecordId(record.id);
        setActiveScreen("home");
    };

    // Heartbeat
    const hbRef = useRef(0);
    useEffect(() => {
        const id = setInterval(() => {
            hbRef.current += 1;
            console.log("HB", hbRef.current, new Date().toISOString());
        }, 1000);
        return () => clearInterval(id);
    }, []);

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaView style={{ flex: 1 }}>
                <StatusBar style="dark" />

                {/* Touch Probe Overlay */}
                {__DEV__ && touchProbeOn ? (
                    <Pressable
                        style={[StyleSheet.absoluteFill, { zIndex: 9999 }]}
                        onPress={(e) => {
                            const { pageX, pageY } = e.nativeEvent;
                            console.log("TOUCH PROBE:", pageX, pageY);
                        }}
                    >
                        <View
                            style={{
                                position: "absolute",
                                top: 50,
                                left: 20,
                                right: 20,
                                backgroundColor: "rgba(0,0,0,0.8)",
                                padding: 10,
                                borderRadius: 10,
                            }}
                            pointerEvents="none"
                        >
                            <Text style={{ color: "white", textAlign: "center" }}>
                                Touch Probe ON
                            </Text>
                        </View>
                    </Pressable>
                ) : null}

                {/* DEV Buttons */}
                {__DEV__ && (
                    <>
                        <TouchableOpacity
                            style={styles.devButton}
                            onPress={() => console.log("DBG TAP")}
                        >
                            <Text style={styles.devButtonText}>DBG</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.devButton2}
                            onPress={() => setTouchProbeOn((v) => !v)}
                        >
                            <Text style={styles.devButtonText}>TP</Text>
                        </TouchableOpacity>
                    </>
                )}

                {/* Screens */}
                {activeScreen === "home" && (
                    <HomeScreen
                        onStartRecording={(name) => {
                            setRecordingMeetingName(name?.trim() || "New Meeting");
                            setActiveScreen("recording");
                        }}
                        onUploadRecording={handleUploadRecording}
                        libraryItems={libraryItems}
                        onSaveRecording={addToLibrary}
                        onUpdateRecording={(id, updates) =>
                            setLibraryItems((prev) =>
                                prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
                            )
                        }
                        onDeleteRecording={(id) =>
                            setLibraryItems((prev) => prev.filter((item) => item.id !== id))
                        }
                        onLibraryOpen={() => {}}
                        openDetailRecordId={openDetailRecordId}
                        onDetailOpened={() => setOpenDetailRecordId(null)}
                    />
                )}

                {activeScreen === "recording" && (
                    <RecordingScreen
                        meetingName={recordingMeetingName}
                        onBack={() => setActiveScreen("home")}
                        onSaveRecording={(record) => {
                            addToLibrary(record);
                            setActiveScreen("home");
                        }}
                    />
                )}

                {activeScreen === "summary" && (
                    <CreatingSummaryScreen onBack={() => setActiveScreen("home")} />
                )}

                {activeScreen === "settings" && (
                    <SettingsScreen onBack={() => setActiveScreen("home")} />
                )}

                {activeScreen === "audio" && (
                    <AudioFileScreen
                        meetingName={uploadMeetingName}
                        onBack={() => setActiveScreen("home")}
                        onSaveRecording={handleSaveFromAudio}
                        onUploadStart={() => {}}
                        onUploadComplete={() => setActiveScreen("home")}
                        maxFileSizeMb={25}
                        visible={true}
                    />
                )}

                {activeScreen === "meetingName" && (
                    <MeetingNameScreen onBack={() => setActiveScreen("home")} />
                )}
            </SafeAreaView>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    devButton: {
        position: "absolute",
        top: 12,
        left: 12,
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(220, 38, 38, 0.85)",
        zIndex: 10000,
    },
    devButton2: {
        position: "absolute",
        top: 12,
        left: 64,
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.7)",
        zIndex: 10000,
    },
    devButtonText: {
        color: "white",
        fontWeight: "800",
    },
});