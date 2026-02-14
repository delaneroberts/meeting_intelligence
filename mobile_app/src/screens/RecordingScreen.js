import React, { useEffect, useMemo, useRef, useState } from "react";
import { Modal, View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import * as Speech from "expo-speech";

const QUALITY_PRESETS = {
    Standard: Audio.RecordingOptionsPresets.LOW_QUALITY,
    High: Audio.RecordingOptionsPresets.HIGH_QUALITY,
    Lossless: Audio.RecordingOptionsPresets.HIGH_QUALITY
};

const formatDuration = (durationMillis) => {
    const totalSeconds = Math.floor(durationMillis / 1000);
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    return `${minutes}:${seconds}`;
};

export default function RecordingScreen({
    meetingName = "New Meeting",
    onBack,
    settings,
    onSaveRecording,
    onTranscribeAndSummarize
}) {
    const recordingRef = useRef(null);
    const toastTimeoutRef = useRef(null);
    const [elapsedMillis, setElapsedMillis] = useState(0);
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [savedUri, setSavedUri] = useState(null);
    const [errorMessage, setErrorMessage] = useState("");
    const [toastMessage, setToastMessage] = useState("");
    const [isToastVisible, setIsToastVisible] = useState(false);
    const [pendingUri, setPendingUri] = useState(null);
    const [isSaveModalVisible, setIsSaveModalVisible] = useState(false);
    const [isProcessingChoice, setIsProcessingChoice] = useState(false);
    const [isConsentVisible, setIsConsentVisible] = useState(true);
    const [hasConsent, setHasConsent] = useState(false);

    const recordingOptions = useMemo(() => {
        const preset = QUALITY_PRESETS[settings?.recordingQuality || "Standard"];
        return {
            ...preset,
            android: {
                ...preset.android,
                maxFileSize: 0
            },
            ios: {
                ...preset.ios,
                maxFileSize: 0
            },
            web: preset.web,
            progressUpdateIntervalMillis: 500
        };
    }, [settings?.recordingQuality]);

    useEffect(() => {
        if (!hasConsent) {
            return;
        }
        const startRecording = async () => {
            try {
                const permissionResponse = await Audio.requestPermissionsAsync();
                const permissionStatus = await Audio.getPermissionsAsync();
                const isGranted =
                    permissionResponse.granted === true ||
                    permissionResponse.status === "granted" ||
                    permissionStatus.granted === true ||
                    permissionStatus.status === "granted";
                if (!isGranted) {
                    setErrorMessage("Microphone permission is required to record.");
                    return;
                }
                await Audio.setAudioModeAsync({
                    allowsRecordingIOS: true,
                    staysActiveInBackground: settings?.backgroundRecording ?? false,
                    playsInSilentModeIOS: true
                });
                if (settings?.announceRecordingInProgress) {
                    Speech.speak("Recording started.");
                }
                const { recording } = await Audio.Recording.createAsync(
                    recordingOptions,
                    (statusUpdate) => {
                        if (statusUpdate.isRecording) {
                            setIsRecording(true);
                            setIsPaused(false);
                            setElapsedMillis(statusUpdate.durationMillis || 0);
                        } else if (statusUpdate.isDoneRecording) {
                            setIsRecording(false);
                        }
                    }
                );
                recordingRef.current = recording;
                setSavedUri(null);
                setErrorMessage("");
            } catch (error) {
                setErrorMessage("Unable to start recording.");
            }
        };

        startRecording();

        return () => {
            const recording = recordingRef.current;
            if (recording) {
                recording.stopAndUnloadAsync().catch(() => undefined);
            }
            recordingRef.current = null;
        };
    }, [
        hasConsent,
        recordingOptions,
        settings?.announceRecordingInProgress,
        settings?.backgroundRecording
    ]);

    useEffect(() => {
        return () => {
            if (toastTimeoutRef.current) {
                clearTimeout(toastTimeoutRef.current);
            }
        };
    }, []);

    const showToast = (message) => {
        setToastMessage(message);
        setIsToastVisible(true);
        if (toastTimeoutRef.current) {
            clearTimeout(toastTimeoutRef.current);
        }
        toastTimeoutRef.current = setTimeout(() => {
            setIsToastVisible(false);
        }, 2400);
    };

    const handleTogglePause = async () => {
        const recording = recordingRef.current;
        if (!recording) {
            return;
        }
        if (isPaused) {
            await recording.startAsync();
            setIsPaused(false);
        } else {
            await recording.pauseAsync();
            setIsPaused(true);
        }
    };

    const persistRecording = async () => {
        if (!pendingUri) {
            return null;
        }
        const fileInfo = await FileSystem.getInfoAsync(pendingUri);
        if (!fileInfo.exists) {
            throw new Error("Recording file missing");
        }
        const baseDirectory = FileSystem.documentDirectory || FileSystem.cacheDirectory;
        if (!baseDirectory) {
            throw new Error("Storage directory unavailable");
        }
        const directory = `${baseDirectory}recordings`;
        const directoryInfo = await FileSystem.getInfoAsync(directory);
        if (!directoryInfo.exists) {
            await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
        }
        const safeName = meetingName.replace(/[^a-z0-9-_]/gi, "_");
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const targetUri = `${directory}/${safeName}_${timestamp}.m4a`;
        try {
            await FileSystem.moveAsync({ from: pendingUri, to: targetUri });
        } catch (error) {
            await FileSystem.copyAsync({ from: pendingUri, to: targetUri });
            await FileSystem.deleteAsync(pendingUri, { idempotent: true });
        }
        setSavedUri(targetUri);
        setPendingUri(null);
        return targetUri;
    };

    const handleSaveChoice = async (choice) => {
        if (!pendingUri || isProcessingChoice) {
            return;
        }
        setIsProcessingChoice(true);
        try {
            if (choice === "discard") {
                await FileSystem.deleteAsync(pendingUri, { idempotent: true });
                setPendingUri(null);
                setSavedUri(null);
                showToast("Recording discarded.");
            } else {
                const targetUri = await persistRecording();
                if (targetUri) {
                    showToast("Recording saved to your device.");
                    const newRecord = {
                        id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
                        meetingName: meetingName || "Untitled",
                        recordingUri: targetUri,
                        createdAt: new Date().toISOString(),
                        status: choice === "transcribe" ? "transcribing" : "saved",
                        transcript: "",
                        summary: ""
                    };
                    onSaveRecording?.(newRecord);
                }
                if (choice === "transcribe" && targetUri) {
                    onTranscribeAndSummarize?.(targetUri);
                }
            }
        } catch (error) {
            const detail = error?.message ? ` (${error.message})` : "";
            setErrorMessage(`Unable to save to library${detail}.`);
        } finally {
            setIsProcessingChoice(false);
            setIsSaveModalVisible(false);
        }
    };

    const handleStop = async () => {
        const recording = recordingRef.current;
        if (!recording) {
            return;
        }
        try {
            await recording.stopAndUnloadAsync();
            const uri = recording.getURI();
            if (!uri) {
                return;
            }
            setPendingUri(uri);
            setIsSaveModalVisible(true);
            if (settings?.announceRecordingStopped) {
                Speech.speak("Recording stopped.");
            }
        } catch (error) {
            setErrorMessage("Unable to save recording.");
        } finally {
            recordingRef.current = null;
            setIsRecording(false);
        }
    };

    const handleBack = async () => {
        if (isRecording || isPaused) {
            await handleStop();
            return;
        }
        if (isSaveModalVisible) {
            return;
        }
        onBack?.();
    };

    return (
        <View style={styles.container}>
            {isToastVisible ? (
                <View style={styles.toast}>
                    <Text style={styles.toastText}>{toastMessage}</Text>
                </View>
            ) : null}
            <Modal visible={isConsentVisible} animationType="fade" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Recording consent</Text>
                        <Text style={styles.modalSubtitle}>
                            By recording, you confirm you have permission from all participants.
                        </Text>
                        <TouchableOpacity
                            style={styles.modalPrimaryButton}
                            activeOpacity={0.85}
                            onPress={() => {
                                setHasConsent(true);
                                setIsConsentVisible(false);
                            }}
                        >
                            <Text style={styles.modalPrimaryText}>I have consent</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.modalSecondaryButton}
                            activeOpacity={0.85}
                            onPress={() => {
                                setIsConsentVisible(false);
                                onBack?.();
                            }}
                        >
                            <Text style={styles.modalSecondaryText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
            <Modal visible={isSaveModalVisible} animationType="fade" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Save recording?</Text>
                        <Text style={styles.modalSubtitle}>
                            Choose what you want to do with this recording.
                        </Text>
                        <TouchableOpacity
                            style={styles.modalPrimaryButton}
                            activeOpacity={0.85}
                            onPress={() => handleSaveChoice("save")}
                            disabled={isProcessingChoice}
                        >
                            <Text style={styles.modalPrimaryText}>Save to Library</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.modalSecondaryButton}
                            activeOpacity={0.85}
                            onPress={() => handleSaveChoice("transcribe")}
                            disabled={isProcessingChoice}
                        >
                            <Text style={styles.modalSecondaryText}>Save + Transcribe & Summarize</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.modalDangerButton}
                            activeOpacity={0.85}
                            onPress={() => handleSaveChoice("discard")}
                            disabled={isProcessingChoice}
                        >
                            <Text style={styles.modalDangerText}>Discard recording</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
            <View style={styles.header}>
                <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={22} color="#2D3748" />
                </TouchableOpacity>
                <View style={styles.headerText}>
                    <Text style={styles.headerTitle}>Recording</Text>
                    <Text style={styles.headerSubtitle}>{meetingName}</Text>
                </View>
                <View style={styles.headerSpacer} />
            </View>

            <View style={styles.timerBlock}>
                <Text style={styles.timerLabel}>Elapsed</Text>
                <Text style={styles.timerValue}>{formatDuration(elapsedMillis)}</Text>
            </View>

            <View style={styles.waveContainer}>
                <View style={styles.waveOuter}>
                    <View style={styles.waveMid}>
                        <View style={styles.waveInner}>
                            <Ionicons name="mic" size={28} color="#FFFFFF" />
                        </View>
                    </View>
                </View>
            </View>

            <View style={styles.statusCard}>
                <Text style={styles.statusTitle}>
                    {savedUri
                        ? "Recording saved"
                        : errorMessage
                            ? "Recording error"
                            : isPaused
                                ? "Recording paused"
                                : "Recording in progress"}
                </Text>
                <Text style={styles.statusSubtitle}>
                    {savedUri
                        ? "Saved to your device."
                        : errorMessage
                            ? errorMessage
                            : "Speak naturally. We will capture key points."}
                </Text>
            </View>
            <Text style={styles.localOnlyText}>
                Recordings stay on your device unless you choose to export them.
            </Text>

            <View style={styles.controls}>
                <TouchableOpacity
                    style={styles.secondaryControl}
                    activeOpacity={0.85}
                    onPress={handleTogglePause}
                    disabled={!isRecording && !isPaused}
                >
                    <Ionicons name={isPaused ? "play" : "pause"} size={20} color="#1D71B8" />
                    <Text style={styles.secondaryText}>{isPaused ? "Resume" : "Pause"}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.primaryControl}
                    activeOpacity={0.85}
                    onPress={handleStop}
                    disabled={!isRecording && !isPaused}
                >
                    <Ionicons name="stop" size={20} color="#FFFFFF" />
                    <Text style={styles.primaryText}>Stop</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F4F6FA",
        paddingHorizontal: 24,
        paddingTop: 54
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 28
    },
    backButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#FFFFFF",
        shadowColor: "#000",
        shadowOpacity: 0.06,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 10,
        elevation: 4
    },
    headerText: {
        flex: 1,
        alignItems: "center"
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: "700",
        color: "#2D3748"
    },
    headerSubtitle: {
        fontSize: 14,
        color: "#7A899C",
        marginTop: 2
    },
    headerSpacer: {
        width: 36
    },
    timerBlock: {
        alignItems: "center",
        marginBottom: 26
    },
    timerLabel: {
        fontSize: 14,
        color: "#94A3B8"
    },
    timerValue: {
        fontSize: 34,
        fontWeight: "700",
        color: "#1D71B8",
        marginTop: 6
    },
    waveContainer: {
        alignItems: "center",
        marginBottom: 26
    },
    waveOuter: {
        width: 180,
        height: 180,
        borderRadius: 90,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(107, 182, 229, 0.2)"
    },
    waveMid: {
        width: 120,
        height: 120,
        borderRadius: 60,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(107, 182, 229, 0.35)"
    },
    waveInner: {
        width: 72,
        height: 72,
        borderRadius: 36,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#1D71B8"
    },
    statusCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        paddingVertical: 16,
        paddingHorizontal: 20,
        shadowColor: "#000",
        shadowOpacity: 0.06,
        shadowOffset: { width: 0, height: 6 },
        shadowRadius: 12,
        elevation: 4,
        marginBottom: 28
    },
    statusTitle: {
        fontSize: 16,
        fontWeight: "600",
        color: "#2D3748",
        marginBottom: 4
    },
    statusSubtitle: {
        fontSize: 13,
        color: "#7A899C",
        lineHeight: 18
    },
    controls: {
        flexDirection: "row",
        justifyContent: "center",
        gap: 16
    },
    secondaryControl: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingVertical: 14,
        paddingHorizontal: 22,
        borderRadius: 18,
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#CFE0F5"
    },
    secondaryText: {
        fontSize: 15,
        fontWeight: "600",
        color: "#1D71B8"
    },
    primaryControl: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 18,
        backgroundColor: "#F04F4F"
    },
    primaryText: {
        fontSize: 15,
        fontWeight: "600",
        color: "#FFFFFF"
    },
    toast: {
        position: "absolute",
        bottom: 32,
        left: 24,
        right: 24,
        backgroundColor: "#1D71B8",
        paddingVertical: 12,
        paddingHorizontal: 18,
        borderRadius: 18,
        alignItems: "center",
        shadowColor: "#000",
        shadowOpacity: 0.12,
        shadowOffset: { width: 0, height: 6 },
        shadowRadius: 12,
        elevation: 5
    },
    toastText: {
        color: "#FFFFFF",
        fontSize: 14,
        fontWeight: "600"
    },
    localOnlyText: {
        fontSize: 12,
        color: "#64748B",
        textAlign: "center",
        marginBottom: 24
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(15, 23, 42, 0.45)",
        justifyContent: "center",
        alignItems: "center",
        padding: 24
    },
    modalCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        padding: 24,
        width: "100%",
        maxWidth: 360,
        shadowColor: "#000",
        shadowOpacity: 0.12,
        shadowOffset: { width: 0, height: 8 },
        shadowRadius: 20,
        elevation: 6
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: "700",
        color: "#0F172A",
        marginBottom: 6,
        textAlign: "center"
    },
    modalSubtitle: {
        fontSize: 14,
        color: "#64748B",
        textAlign: "center",
        marginBottom: 20
    },
    modalPrimaryButton: {
        backgroundColor: "#1D71B8",
        borderRadius: 14,
        paddingVertical: 12,
        alignItems: "center",
        marginBottom: 12
    },
    modalPrimaryText: {
        color: "#FFFFFF",
        fontWeight: "700",
        fontSize: 15
    },
    modalSecondaryButton: {
        backgroundColor: "#E2E8F0",
        borderRadius: 14,
        paddingVertical: 12,
        alignItems: "center",
        marginBottom: 12
    },
    modalSecondaryText: {
        color: "#1E293B",
        fontWeight: "600",
        fontSize: 14
    },
    modalDangerButton: {
        backgroundColor: "#FEE2E2",
        borderRadius: 14,
        paddingVertical: 12,
        alignItems: "center"
    },
    modalDangerText: {
        color: "#B91C1C",
        fontWeight: "700",
        fontSize: 14
    }
});
