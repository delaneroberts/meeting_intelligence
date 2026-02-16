import React, { useMemo, useState } from "react";
import {
    InteractionManager,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import RNFS from "react-native-fs";
import MeetingNameScreen from "./MeetingNameScreen";

export default function AudioFileScreen({
    meetingName,
    onBack,
    onSaveRecording,
    onUploadStart,
    onUploadComplete,
    maxFileSizeMb,
    visible = true
}) {
    const [isPicking, setIsPicking] = useState(false);
    const [pickedFile, setPickedFile] = useState(null);
    const [showNamePrompt, setShowNamePrompt] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [selectedAt, setSelectedAt] = useState(null);

    const fileBaseName = useMemo(() => {
        if (!pickedFile?.name) {
            return "";
        }
        const withoutExtension = pickedFile.name.replace(/\.[^/.]+$/, "").trim();
        return withoutExtension;
    }, [pickedFile]);

    const defaultName = useMemo(() => {
        const baseName = fileBaseName || "Untitled";
        if (!selectedAt) {
            return baseName;
        }
        const pad = (value) => value.toString().padStart(2, "0");
        const month = pad(selectedAt.getMonth() + 1);
        const day = pad(selectedAt.getDate());
        const year = String(selectedAt.getFullYear()).slice(-2);
        const hour = pad(selectedAt.getHours());
        const minute = pad(selectedAt.getMinutes());
        return `${baseName} ${month}/${day}/${year} ${hour}:${minute}`;
    }, [fileBaseName, selectedAt]);

    const maxFileSizeBytes = useMemo(() => {
        const parsed = Number(maxFileSizeMb);
        if (!Number.isFinite(parsed) || parsed <= 0) {
            return null;
        }
        return parsed * 1024 * 1024;
    }, [maxFileSizeMb]);

    const handlePickFile = async () => {
        if (isPicking) {
            return;
        }
        setIsPicking(true);
        setErrorMessage("");
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ["audio/*"],
                copyToCacheDirectory: true,
                multiple: false
            });
            if (result.canceled) {
                return;
            }
            const file = result.assets?.[0];
            if (!file?.uri) {
                setErrorMessage("Unable to read the selected file.");
                return;
            }
            if (maxFileSizeBytes) {
                const info = await FileSystem.getInfoAsync(file.uri);
                if (info.exists && typeof info.size === "number" && info.size > maxFileSizeBytes) {
                    setErrorMessage(
                        `File exceeds the ${Math.round(maxFileSizeBytes / (1024 * 1024))} MB limit.`
                    );
                    return;
                }
            }
            setPickedFile(file);
            setSelectedAt(new Date());
            setShowNamePrompt(true);
        } catch (error) {
            setErrorMessage("Unable to open the file picker.");
        } finally {
            setIsPicking(false);
        }
    };

    const persistPickedFile = async (name) => {
        if (!pickedFile?.uri) {
            return null;
        }
        const fileInfo = await FileSystem.getInfoAsync(pickedFile.uri);
        if (!fileInfo.exists) {
            throw new Error("Selected file missing");
        }
        const safeName = name.replace(/[^a-z0-9-_]/gi, "_");
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const extensionFromName = pickedFile.name?.split(".").pop();
        const extensionFromUri = pickedFile.uri.split(".").pop();
        const extension = extensionFromName || extensionFromUri || "m4a";
        const targetFileName = `${safeName}_${timestamp}.${extension}`;

        const normalizePath = (uri) => decodeURI(uri.replace(/^file:\/\//, ""));
        const sourcePath = normalizePath(pickedFile.uri);

        if (RNFS?.DocumentDirectoryPath) {
            const targetDir = `${RNFS.DocumentDirectoryPath}/recordings`;
            await RNFS.mkdir(targetDir);
            const targetPath = `${targetDir}/${targetFileName}`;
            await RNFS.copyFile(sourcePath, targetPath);
            return `file://${targetPath}`;
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
        const targetUri = `${directory}/${targetFileName}`;
        await FileSystem.copyAsync({ from: pickedFile.uri, to: targetUri });
        return targetUri;
    };

    const handleSaveName = async (name) => {
        if (!name.trim()) {
            return;
        }
        setShowNamePrompt(false);
        onUploadStart?.();
        let didComplete = false;
        try {
            await new Promise((resolve) => InteractionManager.runAfterInteractions(resolve));
            await new Promise((resolve) => requestAnimationFrame(resolve));
            await new Promise((resolve) => setTimeout(resolve, 300));
            const targetUri = await persistPickedFile(name.trim());
            if (!targetUri) {
                setErrorMessage("Unable to save the selected file.");
                throw new Error("Upload failed");
            }
            const newRecord = {
                id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
                meetingName: name.trim() || "Untitled",
                recordingUri: targetUri,
                createdAt: new Date().toISOString(),
                status: "saved",
                transcript: "",
                summary: ""
            };
            onSaveRecording?.(newRecord);
            onUploadComplete?.(newRecord.id);
            didComplete = true;
            setPickedFile(null);
            setSelectedAt(null);
        } catch (error) {
            const detail = error?.message ? ` (${error.message})` : "";
            setErrorMessage(`Unable to save to library${detail}.`);
            onUploadComplete?.(null);
            didComplete = true;
        } finally {
            if (!didComplete) {
                onUploadComplete?.(null);
            }
        }
    };

    const handleCloseNamePrompt = () => {
        setShowNamePrompt(false);
        setPickedFile(null);
        setSelectedAt(null);
    };

    return (
        <Modal animationType="slide" transparent visible={visible}>
            <View style={styles.overlay}>
                <Pressable style={styles.backdrop} onPress={onBack} />
                <View style={styles.modalCard}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.headerTitle}>Upload Recording</Text>
                        <TouchableOpacity onPress={onBack} style={styles.closeButton}>
                            <Ionicons name="close" size={20} color="#2D3748" />
                        </TouchableOpacity>
                    </View>
                    <View style={styles.cardContent}>
                        <TouchableOpacity
                            style={styles.uploadIconButton}
                            onPress={handlePickFile}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="cloud-upload" size={36} color="#1D71B8" />
                        </TouchableOpacity>
                        <Text style={styles.title}>Select an audio file</Text>
                        <Text style={styles.subtitle}>
                            Upload a recording for {meetingName || "your meeting"}.
                        </Text>
                        <Text style={styles.allowedFiles}>
                            Allowed files: MP3, WAV, M4A.
                        </Text>
                        {errorMessage ? (
                            <Text style={styles.errorText}>{errorMessage}</Text>
                        ) : null}
                    </View>
                </View>
                {showNamePrompt && (
                    <View style={styles.namePromptOverlay}>
                        <MeetingNameScreen
                            onClose={handleCloseNamePrompt}
                            onStart={handleSaveName}
                            initialValue={defaultName}
                            buttonLabel="Save to Library"
                        />
                    </View>
                )}
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: "center",
        paddingHorizontal: 20,
        backgroundColor: "rgba(15, 23, 42, 0.45)"
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject
    },
    modalCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 24,
        paddingHorizontal: 24,
        paddingVertical: 20,
        shadowColor: "#0F172A",
        shadowOpacity: 0.18,
        shadowOffset: { width: 0, height: 10 },
        shadowRadius: 20,
        elevation: 12
    },
    modalHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 20
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: "700",
        color: "#2D3748"
    },
    closeButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#F1F5F9"
    },
    cardContent: {
        alignItems: "center",
        paddingBottom: 8
    },
    uploadIconButton: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#E6F0FB"
    },
    title: {
        marginTop: 16,
        fontSize: 18,
        fontWeight: "700",
        color: "#2D3748"
    },
    subtitle: {
        marginTop: 8,
        fontSize: 14,
        color: "#64748B",
        textAlign: "center"
    },
    allowedFiles: {
        marginTop: 12,
        fontSize: 13,
        color: "#475569",
        textAlign: "center"
    },
    errorText: {
        marginTop: 12,
        fontSize: 12,
        color: "#DC2626",
        textAlign: "center"
    },
    namePromptOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(15, 23, 42, 0.35)"
    }
});
