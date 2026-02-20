import React, { useMemo, useState } from "react";
import {
    ActivityIndicator,
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
// Use the legacy filesystem API to avoid the new File/Directory migration for now.
// This matches the existing getInfoAsync/copyAsync usage in this app.
import * as FileSystem from "expo-file-system/legacy";
import Constants from "expo-constants";
import appConfig from "../config/appConfig";

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
    const [isSaving, setIsSaving] = useState(false);
    const [pickedFile, setPickedFile] = useState(null);
    const [errorMessage, setErrorMessage] = useState("");
    const [selectedAt, setSelectedAt] = useState(null);

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
            console.log('[AudioFileScreen] Opening document picker');
            const startPickAt = Date.now();
            const result = await DocumentPicker.getDocumentAsync({
                type: ["audio/*"],
                copyToCacheDirectory: true,
                multiple: false
            });

            console.log('[AudioFileScreen] DocumentPicker returned in', Date.now() - startPickAt, 'ms:', result);

            // Expo DocumentPicker returns { type: 'cancel'|'success', uri, name, size }
            // Older/newer apis may use `canceled` or `assets`. Handle both.
            if (result == null) {
                setErrorMessage("Unable to open the file picker.");
                return;
            }
            if (result.canceled === true || result.type === 'cancel') {
                // user cancelled
                return;
            }

            // Normalize result to a file-like object with .uri and .name
            let file = null;
            if (Array.isArray(result.assets) && result.assets.length) {
                file = result.assets[0];
            } else if (result.uri) {
                file = { uri: result.uri, name: result.name || result.uri.split('/').pop(), size: result.size };
            }

            if (!file || !file.uri) {
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
            const baseName = file.name ? file.name.replace(/\.[^/.]+$/, "").trim() : "";
            const defaultName = baseName || `Recording ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
            const displayName = baseName || `Recording ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
            await savePickedFileImmediate(file, displayName);
        } catch (error) {
            // Log the error so Metro / device logs show the native exception
            console.error('[AudioFileScreen] DocumentPicker error:', error);
            setErrorMessage("Unable to open the file picker.");
        } finally {
            setIsPicking(false);
        }
    };

    const sendDebugLog = async (level, message, meta = {}) => {
        try {
            const url = `${appConfig.apiBaseUrl}/debug/log`;
            // Fire-and-forget, don't let this block UI
            fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ level, message, meta }),
            }).catch((e) => {
                // ignore network errors; still print locally
                console.warn('[AudioFileScreen] sendDebugLog failed:', e?.message || e);
            });
        } catch (e) {
            // ignore
        }
    };

    const persistPickedFile = async (name, fileOverride = null) => {
        const file = fileOverride || pickedFile;
        if (!file?.uri) {
            return null;
        }
        const fileInfo = await FileSystem.getInfoAsync(file.uri);
        if (!fileInfo.exists) {
            throw new Error("Selected file missing");
        }
        const safeName = name.replace(/[^a-z0-9-_]/gi, "_");
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const extensionFromName = file.name?.split(".").pop();
        const extensionFromUri = file.uri.split(".").pop();
        const extension = extensionFromName || extensionFromUri || "m4a";
        const targetFileName = `${safeName}_${timestamp}.${extension}`;

        const normalizePath = (uri) => decodeURI(uri.replace(/^file:\/\//, ""));
        const sourcePath = normalizePath(file.uri);

        // If running inside Expo Go (appOwnership === 'expo'), avoid requiring native-only modules.
        // This prevents the "native module doesn't exist" crash in Expo Go.
        let RNFS = null;
        if (Constants?.appOwnership !== "expo") {
            try {
                // eslint-disable-next-line global-require, import/no-extraneous-dependencies
                RNFS = require("react-native-fs");
            } catch (err) {
                RNFS = null;
            }
        }

        if (RNFS) {
            try {
                console.log('[AudioFileScreen] RNFS available, attempting native copy');
                sendDebugLog('info', 'RNFS available, attempting native copy');
                if (RNFS.DocumentDirectoryPath) {
                    const targetDir = `${RNFS.DocumentDirectoryPath}/recordings`;
                    // ensure targetDir exists
                    try {
                        console.log('[AudioFileScreen] RNFS.mkdir targetDir=', targetDir);
                        sendDebugLog('info', 'RNFS.mkdir start', { targetDir });
                        const mkdirStart = Date.now();
                        await RNFS.mkdir(targetDir);
                        console.log('[AudioFileScreen] RNFS.mkdir done in', Date.now() - mkdirStart, 'ms');
                        sendDebugLog('info', 'RNFS.mkdir done', { durationMs: Date.now() - mkdirStart, targetDir });
                    } catch (e) {
                        // ignore mkdir errors if it already exists
                        console.log('[AudioFileScreen] RNFS.mkdir error (ignored):', e?.message || e);
                        sendDebugLog('warn', 'RNFS.mkdir error (ignored)', { message: e?.message || e });
                    }
                    const targetPath = `${targetDir}/${targetFileName}`;
                    try {
                        console.log('[AudioFileScreen] RNFS.copyFile from=', sourcePath, 'to=', targetPath);
                        sendDebugLog('info', 'RNFS.copyFile start', { sourcePath, targetPath });
                        const copyStart = Date.now();
                        await RNFS.copyFile(sourcePath, targetPath);
                        console.log('[AudioFileScreen] RNFS.copyFile done in', Date.now() - copyStart, 'ms');
                        sendDebugLog('info', 'RNFS.copyFile done', { durationMs: Date.now() - copyStart, targetPath });
                        return `file://${targetPath}`;
                    } catch (e) {
                        console.log('[AudioFileScreen] RNFS.copyFile failed:', e?.message || e);
                        sendDebugLog('error', 'RNFS.copyFile failed', { message: e?.message || e });
                        // fall back to expo-file-system below
                        RNFS = null;
                    }
                }
            } catch (e) {
                // If any RNFS operation fails, fall back to expo-file-system below.
                console.log('[AudioFileScreen] RNFS operation error, falling back:', e?.message || e);
                sendDebugLog('error', 'RNFS operation error, falling back', { message: e?.message || e });
                RNFS = null;
            }
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
        await FileSystem.copyAsync({ from: file.uri, to: targetUri });
        return targetUri;
    };

    const savePickedFileImmediate = async (file, defaultName) => {
        setErrorMessage("");
        onUploadStart?.();
        setIsSaving(true);
        let didComplete = false;
        try {
            await new Promise((resolve) => requestAnimationFrame(resolve));
            await new Promise((resolve) => setTimeout(resolve, 100));
            await new Promise((resolve) => InteractionManager.runAfterInteractions(resolve));
            await new Promise((resolve) => setTimeout(resolve, 200));

            const targetUri = await persistPickedFile(defaultName.trim() || "Recording", file);
            if (!targetUri) {
                setErrorMessage("Unable to save the selected file.");
                throw new Error("Upload failed");
            }
            const newRecord = {
                id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
                meetingName: defaultName.trim() || "Recording",
                recordingUri: targetUri,
                createdAt: new Date().toISOString(),
                status: "saved",
                transcript: "",
                summary: ""
            };
            await new Promise((resolve) => requestAnimationFrame(resolve));
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
            setIsSaving(false);
            if (!didComplete) {
                onUploadComplete?.(null);
            }
        }
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
                {isSaving && (
                    <View style={styles.savingOverlay} pointerEvents="box-only">
                        <View style={styles.savingCard}>
                            <ActivityIndicator size="large" color="#1D71B8" />
                            <Text style={styles.savingText}>Saving to library…</Text>
                        </View>
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
    },
    savingOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(15, 23, 42, 0.5)"
    },
    savingCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        paddingVertical: 24,
        paddingHorizontal: 32,
        alignItems: "center",
        minWidth: 200
    },
    savingText: {
        marginTop: 12,
        fontSize: 16,
        fontWeight: "600",
        color: "#2D3748"
    }
});
