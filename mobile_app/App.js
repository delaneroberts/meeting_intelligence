import "react-native-gesture-handler";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Modal, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import HomeScreen from "./src/screens/HomeScreen";
import RecordingScreen from "./src/screens/RecordingScreen";
import CreatingSummaryScreen from "./src/screens/CreatingSummaryScreen";
import AudioFileScreen from "./src/screens/AudioFileScreen";
import { loadLibraryItems, saveLibraryItems } from "./src/storage/libraryStorage";

export default function App() {
    const [activeScreen, setActiveScreen] = useState("home");
    const [meetingName, setMeetingName] = useState("New Meeting");
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [libraryItems, setLibraryItems] = useState([]);
    const [openDetailRecordId, setOpenDetailRecordId] = useState(null);
    const [openLibraryRequestId, setOpenLibraryRequestId] = useState(0);
    const [uploadInProgress, setUploadInProgress] = useState(false);
    const [uploadSuccessRecordId, setUploadSuccessRecordId] = useState(null);
    const uploadProgressRef = useRef(new Animated.Value(0));
    const [settings, setSettings] = useState({
        recordingQuality: "Standard",
        autoTranscribe: true,
        autoSummary: true,
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
        forceDefaultLanguage: false
    });

    const handleSettingsChange = (updates) => {
        setSettings((current) => ({ ...current, ...updates }));
    };

    useEffect(() => {
        const loadItems = async () => {
            const items = await loadLibraryItems();
            setLibraryItems(items);
        };
        loadItems();
    }, []);

    useEffect(() => {
        saveLibraryItems(libraryItems);
    }, [libraryItems]);

    const handleStartRecording = (name) => {
        setMeetingName(name || "New Meeting");
        setActiveScreen("recording");
    };

    const handleUploadRecording = (name) => {
        setMeetingName(name || "New Meeting");
        setShowUploadModal(true);
    };

    const handleSaveRecording = (record) => {
        setLibraryItems((current) => [record, ...current]);
    };

    const handleShowMeetingDetails = (recordId) => {
        setOpenDetailRecordId(recordId);
        setActiveScreen("home");
        setShowUploadModal(false);
    };

    const handleUploadStart = () => {
        setUploadInProgress(true);
        setActiveScreen("home");
        setShowUploadModal(false);
    };

    const handleUploadComplete = (recordId) => {
        setUploadInProgress(false);
        if (recordId) {
            setTimeout(() => {
                setOpenDetailRecordId(recordId);
                setUploadSuccessRecordId(recordId);
            }, 100);
        }
        setActiveScreen("home");
        setShowUploadModal(false);
    };

    const handleShowLibrary = () => {
        setOpenLibraryRequestId((current) => current + 1);
        setActiveScreen("home");
        setShowUploadModal(false);
    };

    const handleDeleteRecording = (recordId) => {
        setLibraryItems((current) => current.filter((item) => item.id !== recordId));
    };

    const handleUpdateRecording = (recordId, updates) => {
        setLibraryItems((current) =>
            current.map((item) => (item.id === recordId ? { ...item, ...updates } : item))
        );
    };

    const handleRefreshLibrary = async () => {
        const items = await loadLibraryItems();
        setLibraryItems(items);
    };

    const handleTranscribeAndSummarize = () => {
        setActiveScreen("creatingSummary");
    };

    const handleBackHome = () => {
        setActiveScreen("home");
        setShowUploadModal(false);
    };

    useEffect(() => {
        if (!uploadInProgress) {
            uploadProgressRef.current.stopAnimation();
            uploadProgressRef.current.setValue(0);
            return;
        }
        const animation = Animated.loop(
            Animated.sequence([
                Animated.timing(uploadProgressRef.current, {
                    toValue: 1,
                    duration: 1200,
                    useNativeDriver: false
                }),
                Animated.timing(uploadProgressRef.current, {
                    toValue: 0,
                    duration: 1200,
                    useNativeDriver: false
                })
            ])
        );
        animation.start();
        return () => animation.stop();
    }, [uploadInProgress]);

    const uploadProgressWidth = uploadProgressRef.current.interpolate({
        inputRange: [0, 1],
        outputRange: ["15%", "90%"]
    });

    return (
        <GestureHandlerRootView style={styles.container}>
            <SafeAreaView style={styles.container}>
                <StatusBar style="dark" />
                {activeScreen === "recording" ? (
                    <RecordingScreen
                        meetingName={meetingName}
                        onBack={handleBackHome}
                        settings={settings}
                        onSaveRecording={handleSaveRecording}
                        onTranscribeAndSummarize={handleTranscribeAndSummarize}
                        onShowMeetingDetails={handleShowMeetingDetails}
                    />
                ) : activeScreen === "creatingSummary" ? (
                    <CreatingSummaryScreen meetingName={meetingName} onBack={handleBackHome} />
                ) : (
                    <>
                        <HomeScreen
                            onStartRecording={handleStartRecording}
                            onUploadRecording={handleUploadRecording}
                            libraryItems={libraryItems}
                            onLibraryOpen={handleRefreshLibrary}
                            onDeleteRecording={handleDeleteRecording}
                            onUpdateRecording={handleUpdateRecording}
                            settings={settings}
                            onSettingsChange={handleSettingsChange}
                            openDetailRecordId={openDetailRecordId}
                            onDetailOpened={() => setOpenDetailRecordId(null)}
                            openLibraryRequestId={openLibraryRequestId}
                            uploadSuccessRecordId={uploadSuccessRecordId}
                        />
                        <AudioFileScreen
                            meetingName={meetingName}
                            onBack={handleBackHome}
                            visible={showUploadModal}
                            onSaveRecording={handleSaveRecording}
                            onUploadStart={handleUploadStart}
                            onUploadComplete={handleUploadComplete}
                            maxFileSizeMb={settings.maxFileSize}
                        />
                    </>
                )}
                <Modal animationType="fade" transparent visible={uploadInProgress}>
                    <View style={styles.uploadOverlay}>
                        <View style={styles.uploadCard}>
                            <Text style={styles.uploadTitle}>Upload in progress</Text>
                            <View style={styles.uploadProgressTrack}>
                                <Animated.View
                                    style={[
                                        styles.uploadProgressFill,
                                        { width: uploadProgressWidth }
                                    ]}
                                />
                            </View>
                            <Text style={styles.uploadSubtitle}>Uploading audio file…</Text>
                        </View>
                    </View>
                </Modal>
            </SafeAreaView>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F8FAFC"
    },
    uploadOverlay: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 24,
        backgroundColor: "rgba(15, 23, 42, 0.35)"
    },
    uploadCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        paddingVertical: 24,
        paddingHorizontal: 26,
        alignItems: "center",
        shadowColor: "#0F172A",
        shadowOpacity: 0.16,
        shadowOffset: { width: 0, height: 8 },
        shadowRadius: 16,
        elevation: 10
    },
    uploadTitle: {
        marginTop: 10,
        fontSize: 16,
        fontWeight: "700",
        color: "#1E293B"
    },
    uploadProgressTrack: {
        width: 220,
        height: 8,
        borderRadius: 999,
        backgroundColor: "#E2E8F0",
        overflow: "hidden",
        marginTop: 12
    },
    uploadProgressFill: {
        height: "100%",
        borderRadius: 999,
        backgroundColor: "#1D71B8"
    },
    uploadSubtitle: {
        marginTop: 4,
        fontSize: 13,
        color: "#64748B",
        textAlign: "center"
    }
});
