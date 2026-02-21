import "react-native-gesture-handler";
import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, View, Text, TouchableOpacity, Pressable, SafeAreaView } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";

import { loadLibraryItems, saveLibraryItems } from "./src/storage/libraryStorage";
import { loadSettings, saveSettings } from "./src/storage/settingsStorage";
import HomeScreen from "./src/screens/HomeScreen";
import RecordingScreen from "./src/screens/RecordingScreen";
import CreatingSummaryScreen from "./src/screens/CreatingSummaryScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import AudioFileScreen from "./src/screens/AudioFileScreen";
import MeetingNameScreen from "./src/screens/MeetingNameScreen";

const DEFAULT_SETTINGS = {
    recordingQuality: "Standard",
    autoTranscribe: true,
    autoSummary: true,
    promptSummaryLength: true,
    summaryLength: "Medium",
    meetingNameFormat: "Untitled {date} {time}",
    backgroundRecording: false,
    announceRecordingInProgress: true,
    announceRecordingStopped: true,
    wifiOnly: true,
    maxFileSize: "200",
    notifySummaryReady: true,
    notifyUploadComplete: true,
    notifyErrors: true,
    theme: "System",
    language: "English",
    forceDefaultLanguage: false,
    transcriptionLanguage: "auto",  // "auto" | "en" | "es" | "fr" | ...
    diarization: true,
};

export default function App() {
    const [activeScreen, setActiveScreen] = useState("home");
    // const [touchProbeOn, setTouchProbeOn] = useState(false); // debugging
    const [libraryItems, setLibraryItems] = useState([]);
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);
    const [settingsLoaded, setSettingsLoaded] = useState(false);
    const [uploadMeetingName, setUploadMeetingName] = useState("");
    const [recordingMeetingName, setRecordingMeetingName] = useState("New Meeting");
    const [openDetailRecordId, setOpenDetailRecordId] = useState(null);
    const [globalError, setGlobalError] = useState(null);
    const libraryLoadedRef = useRef(false);

    const handleSettingsChange = (patch) => {
        setSettings((prev) => ({ ...prev, ...patch }));
    };

    useEffect(() => {
        loadLibraryItems().then((items) => {
            setLibraryItems(Array.isArray(items) ? items : []);
            libraryLoadedRef.current = true;
        });
    }, []);

    useEffect(() => {
        loadSettings(DEFAULT_SETTINGS).then((loaded) => {
            const merged = { ...DEFAULT_SETTINGS };
            for (const key of Object.keys(loaded)) {
                if (loaded[key] !== undefined && loaded[key] !== null) {
                    merged[key] = loaded[key];
                }
            }
            setSettings(merged);
            setSettingsLoaded(true);
        });
    }, []);

    useEffect(() => {
        if (!libraryLoadedRef.current) return;
        saveLibraryItems(libraryItems);
    }, [libraryItems]);

    useEffect(() => {
        if (!settingsLoaded) return;
        saveSettings(settings);
    }, [settings, settingsLoaded]);

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

    // Debugging: heartbeat, touch probe, dev buttons (commented out for normal screen)
    // const hbRef = useRef(0);
    // useEffect(() => {
    //     const id = setInterval(() => {
    //         hbRef.current += 1;
    //         console.log("HB", hbRef.current, new Date().toISOString());
    //     }, 1000);
    //     return () => clearInterval(id);
    // }, []);

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaView style={{ flex: 1 }}>
                <StatusBar style="dark" />
                {globalError ? (
                    <View style={styles.globalErrorBanner}>
                        <Text style={styles.globalErrorText} numberOfLines={2}>{globalError}</Text>
                        <TouchableOpacity onPress={() => setGlobalError(null)} style={styles.globalErrorDismiss}>
                            <Text style={styles.globalErrorDismissText}>Dismiss</Text>
                        </TouchableOpacity>
                    </View>
                ) : null}

                {/* Touch Probe Overlay - commented out */}
                {/* {__DEV__ && touchProbeOn ? (
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
                ) : null} */}

                {/* DEV Buttons - commented out */}
                {/* {__DEV__ && (
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
                )} */}

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
                        settings={settings}
                        onSettingsChange={handleSettingsChange}
                        onGlobalError={setGlobalError}
                    />
                )}

                {activeScreen === "recording" && (
                    <RecordingScreen
                        meetingName={recordingMeetingName}
                        onBack={() => setActiveScreen("home")}
                        settings={settings}
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
                    <SettingsScreen
                        settings={settings}
                        onSettingsChange={handleSettingsChange}
                        onClose={() => setActiveScreen("home")}
                    />
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
    globalErrorBanner: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "#FEE2E2",
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#FECACA",
    },
    globalErrorText: {
        flex: 1,
        fontSize: 13,
        color: "#991B1B",
    },
    globalErrorDismiss: {
        paddingVertical: 4,
        paddingHorizontal: 12,
    },
    globalErrorDismissText: {
        fontSize: 13,
        fontWeight: "600",
        color: "#991B1B",
    },
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