import "react-native-gesture-handler";
import React, { useEffect, useState } from "react";
import { SafeAreaView, StyleSheet } from "react-native";
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
                        />
                        <AudioFileScreen
                            meetingName={meetingName}
                            onBack={handleBackHome}
                            visible={showUploadModal}
                        />
                    </>
                )}
            </SafeAreaView>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F8FAFC"
    }
});
