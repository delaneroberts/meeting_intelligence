import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    Modal,
    Pressable,
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    TextInput,
    Share,
    ScrollView,
    Animated
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Constants from "expo-constants";
import { getBaseUrl, processAudio, getProcessStatus, translateContent } from "../api/client";
import MeetingControls from "../components/MeetingControls";
import UploadZone from "../components/UploadZone";
// Use the legacy filesystem API so existing getInfoAsync/uploadAsync calls keep working
// without migrating to the new File/Directory classes right now.
import * as FileSystem from "expo-file-system/legacy";
import { InteractionManager } from 'react-native';
import { Audio } from "expo-av";
import * as Clipboard from "expo-clipboard";
import {
    GestureHandlerRootView,
    State,
    Swipeable,
    TapGestureHandler
} from "react-native-gesture-handler";
import MeetingNameScreen from "./MeetingNameScreen";
import appConfig from "../config/appConfig";
import SettingsScreen from "./SettingsScreen";
import CreatingSummaryScreen from "./CreatingSummaryScreen";

const TRANSLATE_LANGUAGES = [
    "Afrikaans",
    "Albanian",
    "Amharic",
    "Arabic",
    "Armenian",
    "Assamese",
    "Azerbaijani",
    "Bashkir",
    "Basque",
    "Belarusian",
    "Bengali",
    "Bosnian",
    "Breton",
    "Bulgarian",
    "Burmese",
    "Castilian",
    "Catalan",
    "Chinese",
    "Croatian",
    "Czech",
    "Danish",
    "Dutch",
    "English",
    "Estonian",
    "Faroese",
    "Finnish",
    "French",
    "Galician",
    "Georgian",
    "German",
    "Greek",
    "Gujarati",
    "Haitian Creole",
    "Hausa",
    "Hawaiian",
    "Hebrew",
    "Hindi",
    "Hungarian",
    "Icelandic",
    "Indonesian",
    "Italian",
    "Japanese",
    "Javanese",
    "Kannada",
    "Kazakh",
    "Khmer",
    "Korean",
    "Lao",
    "Latin",
    "Latvian",
    "Lithuanian",
    "Luxembourgish",
    "Macedonian",
    "Malagasy",
    "Malay",
    "Malayalam",
    "Maltese",
    "Maori",
    "Marathi",
    "Mongolian",
    "Nepali",
    "Norwegian",
    "Nynorsk",
    "Occitan",
    "Pashto",
    "Persian",
    "Polish",
    "Portuguese",
    "Punjabi",
    "Romanian",
    "Russian",
    "Sanskrit",
    "Serbian",
    "Shona",
    "Sindhi",
    "Sinhala",
    "Slovak",
    "Slovenian",
    "Somali",
    "Spanish",
    "Sundanese",
    "Swahili",
    "Swedish",
    "Tagalog",
    "Tajik",
    "Tamil",
    "Tatar",
    "Telugu",
    "Thai",
    "Tibetan",
    "Turkish",
    "Turkmen",
    "Ukrainian",
    "Urdu",
    "Uzbek",
    "Vietnamese",
    "Welsh",
    "Yiddish",
    "Yoruba"
];

export default function HomeScreen({
    onStartRecording,
    onUploadRecording,
    libraryItems = [],
    onLibraryOpen,
    onDeleteRecording,
    onUpdateRecording,
    settings,
    onSettingsChange,
    openDetailRecordId,
    onDetailOpened,
    onGlobalError,
    openLibraryRequestId,
    uploadSuccessRecordId
}) {
    const [showMeetingName, setShowMeetingName] = useState(false);
    const [showAgendaUpload, setShowAgendaUpload] = useState(false);
    const [showMaterialsUpload, setShowMaterialsUpload] = useState(false);
    const [showLibraryModal, setShowLibraryModal] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [meetingId, setMeetingId] = useState("");
    const [modalDefaultName, setModalDefaultName] = useState("");
    const [modalButtonLabel, setModalButtonLabel] = useState("Start Recording");
    const [pendingAction, setPendingAction] = useState(null);
    const [materialsUploadCount] = useState(0);
    const [selectedLibraryItem, setSelectedLibraryItem] = useState(null);
    const [showLibraryDetail, setShowLibraryDetail] = useState(false);
    const [showUploadToast, setShowUploadToast] = useState(false);
    const [showSummaryProgress, setShowSummaryProgress] = useState(false);
    const [showSummaryLengthModal, setShowSummaryLengthModal] = useState(false);
    const [selectedSummaryLength, setSelectedSummaryLength] = useState("Medium");
    const [showSummaryModal, setShowSummaryModal] = useState(false);
    const [summaryText, setSummaryText] = useState("");
    const [summaryError, setSummaryError] = useState("");
    const [rememberSummaryLength, setRememberSummaryLength] = useState(false);
    const [showSummaryTranslateDropdown, setShowSummaryTranslateDropdown] = useState(false);
    const [summaryTranslatedLanguage, setSummaryTranslatedLanguage] = useState("");
    const [isSummaryTranslating, setIsSummaryTranslating] = useState(false);
    const [showTranscriptProgress, setShowTranscriptProgress] = useState(false);
    const [showTranscriptModal, setShowTranscriptModal] = useState(false);
    const [transcriptText, setTranscriptText] = useState("");
    const [transcriptLanguage, setTranscriptLanguage] = useState("");
    const [transcriptError, setTranscriptError] = useState("");
    const [showTranslateDropdown, setShowTranslateDropdown] = useState(false);
    const [translateError, setTranslateError] = useState("");
    const [isTranslating, setIsTranslating] = useState(false);
    const [translatedLanguage, setTranslatedLanguage] = useState("");
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [transcriptProgressPercent, setTranscriptProgressPercent] = useState(0);
    const [transcriptProgressMessage, setTranscriptProgressMessage] = useState("");
    const [transcriptElapsedSeconds, setTranscriptElapsedSeconds] = useState(0);
    const [showRenameModal, setShowRenameModal] = useState(false);
    const [renameInputValue, setRenameInputValue] = useState("");
    const transcriptAbortRef = useRef(null);
    const transcriptTimeoutRef = useRef(null);
    const transcriptStartTimeRef = useRef(null);
    const swipeableRefs = useRef(new Map());
    const [audioLoading, setAudioLoading] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackPosition, setPlaybackPosition] = useState(0);
    const [playbackDuration, setPlaybackDuration] = useState(0);
    const [sound, setSound] = useState(null);
    const [progressBarWidth, setProgressBarWidth] = useState(0);

    // Debugging: heartbeat and UI-thread pulse (commented out for normal screen)
    // const [heartbeatCount, setHeartbeatCount] = useState(0);
    // const [lastHeartbeatAt, setLastHeartbeatAt] = useState(null);
    // const uiPulse = useRef(new Animated.Value(0)).current;
    // const sendDebugLog = async (level, message, meta = {}) => {
    //     try {
    //         const url = `${appConfig.apiBaseUrl}/debug/log`;
    //         fetch(url, {
    //             method: 'POST',
    //             headers: { 'Content-Type': 'application/json' },
    //             body: JSON.stringify({ level, message, meta }),
    //         }).catch(() => { });
    //     } catch (e) {
    //         // ignore
    //     }
    // };
    // useEffect(() => {
    //     let mounted = true;
    //     let counter = 0;
    //     const interval = setInterval(() => {
    //         if (!mounted) return;
    //         counter += 1;
    //         setHeartbeatCount((c) => c + 1);
    //         setLastHeartbeatAt(new Date().toISOString());
    //         if (counter % 10 === 0) {
    //             sendDebugLog('info', 'heartbeat', { count: counter, ts: new Date().toISOString() });
    //         }
    //     }, 400);
    //     const pulse = Animated.loop(
    //         Animated.sequence([
    //             Animated.timing(uiPulse, { toValue: 1, duration: 350, useNativeDriver: true }),
    //             Animated.timing(uiPulse, { toValue: 0, duration: 350, useNativeDriver: true })
    //         ])
    //     );
    //     pulse.start();
    //     return () => {
    //         mounted = false;
    //         pulse.stop();
    //         clearInterval(interval);
    //     };
    // }, []);

    const materialsLimits = appConfig.meetingMaterials;

    useEffect(() => {
        if (!isTranscribing) return;
        const interval = setInterval(() => {
            if (transcriptStartTimeRef.current) {
                const elapsed = Math.floor((Date.now() - transcriptStartTimeRef.current) / 1000);
                setTranscriptElapsedSeconds(elapsed);
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [isTranscribing]);

    const meetingList = useMemo(() => {
        if (!libraryItems.length) {
            return [];
        }
        return libraryItems.map((item) => {
            const created = item.createdAt ? new Date(item.createdAt) : new Date();
            const pad = (n) => String(n).padStart(2, "0");
            const dateStr = `${created.getFullYear()}-${pad(created.getMonth() + 1)}-${pad(created.getDate())}`;
            const timeStr = `${pad(created.getHours())}:${pad(created.getMinutes())}`;
            const statusLabel =
                item.status === "transcribing"
                    ? "Transcribing…"
                    : item.transcript
                        ? "Transcribed"
                        : "Saved";
            return {
                id: item.id,
                title: item.meetingName || "Untitled",
                date: dateStr,
                time: timeStr,
                statusLabel,
                recordingUri: item.recordingUri,
                summary: item.summary || "",
                summaryLanguage: item.summaryLanguage,
                transcript: item.transcript || "",
                transcriptCreatedAt: item.transcriptCreatedAt,
                transcriptLanguage: item.transcriptLanguage
            };
        });
    }, [libraryItems]);

    useEffect(() => {
        if (!openDetailRecordId) {
            return;
        }
        const targetRecord = libraryItems.find((item) => item.id === openDetailRecordId);
        if (!targetRecord) {
            return;
        }
        setSelectedLibraryItem(targetRecord);
        setShowLibraryDetail(true);
        setShowLibraryModal(false);
        setShowSettingsModal(false);
        onDetailOpened?.();

        const shouldAutoTranscribe =
            (settings?.autoTranscribe || settings?.autoSummary) &&
            targetRecord.recordingUri &&
            !targetRecord.transcript;
        if (shouldAutoTranscribe) {
            setShowLibraryDetail(false);
            setShowTranscriptProgress(true);
            setShowTranslateDropdown(false);
            setTranscriptError("");
            setTranscriptText("");
            setTranscriptLanguage("");
            transcribeRecording(targetRecord);
        }
    }, [openDetailRecordId, libraryItems, onDetailOpened, settings?.autoTranscribe, settings?.autoSummary]);

    useEffect(() => {
        if (!openLibraryRequestId) {
            return;
        }
        onLibraryOpen?.();
        setShowLibraryModal(true);
        setShowLibraryDetail(false);
        setShowSettingsModal(false);
    }, [openLibraryRequestId, onLibraryOpen]);

    useEffect(() => {
        if (!uploadSuccessRecordId || !selectedLibraryItem) {
            return;
        }
        if (selectedLibraryItem.id === uploadSuccessRecordId) {
            setShowUploadToast(true);
        }
    }, [uploadSuccessRecordId, selectedLibraryItem]);

    useEffect(() => {
        if (!showUploadToast) {
            return;
        }
        if (!selectedLibraryItem || selectedLibraryItem.id !== uploadSuccessRecordId) {
            setShowUploadToast(false);
            return;
        }
        if (selectedLibraryItem.summary || selectedLibraryItem.transcript) {
            setShowUploadToast(false);
        }
    }, [showUploadToast, selectedLibraryItem, uploadSuccessRecordId]);


    const formattedTimestamp = useMemo(() => {
        const now = new Date();
        const pad = (value) => value.toString().padStart(2, "0");
        const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
        const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
        return `Untitled ${date} ${time}`;
    }, []);


    const handleClose = () => setShowMeetingName(false);
    const handleStart = (meetingName) => {
        const trimmedName = meetingName.trim();
        if (!trimmedName) {
            return;
        }
        setMeetingId(trimmedName);
        setShowMeetingName(false);
        if (pendingAction === "agenda") {
            setShowAgendaUpload(true);
        } else {
            onStartRecording?.(trimmedName);
        }
        setPendingAction(null);
    };

    const handleActionPress = (action) => {
        const trimmedName = meetingId.trim();
        if (action === "upload") {
            onUploadRecording?.(trimmedName);
            return;
        }
        if (!trimmedName) {
            setPendingAction(action);
            setModalDefaultName(formattedTimestamp);
            if (action === "agenda") {
                setModalButtonLabel("Add Agenda");
            } else {
                setModalButtonLabel("Start Recording");
            }
            setShowMeetingName(true);
            return;
        }
        if (action === "agenda") {
            setShowAgendaUpload(true);
        } else {
            onStartRecording?.(trimmedName);
        }
    };

    const handleAgendaClose = () => setShowAgendaUpload(false);
    const handleMaterialsClose = () => setShowMaterialsUpload(false);
    const handleLibraryOpen = () => {
        onLibraryOpen?.();
        setShowLibraryModal(true);
        setShowSettingsModal(false);
    };
    const handleLibraryClose = () => setShowLibraryModal(false);
    const handleSettingsOpen = () => {
        setShowSettingsModal(true);
        setShowLibraryModal(false);
    };
    const handleSettingsClose = () => setShowSettingsModal(false);
    const handleHomePress = () => {
        setShowLibraryModal(false);
        setShowSettingsModal(false);
    };

    const handleLibraryItemPress = (item) => {
        setSelectedLibraryItem(item);
        setShowLibraryModal(false);
        setShowLibraryDetail(true);
    };

    const getSwipeableRef = (id) => {
        if (!swipeableRefs.current.has(id)) {
            swipeableRefs.current.set(id, React.createRef());
        }
        return swipeableRefs.current.get(id);
    };

    const handleLibraryDetailClose = () => {
        setShowLibraryDetail(false);
        setSelectedLibraryItem(null);
        setShowTranslateDropdown(false);
        setShowSummaryTranslateDropdown(false);
        setShowRenameModal(false);
        setShowLibraryModal(true);
    };

    const handleRenamePress = () => {
        const name = selectedLibraryItem?.title || selectedLibraryItem?.meetingName || "";
        setRenameInputValue(name);
        setShowRenameModal(true);
    };

    const handleRenameSave = () => {
        const trimmed = (renameInputValue || "").trim();
        if (!trimmed || !selectedLibraryItem?.id) {
            setShowRenameModal(false);
            return;
        }
        onUpdateRecording?.(selectedLibraryItem.id, { meetingName: trimmed, title: trimmed });
        setSelectedLibraryItem((current) =>
            current && current.id === selectedLibraryItem.id
                ? { ...current, meetingName: trimmed, title: trimmed }
                : current
        );
        setShowRenameModal(false);
    };

    const handleRenameCancel = () => {
        setShowRenameModal(false);
    };

    const handleDetailHomePress = () => {
        setShowLibraryDetail(false);
        setShowLibraryModal(false);
        setShowSettingsModal(false);
    };

    const handleDetailLibraryPress = () => {
        setShowLibraryDetail(false);
        setShowLibraryModal(true);
        setShowSettingsModal(false);
    };

    const handleDetailSettingsPress = () => {
        setShowLibraryDetail(false);
        setShowLibraryModal(false);
        setShowSettingsModal(true);
    };

    const handleSummaryAction = () => {
        if (!selectedLibraryItem) {
            return;
        }
        const defaultLength = settings?.summaryLength || "Medium";
        const shouldPrompt = settings?.promptSummaryLength !== false;
        setSelectedSummaryLength(defaultLength);
        setSummaryError("");
        setRememberSummaryLength(false);
        setShowLibraryDetail(false);
        if (!selectedLibraryItem?.transcript) {
            setShowSummaryProgress(true);
            transcribeRecording(selectedLibraryItem, {
                showTranscriptModal: false,
                onComplete: ({ transcriptValue }) => {
                    setShowSummaryProgress(false);
                    if (!shouldPrompt) {
                        handleSummaryLengthSelect(defaultLength, {
                            skipSettingsUpdate: true,
                            transcriptOverride: transcriptValue
                        });
                        return;
                    }
                    setShowSummaryLengthModal(true);
                },
                onError: (message) => {
                    setShowSummaryProgress(false);
                    setSummaryError(message || "Transcription failed.");
                    setShowLibraryDetail(true);
                }
            });
            return;
        }
        if (!shouldPrompt) {
            handleSummaryLengthSelect(defaultLength, {
                skipSettingsUpdate: true
            });
            return;
        }
        setShowSummaryLengthModal(true);
    };

    const handleTranscriptAction = () => {
        if (isTranscribing) {
            return;
        }
        setShowLibraryDetail(false);
        setShowTranscriptProgress(true);
        setShowTranslateDropdown(false);
        setTranscriptError("");
        setTranscriptText("");
        setTranscriptLanguage("");
        transcribeRecording(selectedLibraryItem);
    };

    const handleSummaryProgressClose = () => {
        setShowSummaryProgress(false);
        setShowLibraryDetail(true);
    };

    const handleSummaryModalClose = () => {
        setShowSummaryModal(false);
        setShowLibraryDetail(true);
    };

    const handleSummaryLengthCancel = () => {
        setShowSummaryLengthModal(false);
        setShowLibraryDetail(true);
    };

    const handleTranscriptProgressClose = () => {
        if (transcriptAbortRef.current) {
            transcriptAbortRef.current.abort();
        }
        if (transcriptTimeoutRef.current) {
            clearTimeout(transcriptTimeoutRef.current);
        }
        setIsTranscribing(false);
        setShowTranscriptProgress(false);
        setShowLibraryDetail(true);
    };

    const handleTranscriptModalClose = () => {
        setShowTranscriptModal(false);
        setShowLibraryDetail(true);
    };

    const handleSummaryOpen = () => {
        if (!selectedLibraryItem?.summary) {
            return;
        }
        setSummaryText(selectedLibraryItem.summary);
        setSummaryTranslatedLanguage(selectedLibraryItem.summaryLanguage || "");
        setSummaryError("");
        setShowSummaryModal(true);
        setShowLibraryDetail(false);
    };

    const handleSummaryTranslateToggle = () => {
        if (!selectedLibraryItem?.summary) {
            return;
        }
        setSummaryError("");
        setShowSummaryTranslateDropdown((prev) => !prev);
    };

    const handleCopySummary = async () => {
        const textToCopy = summaryError
            ? summaryError
            : summaryText || selectedLibraryItem?.summary || "";
        if (!textToCopy) {
            return;
        }
        await Clipboard.setStringAsync(textToCopy);
    };

    const getSummaryPreview = (summary) => {
        if (!summary) {
            return "";
        }
        return summary
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean)
            .slice(0, 2)
            .join("\n");
    };

    const handleCopyTranscript = async () => {
        const textToCopy = transcriptError
            ? transcriptError
            : transcriptText || selectedLibraryItem?.transcript || "";
        if (!textToCopy) {
            return;
        }
        await Clipboard.setStringAsync(textToCopy);
    };

    const handleTranscriptOpen = () => {
        if (!selectedLibraryItem?.transcript) {
            return;
        }
        setShowTranslateDropdown(false);
        setTranscriptText(selectedLibraryItem.transcript);
        setTranscriptLanguage(selectedLibraryItem.transcriptLanguage || "");
        setTranslatedLanguage(selectedLibraryItem.transcriptTranslatedLanguage || "");
        setTranscriptError("");
        setShowTranscriptModal(true);
        setShowLibraryDetail(false);
    };

    const buildSummaryTemplate = (length, transcriptOverride = "") => {
        const meetingTitle = selectedLibraryItem?.title || selectedLibraryItem?.meetingName || "Meeting";
        const transcriptSource = transcriptOverride || selectedLibraryItem?.transcript || "";
        const cleanedTranscript = transcriptSource.replace(/\s+/g, " ").trim();
        const sentences = cleanedTranscript
            ? cleanedTranscript
                .split(/(?<=[.!?])\s+/)
                .map((sentence) => sentence.trim())
                .filter(Boolean)
            : [];
        if (!sentences.length) {
            return "Summary unavailable. A transcript is required to generate a summary.";
        }
        const lengthConfig = {
            Short: { points: 3, actions: 2 },
            Medium: { points: 5, actions: 3 },
            Detailed: { points: 7, actions: 5 }
        };
        const { points, actions } = lengthConfig[length] || lengthConfig.Medium;
        const actionKeywords = /(action|todo|follow up|follow-up|next step|assign|owner)/i;
        const extractedActions = sentences.filter((sentence) => actionKeywords.test(sentence));
        const pointsList = sentences.slice(0, points);
        const actionsList = extractedActions.slice(0, actions);
        return [
            `${meetingTitle} — ${length} Summary`,
            "",
            "Main meeting points:",
            ...pointsList.map((point) => `• ${point}`),
            "",
            "Action items:",
            ...(actionsList.length
                ? actionsList.map((item) => `• ${item}`)
                : ["• None captured in transcript."])
        ].join("\n");
    };

    const handleSummaryLengthSelect = (length, options = {}) => {
        if (!selectedLibraryItem) {
            setShowSummaryLengthModal(false);
            return;
        }
        setSelectedSummaryLength(length);
        setShowSummaryLengthModal(false);
        const summaryTemplate = buildSummaryTemplate(length, options.transcriptOverride);
        const summaryLanguage = settings?.language || "English";
        setSummaryText(summaryTemplate);
        setSummaryTranslatedLanguage(summaryLanguage);
        setSummaryError("");
        const updatedAt = new Date().toISOString();
        onUpdateRecording?.(selectedLibraryItem.id, {
            summary: summaryTemplate,
            summaryLanguage,
            summaryUpdatedAt: updatedAt
        });
        if ((rememberSummaryLength || options.forceRemember) && !options.skipSettingsUpdate) {
            onSettingsChange?.({
                summaryLength: length,
                promptSummaryLength: false
            });
        }
        setSelectedLibraryItem((current) =>
            current && current.id === selectedLibraryItem.id
                ? {
                    ...current,
                    summary: summaryTemplate,
                    summaryLanguage,
                    summaryUpdatedAt: updatedAt
                }
                : current
        );
        setShowSummaryModal(true);
        setShowLibraryDetail(false);
    };

    const handleSummaryTranslate = async (targetLanguage) => {
        if (!selectedLibraryItem?.summary || isSummaryTranslating) {
            return;
        }
        if (!getBaseUrl()) {
            setSummaryError(
                "Cannot reach translation service. Set apiBaseUrl to your machine IP."
            );
            return;
        }
        setSummaryError("");
        setIsSummaryTranslating(true);
        try {
            const payload = await translateContent({
                summary: selectedLibraryItem.summary,
                transcript: selectedLibraryItem.summary,
                target_language: targetLanguage
            }).catch((err) => {
                onGlobalError?.(err?.message);
                throw err;
            });
            const translatedSummary = payload?.translated_transcript || "";
            if (!translatedSummary) {
                throw new Error("Translation returned an empty response.");
            }
            setSummaryText(translatedSummary);
            setSummaryTranslatedLanguage(targetLanguage);
            setShowSummaryTranslateDropdown(false);
            const updatedAt = new Date().toISOString();
            onUpdateRecording?.(selectedLibraryItem.id, {
                summary: translatedSummary,
                summaryLanguage: targetLanguage,
                summaryUpdatedAt: updatedAt
            });
            setSelectedLibraryItem((current) =>
                current && current.id === selectedLibraryItem.id
                    ? {
                        ...current,
                        summary: translatedSummary,
                        summaryLanguage: targetLanguage,
                        summaryUpdatedAt: updatedAt
                    }
                    : current
            );
        } catch (error) {
            const msg = error?.message || "Translation failed.";
            setSummaryError(msg);
            onGlobalError?.(msg);
        } finally {
            setIsSummaryTranslating(false);
        }
    };

    const handleTranslateToggle = () => {
        if (!selectedLibraryItem?.transcript) {
            return;
        }
        setTranslateError("");
        setShowTranslateDropdown((prev) => !prev);
    };

    const handleTranslateTranscript = async (targetLanguage) => {
        if (!selectedLibraryItem?.transcript || isTranslating) {
            return;
        }
        if (!getBaseUrl()) {
            setTranslateError(
                "Cannot reach translation service. Set apiBaseUrl to your machine IP."
            );
            return;
        }
        setIsTranslating(true);
        setTranslateError("");
        try {
            const payload = await translateContent({
                summary: selectedLibraryItem.summary || selectedLibraryItem.transcript,
                transcript: selectedLibraryItem.transcript,
                target_language: targetLanguage
            }).catch((err) => {
                onGlobalError?.(err?.message);
                throw err;
            });
            if (!payload?.translated_transcript) {
                const message = payload?.error || "Translation failed.";
                throw new Error(message);
            }
            const translatedTranscript = payload?.translated_transcript || "";
            const updatedAt = new Date().toISOString();
            setTranscriptText(translatedTranscript);
            setTranslatedLanguage(targetLanguage);
            setShowTranslateDropdown(false);
            setShowTranscriptModal(true);
            onUpdateRecording?.(selectedLibraryItem.id, {
                transcriptTranslatedText: translatedTranscript,
                transcriptTranslatedLanguage: targetLanguage,
                transcriptTranslatedAt: updatedAt
            });
            setSelectedLibraryItem((current) =>
                current && current.id === selectedLibraryItem.id
                    ? {
                        ...current,
                        transcriptTranslatedText: translatedTranscript,
                        transcriptTranslatedLanguage: targetLanguage,
                        transcriptTranslatedAt: updatedAt
                    }
                    : current
            );
        } catch (error) {
            const msg = error?.message || "Translation failed.";
            setTranslateError(msg);
            onGlobalError?.(msg);
        } finally {
            setIsTranslating(false);
        }
    };

    const transcribeRecording = async (item, options = {}) => {
        const { onComplete, onError, showTranscriptModal = true } = options;
        const fail = (message) => {
            setTranscriptError(message);
            setShowTranscriptProgress(false);
            if (showTranscriptModal) {
                setShowTranscriptModal(true);
            }
            onError?.(message);
        };
        if (!item?.recordingUri) {
            fail("Recording not available for transcription.");
            return;
        }
        const baseUrl = getBaseUrl();
        if (!baseUrl) {
            fail("Cannot reach transcription service. Set apiBaseUrl to your machine IP.");
            return;
        }
        const controller = new AbortController();
        transcriptAbortRef.current = controller;
        transcriptStartTimeRef.current = Date.now();
        setIsTranscribing(true);
        setTranscriptError("");
        let transcriptValue = "";
        let languageValue = "";
        let errorMessage = "";
        try {
            transcriptTimeoutRef.current = setTimeout(() => controller.abort(), 35 * 60 * 1000); // 35 min: first-time model download can take ~20 min
            setTranscriptProgressPercent(0);
            setTranscriptProgressMessage("Starting…");
            await new Promise((resolve) => requestAnimationFrame(resolve));
            await new Promise((resolve) => setTimeout(resolve, 150));
            await new Promise((resolve) => InteractionManager.runAfterInteractions(resolve));
            await new Promise((resolve) => requestAnimationFrame(resolve));

            const jobId = `job-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
            const uploadResult = await processAudio({
                audioUri: item.recordingUri,
                jobId,
                userId: "1",
                signal: controller.signal,
                transcriptionLanguage: settings?.transcriptionLanguage ?? "auto"
            }).catch((err) => {
                onGlobalError?.(err?.message);
                throw err;
            });

            if (uploadResult.status === 202) {
                const pollIntervalMs = 1500;
                await new Promise((r) => setTimeout(r, 400));
                while (true) {
                    if (controller.signal?.aborted) throw new Error("AbortError");
                    const data = await getProcessStatus(jobId, controller.signal).catch((err) => {
                        onGlobalError?.(err?.message);
                        throw err;
                    });
                    setTranscriptProgressPercent(data.progress ?? 0);
                    setTranscriptProgressMessage(data.message ?? "");
                    if (data.status === "completed" && data.result) {
                        setTranscriptError("");
                        const res = data.result;
                        transcriptValue = res.transcript ?? res.english_transcript ?? "";
                        languageValue = res.original_language ?? "";
                        const summaryValue = res.english_summary ?? res.summary ?? "";
                        const summaryLang = res.original_language ?? "English";
                        const actionItems = Array.isArray(res.english_action_items) ? res.english_action_items : (Array.isArray(res.action_items) ? res.action_items : []);
                        const createdAt = new Date().toISOString();
                        setTranscriptText(transcriptValue);
                        setTranscriptLanguage(languageValue);
                        setTranslatedLanguage("");
                        onUpdateRecording?.(item.id, {
                            transcript: transcriptValue,
                            transcriptLanguage: languageValue,
                            transcriptCreatedAt: createdAt,
                            transcriptTranslatedText: "",
                            transcriptTranslatedLanguage: "",
                            transcriptTranslatedAt: "",
                            summary: summaryValue,
                            summaryLanguage: summaryLang,
                            summaryUpdatedAt: createdAt,
                            action_items: actionItems,
                            status: "saved"
                        });
                        setSelectedLibraryItem((current) =>
                            current && current.id === item.id
                                ? {
                                    ...current,
                                    transcript: transcriptValue,
                                    transcriptLanguage: languageValue,
                                    transcriptCreatedAt: createdAt,
                                    transcriptTranslatedText: "",
                                    transcriptTranslatedLanguage: "",
                                    transcriptTranslatedAt: "",
                                    summary: summaryValue,
                                    summaryLanguage: summaryLang,
                                    summaryUpdatedAt: createdAt,
                                    action_items: actionItems,
                                    status: "saved"
                                }
                                : current
                        );
                        onComplete?.({ transcriptValue, languageValue });
                        break;
                    }
                    if (data.status === "error") {
                        throw new Error(data.error || data.message || "Processing failed.");
                    }
                    await new Promise((r) => setTimeout(r, pollIntervalMs));
                }
            } else if (uploadResult.status === 200) {
                transcriptValue = uploadResult?.transcript ?? uploadResult?.english_transcript ?? "";
                languageValue = uploadResult?.original_language ?? "";
                const summaryValue = uploadResult?.english_summary ?? uploadResult?.summary ?? "";
                const summaryLang = uploadResult?.original_language ?? "English";
                const actionItems = uploadResult?.english_action_items ?? uploadResult?.action_items ?? [];
                const createdAt = new Date().toISOString();
                setTranscriptText(transcriptValue);
                setTranscriptLanguage(languageValue);
                setTranslatedLanguage("");
                onUpdateRecording?.(item.id, {
                    transcript: transcriptValue,
                    transcriptLanguage: languageValue,
                    transcriptCreatedAt: createdAt,
                    transcriptTranslatedText: "",
                    transcriptTranslatedLanguage: "",
                    transcriptTranslatedAt: "",
                    summary: summaryValue,
                    summaryLanguage: summaryLang,
                    summaryUpdatedAt: createdAt,
                    action_items: actionItems,
                    status: "saved"
                });
                setSelectedLibraryItem((current) =>
                    current && current.id === item.id
                        ? {
                            ...current,
                            transcript: transcriptValue,
                            transcriptLanguage: languageValue,
                            transcriptCreatedAt: createdAt,
                            transcriptTranslatedText: "",
                            transcriptTranslatedLanguage: "",
                            transcriptTranslatedAt: "",
                            summary: summaryValue,
                            summaryLanguage: summaryLang,
                            summaryUpdatedAt: createdAt,
                            action_items: actionItems,
                            status: "saved"
                        }
                        : current
                );
                onComplete?.({ transcriptValue, languageValue });
            } else {
                throw new Error(uploadResult?.error || "Transcription failed.");
            }
        } catch (error) {
            errorMessage =
                error?.name === "AbortError"
                    ? "Transcription cancelled."
                    : error?.message || "Transcription failed.";
            const msg = error?.name === "AbortError" ? "Transcription cancelled." : (error?.message || "Transcription failed.");
            setTimeout(() => {
                if (error?.name === "AbortError") {
                    setTranscriptError("Transcription cancelled.");
                } else {
                    setTranscriptError(msg);
                }
                onGlobalError?.(errorMessage);
                onError?.(errorMessage);
            }, 0);
        } finally {
            if (transcriptTimeoutRef.current) {
                clearTimeout(transcriptTimeoutRef.current);
            }
            transcriptAbortRef.current = null;
            transcriptStartTimeRef.current = null;
            setIsTranscribing(false);
            setShowTranscriptProgress(false);
            setTranscriptProgressPercent(0);
            setTranscriptProgressMessage("");
            setTranscriptElapsedSeconds(0);
            if (showTranscriptModal) {
                setShowTranscriptModal(true);
            }
        }
    };

    const formatTime = (millis) => {
        if (!millis) {
            return "0:00";
        }
        const totalSeconds = Math.floor(millis / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    };

    const formatTimestamp = (value) => {
        if (!value) {
            return "";
        }
        const date = new Date(value);
        const dateLabel = date.toLocaleDateString(undefined, {
            month: "2-digit",
            day: "2-digit",
            year: "2-digit"
        });
        const timeLabel = date.toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit"
        });
        return `Created ${dateLabel} ${timeLabel}`;
    };

    const handlePlaybackStatus = (status) => {
        if (!status?.isLoaded) {
            return;
        }
        setPlaybackPosition(status.positionMillis ?? 0);
        setPlaybackDuration(status.durationMillis ?? 0);
        setIsPlaying(status.isPlaying ?? false);
        if (status.didJustFinish) {
            setIsPlaying(false);
        }
    };

    const handleTogglePlayback = async () => {
        const recordingUri = selectedLibraryItem?.recordingUri;
        if (!recordingUri) {
            return;
        }
        if (sound) {
            if (isPlaying) {
                await sound.pauseAsync();
            } else {
                await sound.playAsync();
            }
            return;
        }
        setAudioLoading(true);
        try {
            const { sound: newSound } = await Audio.Sound.createAsync(
                { uri: recordingUri },
                { shouldPlay: true },
                handlePlaybackStatus
            );
            setSound(newSound);
        } finally {
            setAudioLoading(false);
        }
    };

    const handleSeekBy = async (offsetSeconds) => {
        if (!sound) {
            return;
        }
        const status = await sound.getStatusAsync();
        if (!status?.isLoaded) {
            return;
        }
        const nextPosition = Math.max(
            0,
            Math.min(status.durationMillis ?? 0, (status.positionMillis ?? 0) + offsetSeconds * 1000)
        );
        await sound.setPositionAsync(nextPosition);
    };

    const handleSeekTo = async (ratio) => {
        if (!sound || !playbackDuration) {
            return;
        }
        const nextPosition = Math.max(0, Math.min(playbackDuration, ratio * playbackDuration));
        await sound.setPositionAsync(nextPosition);
    };

    const handleShareRecording = async () => {
        const recordingUri = selectedLibraryItem?.recordingUri;
        if (!recordingUri) {
            return;
        }
        await Share.share({
            url: recordingUri,
            message: "Meeting recording"
        });
    };

    const handleShareSummary = async () => {
        const summaryText = selectedLibraryItem?.summary;
        if (!summaryText) {
            return;
        }
        const meetingTitle = selectedLibraryItem?.title || selectedLibraryItem?.meetingName || "Meeting";
        const summaryLanguage = selectedLibraryItem?.summaryLanguage
            ? `Language: ${selectedLibraryItem.summaryLanguage}`
            : "Language: Unknown";
        await Share.share({
            title: "Meeting summary",
            message: `${meetingTitle}\n${summaryLanguage}\n\n${summaryText}`
        });
    };

    const handleShareTranscript = async () => {
        const transcriptToShare =
            transcriptText || selectedLibraryItem?.transcript || "";
        if (!transcriptToShare) {
            return;
        }
        const meetingTitle = selectedLibraryItem?.title || selectedLibraryItem?.meetingName || "Meeting";
        const languageLabel = selectedLibraryItem?.transcriptLanguage
            ? `Language: ${selectedLibraryItem.transcriptLanguage}`
            : "Language: Unknown";
        await Share.share({
            title: "Meeting transcript",
            message: `${meetingTitle}\n${languageLabel}\n\n${transcriptToShare}`
        });
    };

    useEffect(() => {
        return () => {
            sound?.unloadAsync();
        };
    }, [sound]);

    useEffect(() => {
        if (!showLibraryDetail) {
            sound?.stopAsync();
            sound?.unloadAsync();
            setSound(null);
            setIsPlaying(false);
            setPlaybackPosition(0);
            setPlaybackDuration(0);
            setAudioLoading(false);
        }
    }, [showLibraryDetail, sound]);

    const renderDeleteAction = (recordId) => (
        <TouchableOpacity
            style={styles.deleteAction}
            activeOpacity={0.8}
            onPress={() => onDeleteRecording?.(recordId)}
        >
            <Ionicons name="trash" size={20} color="#FFFFFF" />
            <Text style={styles.deleteActionText}>Delete</Text>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            {/* Debugging overlay and pulse - commented out */}
            {/* <View style={styles.heartbeatOverlay} pointerEvents="none">
                <Text style={styles.heartbeatText}>HB: {heartbeatCount}</Text>
                <Text style={styles.heartbeatSub}>{lastHeartbeatAt ? lastHeartbeatAt.split('T')[1].split('Z')[0] : '-'}</Text>
            </View>
            <Animated.View
                style={[
                    styles.uiPulse,
                    { opacity: uiPulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }) }
                ]}
                pointerEvents="none"
            /> */}
            {!showLibraryDetail && (
                <>
                    <UploadZone
                        meetingId={meetingId}
                        onMeetingIdChange={setMeetingId}
                        onRecord={() => handleActionPress("record")}
                        onUpload={() => handleActionPress("upload")}
                        onAgenda={() => handleActionPress("agenda")}
                        onMaterials={() => setShowMaterialsUpload(true)}
                    />

                    <View style={styles.tabBar}>
                        <TouchableOpacity
                            style={styles.tabItem}
                            activeOpacity={0.8}
                            onPress={handleHomePress}
                        >
                            <Ionicons
                                name="home"
                                size={22}
                                color={showLibraryModal || showSettingsModal ? "#94A3B8" : "#1D71B8"}
                            />
                            <Text
                                style={
                                    showLibraryModal || showSettingsModal
                                        ? styles.tabLabel
                                        : styles.tabLabelActive
                                }
                            >
                                Home
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.tabItem}
                            activeOpacity={0.8}
                            onPress={handleLibraryOpen}
                        >
                            <Ionicons
                                name="albums"
                                size={22}
                                color={showLibraryModal ? "#1D71B8" : "#94A3B8"}
                            />
                            <Text style={showLibraryModal ? styles.tabLabelActive : styles.tabLabel}>
                                Library
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.tabItem}
                            activeOpacity={0.8}
                            onPress={handleSettingsOpen}
                        >
                            <Ionicons
                                name="settings"
                                size={22}
                                color={showSettingsModal ? "#1D71B8" : "#94A3B8"}
                            />
                            <Text style={showSettingsModal ? styles.tabLabelActive : styles.tabLabel}>
                                Settings
                            </Text>
                        </TouchableOpacity>
                    </View>
                </>
            )}

            {showLibraryDetail && (
                <GestureHandlerRootView style={styles.libraryOverlay}>
                    <ScrollView
                        style={styles.detailScroll}
                        contentContainerStyle={styles.detailContainer}
                        showsVerticalScrollIndicator={false}
                    >
                        <View style={styles.detailHeader}>
                            <Text style={styles.detailTitle}>Meeting Details</Text>
                            <TouchableOpacity
                                style={styles.detailCloseButton}
                                onPress={handleLibraryDetailClose}
                            >
                                <Ionicons name="close" size={18} color="#64748B" />
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity
                            style={styles.detailMeetingNameRow}
                            onPress={handleRenamePress}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.detailMeetingName} numberOfLines={1}>
                                {selectedLibraryItem?.title || selectedLibraryItem?.meetingName || "Untitled"}
                            </Text>
                            <Ionicons name="pencil" size={18} color="#1D71B8" style={styles.detailRenameIcon} />
                        </TouchableOpacity>
                        {showUploadToast ? (
                            <View style={styles.uploadToast}>
                                <Text style={styles.uploadToastText}>
                                    Download complete. You may now generate a transcript and/or summary.
                                </Text>
                            </View>
                        ) : null}

                        <MeetingControls
                            recordingUri={selectedLibraryItem?.recordingUri}
                            playbackDuration={playbackDuration}
                            playbackPosition={playbackPosition}
                            progressBarWidth={progressBarWidth}
                            isPlaying={isPlaying}
                            audioLoading={audioLoading}
                            hasSound={!!sound}
                            formatTime={formatTime}
                            onShare={handleShareRecording}
                            onSeekBy={handleSeekBy}
                            onTogglePlayback={handleTogglePlayback}
                            onSeekTo={handleSeekTo}
                            onProgressBarLayout={({ nativeEvent }) =>
                                setProgressBarWidth(nativeEvent.layout.width)
                            }
                        />

                        <TouchableOpacity
                            style={styles.detailSection}
                            activeOpacity={0.9}
                            onPress={handleSummaryOpen}
                            disabled={!selectedLibraryItem?.summary}
                        >
                            <View style={styles.detailSectionHeader}>
                                <View style={styles.detailIconBubble}>
                                    <Ionicons name="document-text-outline" size={18} color="#1D71B8" />
                                </View>
                                <Text style={styles.detailSectionTitle}>Summary</Text>
                            </View>
                            <Text style={styles.summaryHintText}>
                                will create transcript if none exists
                            </Text>
                            <View style={styles.detailSectionActionsRow}>
                                <View style={styles.detailSectionActionGroup}>
                                    <TouchableOpacity
                                        style={styles.actionButton}
                                        onPress={handleSummaryAction}
                                    >
                                        <Text style={styles.actionButtonText}>
                                            {selectedLibraryItem?.summary ? "Replace" : "Create"}
                                        </Text>
                                    </TouchableOpacity>
                                    <View style={styles.translateDropdown}>
                                        <TouchableOpacity
                                            style={styles.translateDropdownToggle}
                                            onPress={handleSummaryTranslateToggle}
                                            disabled={!selectedLibraryItem?.summary}
                                        >
                                            <Text style={styles.translateDropdownText}>Translate to</Text>
                                            <Ionicons
                                                name={
                                                    showSummaryTranslateDropdown
                                                        ? "chevron-up"
                                                        : "chevron-down"
                                                }
                                                size={14}
                                                color="#FFFFFF"
                                            />
                                        </TouchableOpacity>
                                        {showSummaryTranslateDropdown ? (
                                            <View style={styles.translateDropdownMenu}>
                                                <ScrollView
                                                    style={styles.translateDropdownScroll}
                                                    showsVerticalScrollIndicator
                                                >
                                                    {TRANSLATE_LANGUAGES.map((language) => (
                                                        <TouchableOpacity
                                                            key={language}
                                                            style={styles.translateDropdownItem}
                                                            onPress={() =>
                                                                handleSummaryTranslate(language)
                                                            }
                                                            disabled={isSummaryTranslating}
                                                        >
                                                            <Text style={styles.translateDropdownItemText}>
                                                                {language}
                                                            </Text>
                                                        </TouchableOpacity>
                                                    ))}
                                                </ScrollView>
                                            </View>
                                        ) : null}
                                    </View>
                                </View>
                                <TouchableOpacity
                                    style={styles.shareButton}
                                    onPress={handleShareSummary}
                                    disabled={!selectedLibraryItem?.summary}
                                >
                                    <Ionicons name="share-outline" size={18} color="#1D71B8" />
                                </TouchableOpacity>
                            </View>
                            <Text style={styles.detailSectionText}>
                                {selectedLibraryItem?.summary
                                    ? getSummaryPreview(selectedLibraryItem.summary)
                                    : "Summary not available yet."}
                            </Text>
                            {selectedLibraryItem?.summaryLanguage ? (
                                <Text style={styles.detailSectionMeta}>
                                    Language: {selectedLibraryItem.summaryLanguage}
                                </Text>
                            ) : null}
                            {summaryError ? (
                                <Text style={styles.detailSectionError}>{summaryError}</Text>
                            ) : null}
                            {selectedLibraryItem?.summary ? (
                                <View style={styles.detailSectionOpenRow}>
                                    <Text style={styles.detailSectionOpenText}>View Summary</Text>
                                    <View style={styles.detailSectionOpenIcon}>
                                        <Ionicons name="chevron-forward" size={16} color="#1D71B8" />
                                    </View>
                                </View>
                            ) : null}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.detailSection}
                            activeOpacity={0.9}
                            onPress={handleTranscriptOpen}
                            disabled={!selectedLibraryItem?.transcript}
                        >
                            <View style={styles.detailSectionHeader}>
                                <View style={styles.detailIconBubble}>
                                    <Ionicons name="chatbubble-ellipses-outline" size={18} color="#1D71B8" />
                                </View>
                                <Text style={styles.detailSectionTitle}>Transcript</Text>
                            </View>
                            <View style={styles.detailSectionActionsRow}>
                                <View style={styles.detailSectionActionGroup}>
                                    <TouchableOpacity
                                        style={styles.actionButton}
                                        onPress={handleTranscriptAction}
                                    >
                                        <Text style={styles.actionButtonText}>
                                            {selectedLibraryItem?.transcript ? "Replace" : "Create"}
                                        </Text>
                                    </TouchableOpacity>
                                    <View style={styles.translateDropdown}>
                                        <TouchableOpacity
                                            style={styles.translateDropdownToggle}
                                            onPress={handleTranslateToggle}
                                            disabled={!selectedLibraryItem?.transcript}
                                        >
                                            <Text style={styles.translateDropdownText}>Translate to</Text>
                                            <Ionicons
                                                name={showTranslateDropdown ? "chevron-up" : "chevron-down"}
                                                size={14}
                                                color="#FFFFFF"
                                            />
                                        </TouchableOpacity>
                                        {showTranslateDropdown ? (
                                            <View style={styles.translateDropdownMenu}>
                                                <ScrollView
                                                    style={styles.translateDropdownScroll}
                                                    showsVerticalScrollIndicator
                                                >
                                                    {TRANSLATE_LANGUAGES.map((language) => (
                                                        <TouchableOpacity
                                                            key={language}
                                                            style={styles.translateDropdownItem}
                                                            onPress={() =>
                                                                handleTranslateTranscript(language)
                                                            }
                                                            disabled={isTranslating}
                                                        >
                                                            <Text style={styles.translateDropdownItemText}>
                                                                {language}
                                                            </Text>
                                                        </TouchableOpacity>
                                                    ))}
                                                </ScrollView>
                                            </View>
                                        ) : null}
                                    </View>
                                </View>
                                <TouchableOpacity
                                    style={styles.shareButton}
                                    onPress={handleShareTranscript}
                                    disabled={!selectedLibraryItem?.transcript}
                                >
                                    <Ionicons name="share-outline" size={18} color="#1D71B8" />
                                </TouchableOpacity>
                            </View>
                            <Text style={styles.detailSectionText}>
                                {selectedLibraryItem?.transcriptCreatedAt
                                    ? formatTimestamp(selectedLibraryItem.transcriptCreatedAt)
                                    : "Transcript not available yet."}
                            </Text>
                            {selectedLibraryItem?.transcript ? (
                                <Text style={styles.detailSectionPreview} numberOfLines={2}>
                                    {selectedLibraryItem.transcript}
                                </Text>
                            ) : null}
                            {selectedLibraryItem?.transcriptLanguage ? (
                                <Text style={styles.detailSectionMeta}>
                                    Language: {selectedLibraryItem.transcriptLanguage}
                                </Text>
                            ) : null}
                            {translateError ? (
                                <Text style={styles.detailSectionError}>{translateError}</Text>
                            ) : null}
                            {selectedLibraryItem?.transcript ? (
                                <View style={styles.detailSectionOpenRow}>
                                    <Text style={styles.detailSectionOpenText}>View transcript</Text>
                                    <View style={styles.detailSectionOpenIcon}>
                                        <Ionicons name="chevron-forward" size={16} color="#1D71B8" />
                                    </View>
                                </View>
                            ) : null}
                        </TouchableOpacity>
                    </ScrollView>
                    <View style={styles.libraryTabBar}>
                        <TouchableOpacity
                            style={styles.tabItem}
                            activeOpacity={0.8}
                            onPress={handleDetailHomePress}
                        >
                            <Ionicons name="home" size={22} color="#94A3B8" />
                            <Text style={styles.tabLabel}>Home</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.tabItem}
                            activeOpacity={0.8}
                            onPress={handleDetailLibraryPress}
                        >
                            <Ionicons name="albums" size={22} color="#1D71B8" />
                            <Text style={styles.tabLabelActive}>Library</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.tabItem}
                            activeOpacity={0.8}
                            onPress={handleDetailSettingsPress}
                        >
                            <Ionicons name="settings" size={22} color="#94A3B8" />
                            <Text style={styles.tabLabel}>Settings</Text>
                        </TouchableOpacity>
                    </View>
                </GestureHandlerRootView>
            )}

            {showMeetingName && (
                <View style={styles.modalOverlay}>
                    <MeetingNameScreen
                        onClose={handleClose}
                        onStart={handleStart}
                        onMeetingNameChange={setMeetingId}
                        initialValue={modalDefaultName}
                        buttonLabel={modalButtonLabel}
                    />
                </View>
            )}

            <Modal animationType="fade" transparent visible={showAgendaUpload}>
                <View style={styles.modalOverlay}>
                    <Pressable style={styles.modalBackdrop} onPress={handleAgendaClose} />
                    <View style={styles.agendaModal}>
                        <View style={styles.agendaModalHeader}>
                            <Text style={styles.agendaModalTitle}>Add Agenda</Text>
                            <TouchableOpacity
                                onPress={handleAgendaClose}
                                style={styles.agendaCloseButton}
                            >
                                <Ionicons name="close" size={18} color="#64748B" />
                            </TouchableOpacity>
                        </View>
                        <Ionicons name="document-text-outline" size={34} color="#1D71B8" />
                        <Text style={styles.agendaModalText}>
                            Upload, or snap a picture of an agenda
                        </Text>
                        <Text style={styles.agendaModalSubtext}>
                            Allowed files: PDF, DOCX, TXT.
                        </Text>
                        <TouchableOpacity style={styles.agendaUploadButton} activeOpacity={0.85}>
                            <Text style={styles.agendaUploadText}>Choose File</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.agendaCameraButton} activeOpacity={0.85}>
                            <Ionicons name="camera" size={16} color="#1D71B8" />
                            <Text style={styles.agendaCameraText}>Take a Picture</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <Modal animationType="fade" transparent visible={showMaterialsUpload}>
                <View style={styles.modalOverlay}>
                    <Pressable style={styles.modalBackdrop} onPress={handleMaterialsClose} />
                    <View style={styles.materialsModal}>
                        <View style={styles.agendaModalHeader}>
                            <Text style={styles.agendaModalTitle}>Add Meeting Materials</Text>
                            <TouchableOpacity
                                onPress={handleMaterialsClose}
                                style={styles.agendaCloseButton}
                            >
                                <Ionicons name="close" size={18} color="#64748B" />
                            </TouchableOpacity>
                        </View>
                        <Ionicons name="folder-open" size={34} color="#1D71B8" />
                        <Text style={styles.materialsModalText}>
                            Upload/Snap a Picture of relevant meeting materials.
                        </Text>
                        <Text style={styles.materialsModalSubtext}>
                            Max of {materialsLimits.maxItems} items, and {materialsLimits.maxTotalMb} MB
                            of data allowed.
                        </Text>
                        <Text style={styles.materialsUploadedText}>
                            {materialsUploadCount} Items Uploaded
                        </Text>
                        <TouchableOpacity style={styles.agendaUploadButton} activeOpacity={0.85}>
                            <Text style={styles.agendaUploadText}>Choose File</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.agendaCameraButton} activeOpacity={0.85}>
                            <Ionicons name="camera" size={16} color="#1D71B8" />
                            <Text style={styles.agendaCameraText}>Take a Picture</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <Modal animationType="slide" transparent visible={showLibraryModal}>
                <GestureHandlerRootView style={styles.libraryOverlay}>
                    <View style={styles.libraryContainer}>
                        <View style={styles.libraryHeader}>
                            <Text style={styles.libraryTitle}>Library</Text>
                            <TouchableOpacity style={styles.searchButton} activeOpacity={0.85}>
                                <Ionicons name="search" size={20} color="#64748B" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView
                            style={styles.meetingListScroll}
                            contentContainerStyle={styles.meetingList}
                            showsVerticalScrollIndicator={false}
                        >
                            {meetingList.length ? (
                                meetingList.map((item) => {
                                    const swipeableRef = getSwipeableRef(item.id);
                                    return (
                                        <Swipeable
                                            key={item.id}
                                            ref={swipeableRef}
                                            renderRightActions={() => renderDeleteAction(item.id)}
                                            overshootRight={false}
                                        >
                                            <TapGestureHandler
                                                onHandlerStateChange={({ nativeEvent }) => {
                                                    if (nativeEvent.state === State.END) {
                                                        handleLibraryItemPress(item);
                                                    }
                                                }}
                                            >
                                                <View style={styles.meetingCard}>
                                                    <View>
                                                        <Text style={styles.meetingTitle}>
                                                            {item.title}
                                                        </Text>
                                                        <Text style={styles.meetingMeta}>
                                                            {item.date} · {item.time} · {item.statusLabel}
                                                        </Text>
                                                    </View>
                                                    <Ionicons
                                                        name="chevron-forward"
                                                        size={18}
                                                        color="#94A3B8"
                                                    />
                                                </View>
                                            </TapGestureHandler>
                                        </Swipeable>
                                    );
                                })
                            ) : (
                                <View style={styles.emptyLibrary}>
                                    <Text style={styles.emptyLibraryTitle}>No recordings yet</Text>
                                    <Text style={styles.emptyLibraryText}>
                                        Record a meeting to see transcripts, summaries, and audio here.
                                    </Text>
                                </View>
                            )}
                        </ScrollView>
                        <View style={styles.libraryTabBar}>
                            <TouchableOpacity
                                style={styles.tabItem}
                                activeOpacity={0.8}
                                onPress={handleHomePress}
                            >
                                <Ionicons name="home" size={22} color="#94A3B8" />
                                <Text style={styles.tabLabel}>Home</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.tabItem} activeOpacity={0.8}>
                                <Ionicons name="albums" size={22} color="#1D71B8" />
                                <Text style={styles.tabLabelActive}>Library</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.tabItem}
                                activeOpacity={0.8}
                                onPress={handleSettingsOpen}
                            >
                                <Ionicons name="settings" size={22} color="#94A3B8" />
                                <Text style={styles.tabLabel}>Settings</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </GestureHandlerRootView>
            </Modal>

            <Modal animationType="slide" transparent visible={showSettingsModal}>
                <View style={styles.libraryOverlay}>
                    <SettingsScreen
                        onClose={handleSettingsClose}
                        onShowHome={handleHomePress}
                        onShowLibrary={handleLibraryOpen}
                        settings={settings}
                        onSettingsChange={onSettingsChange}
                    />
                </View>
            </Modal>


            <Modal animationType="fade" transparent visible={showSummaryProgress}>
                <View style={styles.progressOverlay}>
                    <CreatingSummaryScreen
                        meetingName={selectedLibraryItem?.title || selectedLibraryItem?.meetingName}
                        onBack={handleSummaryProgressClose}
                        title="Transcript and Summary"
                        steps={[
                            "Transcribing meeting",
                            "Generating summary"
                        ]}
                        cancelLabel="Cancel"
                        progress={transcriptProgressPercent}
                        progressMessage={transcriptProgressMessage ? `${transcriptProgressMessage} ${Math.round(transcriptProgressPercent * 100)}%` : `${Math.round(transcriptProgressPercent * 100)}%`}
                        elapsedSeconds={transcriptElapsedSeconds}
                    />
                </View>
            </Modal>

            <Modal animationType="fade" transparent visible={showSummaryLengthModal}>
                <View style={styles.modalOverlay}>
                    <View style={styles.summaryLengthCard}>
                        <Text style={styles.transcriptHeading}>Transcript and Summary</Text>
                        <Text style={styles.summaryLengthSubtext}>
                            Choose how detailed you want the summary.
                        </Text>
                        <View style={styles.summaryLengthOptions}>
                            {["Short", "Medium", "Detailed"].map((option) => {
                                const isActive = option === selectedSummaryLength;
                                return (
                                    <TouchableOpacity
                                        key={option}
                                        style={[
                                            styles.summaryLengthOption,
                                            isActive && styles.summaryLengthOptionActive
                                        ]}
                                        onPress={() => handleSummaryLengthSelect(option)}
                                    >
                                        <Text
                                            style={[
                                                styles.summaryLengthOptionText,
                                                isActive && styles.summaryLengthOptionTextActive
                                            ]}
                                        >
                                            {option}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                        <TouchableOpacity
                            style={styles.summaryLengthRememberRow}
                            onPress={() => {
                                setRememberSummaryLength((current) => {
                                    const nextValue = !current;
                                    if (nextValue) {
                                        handleSummaryLengthSelect(selectedSummaryLength, {
                                            forceRemember: true
                                        });
                                    }
                                    return nextValue;
                                });
                            }}
                        >
                            <View
                                style={[
                                    styles.summaryLengthCheckbox,
                                    rememberSummaryLength && styles.summaryLengthCheckboxChecked
                                ]}
                            >
                                {rememberSummaryLength ? (
                                    <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                                ) : null}
                            </View>
                            <Text style={styles.summaryLengthRememberText}>Remember this</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.summaryLengthCancel}
                            onPress={handleSummaryLengthCancel}
                        >
                            <Text style={styles.summaryLengthCancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <Modal animationType="fade" transparent visible={showRenameModal}>
                <View style={styles.modalOverlay}>
                    <View style={styles.renameCard}>
                        <Text style={styles.renameTitle}>Rename recording</Text>
                        <TextInput
                            style={styles.renameInput}
                            value={renameInputValue}
                            onChangeText={setRenameInputValue}
                            placeholder="Meeting name"
                            placeholderTextColor="#94A3B8"
                            autoCapitalize="words"
                            autoCorrect={false}
                            selectTextOnFocus
                        />
                        <View style={styles.renameActions}>
                            <TouchableOpacity
                                style={styles.renameCancelButton}
                                onPress={handleRenameCancel}
                                activeOpacity={0.85}
                            >
                                <Text style={styles.renameCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.renameSaveButton}
                                onPress={handleRenameSave}
                                activeOpacity={0.85}
                            >
                                <Text style={styles.renameSaveText}>Save</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal animationType="fade" transparent visible={showTranscriptProgress}>
                <View style={styles.progressOverlay}>
                    <CreatingSummaryScreen
                        meetingName={selectedLibraryItem?.title || selectedLibraryItem?.meetingName}
                        onBack={handleTranscriptProgressClose}
                        title="Transcribing"
                        steps={["Transcribing meeting"]}
                        cancelLabel="Cancel"
                        progress={transcriptProgressPercent}
                        progressMessage={transcriptProgressMessage ? `${transcriptProgressMessage} ${Math.round(transcriptProgressPercent * 100)}%` : `${Math.round(transcriptProgressPercent * 100)}%`}
                        elapsedSeconds={transcriptElapsedSeconds}
                    />
                </View>
            </Modal>

            <Modal animationType="fade" transparent visible={showTranscriptModal}>
                <View style={styles.modalOverlay}>
                    <View style={styles.transcriptCard}>
                        <View style={styles.transcriptHeader}>
                            <Text style={styles.transcriptTitle}>
                                {selectedLibraryItem?.title || selectedLibraryItem?.meetingName || "Meeting"}
                            </Text>
                            <View style={styles.transcriptHeaderActions}>
                                <TouchableOpacity
                                    style={styles.detailCloseButton}
                                    onPress={handleCopyTranscript}
                                >
                                    <Ionicons name="copy-outline" size={18} color="#1D71B8" />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.detailCloseButton}
                                    onPress={handleTranscriptModalClose}
                                >
                                    <Ionicons name="close" size={18} color="#64748B" />
                                </TouchableOpacity>
                            </View>
                        </View>
                        <ScrollView
                            style={styles.transcriptModalScroll}
                            contentContainerStyle={styles.transcriptModalScrollContent}
                            showsVerticalScrollIndicator={true}
                        >
                            <Text style={styles.transcriptHeading}>Transcript</Text>
                            {transcriptLanguage ? (
                                <Text style={styles.transcriptLanguage}>
                                    Language: {transcriptLanguage}
                                </Text>
                            ) : null}
                            <Text style={styles.transcriptBody}>
                                {transcriptError
                                    ? transcriptError
                                    : transcriptText || "Transcript unavailable."}
                            </Text>
                            {translatedLanguage ? (
                                <Text style={styles.transcriptLanguage}>
                                    Translated to: {translatedLanguage}
                                </Text>
                            ) : null}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            <Modal animationType="fade" transparent visible={showSummaryModal}>
                <View style={styles.modalOverlay}>
                    <View style={styles.transcriptCard}>
                        <View style={styles.transcriptHeader}>
                            <Text style={styles.transcriptTitle}>
                                {selectedLibraryItem?.title || selectedLibraryItem?.meetingName || "Meeting"}
                            </Text>
                            <View style={styles.transcriptHeaderActions}>
                                <TouchableOpacity
                                    style={styles.detailCloseButton}
                                    onPress={handleCopySummary}
                                >
                                    <Ionicons name="copy-outline" size={18} color="#1D71B8" />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.detailCloseButton}
                                    onPress={handleSummaryModalClose}
                                >
                                    <Ionicons name="close" size={18} color="#64748B" />
                                </TouchableOpacity>
                            </View>
                        </View>
                        <ScrollView
                            style={styles.transcriptModalScroll}
                            contentContainerStyle={styles.transcriptModalScrollContent}
                            showsVerticalScrollIndicator={true}
                        >
                            <Text style={styles.transcriptHeading}>Summary</Text>
                            {summaryTranslatedLanguage ? (
                                <Text style={styles.transcriptLanguage}>
                                    Language: {summaryTranslatedLanguage}
                                </Text>
                            ) : null}
                            <Text style={styles.transcriptBody}>
                                {summaryError
                                    ? summaryError
                                    : summaryText || "Summary unavailable."}
                            </Text>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F4F6FA",
        justifyContent: "flex-start"
    },
    content: {
        flex: 1,                 // <-- IMPORTANT: fills available height
        paddingHorizontal: 28,
        paddingTop: 16,          // <-- pulls everything upward
        paddingBottom: 140       // <-- leaves room for the fixed tab bar
    },

    brandBlock: {
        alignItems: "center",
        marginBottom: 0
    },
    logoContainer: {
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 6
    },
    logoImage: {
        width: 180,
        height: 180
    },
    brandTitle: {
        fontSize: 26,
        fontWeight: "700",
        color: "#2D3748"
    },
    brandSubtitle: {
        fontSize: 18,
        color: "#4A5568",
        marginTop: 2
    },
    heartbeatOverlay: {
        position: 'absolute',
        top: 12,
        right: 12,
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 8,
        paddingVertical: 6,
        borderRadius: 8,
        zIndex: 9999,
        alignItems: 'center'
    },
    heartbeatText: {
        color: '#E6FFFA',
        fontSize: 12,
        fontWeight: '700'
    },
    heartbeatSub: {
        color: '#CFECE9',
        fontSize: 10,
        marginTop: 2
    },
    uiPulse: {
        position: 'absolute',
        top: 8,
        right: 64,
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#34D399',
        zIndex: 9999,
    },
    prompt: {
        textAlign: "center",
        fontSize: 16,
        color: "#667085",
        marginTop: 6,
        marginBottom: 18
    },
    buttonStack: {
        gap: 10,
        marginBottom: 8
    },
    primaryButton: {
        height: 64,
        borderRadius: 18,
        paddingHorizontal: 20,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        width: "100%",
        shadowColor: "#000",
        shadowOpacity: 0.12,
        shadowOffset: { width: 0, height: 10 },
        shadowRadius: 16,
        elevation: 8
    },
    primaryButtonText: {
        color: "#FFFFFF",
        fontSize: 17,
        fontWeight: "600"
    },
    secondaryButton: {
        height: 64,
        borderRadius: 18,
        paddingHorizontal: 20,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        width: "100%",
        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowOffset: { width: 0, height: 10 },
        shadowRadius: 16,
        elevation: 6
    },
    secondaryButtonText: {
        color: "#FFFFFF",
        fontSize: 17,
        fontWeight: "600"
    },
    agendaCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 14,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowOffset: { width: 0, height: 8 },
        shadowRadius: 14,
        elevation: 5,
        marginBottom: 8
    },
    agendaLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12
    },
    agendaIcon: {
        width: 34,
        height: 34,
        borderRadius: 10,
        backgroundColor: "#EEF5FB",
        alignItems: "center",
        justifyContent: "center"
    },
    agendaIconAlt: {
        width: 34,
        height: 34,
        borderRadius: 10,
        backgroundColor: "#EEF5FB",
        alignItems: "center",
        justifyContent: "center"
    },
    agendaText: {
        fontSize: 16,
        color: "#4A5568",
        fontWeight: "600"
    },
    meetingNameCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 14,
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowOffset: { width: 0, height: 6 },
        shadowRadius: 12,
        elevation: 4
    },
    meetingNameLabel: {
        fontSize: 12,
        color: "#94A3B8",
        textTransform: "uppercase",
        letterSpacing: 0.6,
        marginBottom: 6
    },
    meetingNameInput: {
        fontSize: 16,
        fontWeight: "600",
        color: "#4A5568",
        paddingVertical: 0
    },
    tabBar: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,

        backgroundColor: "#FFFFFF",
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 36,
        paddingTop: 10,
        paddingBottom: 18,
        flexDirection: "row",
        justifyContent: "space-between",
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowOffset: { width: 0, height: -4 },
        shadowRadius: 10,
        elevation: 12
    },
    tabItem: {
        alignItems: "center",
        gap: 4
    },
    tabLabel: {
        fontSize: 12,
        color: "#94A3B8"
    },
    tabLabelActive: {
        fontSize: 12,
        color: "#1D71B8",
        fontWeight: "600"
    },
    modalOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "rgba(15, 23, 42, 0.12)"
    },
    progressOverlay: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 24,
        backgroundColor: "rgba(15, 23, 42, 0.18)"
    },
    transcriptCard: {
        width: "100%",
        maxWidth: 420,
        maxHeight: "85%",
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        padding: 20,
        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowOffset: { width: 0, height: 8 },
        shadowRadius: 16,
        elevation: 6
    },
    transcriptModalScroll: {
        maxHeight: 400,
        flexGrow: 0
    },
    transcriptModalScrollContent: {
        paddingBottom: 24
    },
    summaryLengthCard: {
        width: "100%",
        maxWidth: 320,
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        padding: 20,
        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowOffset: { width: 0, height: 8 },
        shadowRadius: 16,
        elevation: 6
    },
    summaryLengthSubtext: {
        fontSize: 12,
        color: "#64748B",
        marginBottom: 12
    },
    summaryLengthOptions: {
        gap: 10,
        marginBottom: 12
    },
    summaryLengthRememberRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        marginBottom: 14
    },
    summaryLengthCheckbox: {
        width: 20,
        height: 20,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: "#CBD5F5",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#FFFFFF"
    },
    summaryLengthCheckboxChecked: {
        backgroundColor: "#1D71B8",
        borderColor: "#1D71B8"
    },
    summaryLengthRememberText: {
        fontSize: 13,
        color: "#1E293B",
        fontWeight: "600"
    },
    summaryLengthOption: {
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        alignItems: "center"
    },
    summaryLengthOptionActive: {
        backgroundColor: "#1D71B8",
        borderColor: "#1D71B8"
    },
    summaryLengthOptionText: {
        fontSize: 14,
        color: "#1E293B",
        fontWeight: "600"
    },
    summaryLengthOptionTextActive: {
        color: "#FFFFFF"
    },
    summaryLengthCancel: {
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: "#E2E8F0",
        alignItems: "center"
    },
    summaryLengthCancelText: {
        fontSize: 13,
        color: "#1D71B8",
        fontWeight: "600"
    },
    renameCard: {
        width: "100%",
        maxWidth: 340,
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        padding: 24,
        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowOffset: { width: 0, height: 8 },
        shadowRadius: 16,
        elevation: 6
    },
    renameTitle: {
        fontSize: 18,
        fontWeight: "700",
        color: "#1E293B",
        marginBottom: 16
    },
    renameInput: {
        borderWidth: 1,
        borderColor: "#E2E8F0",
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 16,
        fontSize: 16,
        color: "#1E293B",
        marginBottom: 20,
        backgroundColor: "#F8FAFC"
    },
    renameActions: {
        flexDirection: "row",
        justifyContent: "flex-end",
        gap: 12
    },
    renameCancelButton: {
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 12,
        backgroundColor: "#F1F5F9"
    },
    renameCancelText: {
        fontSize: 15,
        fontWeight: "600",
        color: "#64748B"
    },
    renameSaveButton: {
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 12,
        backgroundColor: "#1D71B8"
    },
    renameSaveText: {
        fontSize: 15,
        fontWeight: "600",
        color: "#FFFFFF"
    },
    transcriptHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 10
    },
    transcriptHeaderActions: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8
    },
    transcriptTitle: {
        fontSize: 18,
        fontWeight: "700",
        color: "#1E293B"
    },
    transcriptHeading: {
        fontSize: 15,
        fontWeight: "700",
        color: "#1E293B",
        marginBottom: 6
    },
    transcriptLanguage: {
        fontSize: 12,
        color: "#64748B",
        marginBottom: 8
    },
    transcriptBody: {
        fontSize: 14,
        color: "#475569",
        lineHeight: 20
    },
    modalBackdrop: {
        ...StyleSheet.absoluteFillObject
    },
    agendaModal: {
        width: 280,
        paddingVertical: 18,
        paddingHorizontal: 20,
        borderRadius: 14,
        backgroundColor: "#FFFFFF",
        alignItems: "center",
        shadowColor: "#0F172A",
        shadowOpacity: 0.2,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 12 },
        elevation: 10
    },
    materialsModal: {
        width: 300,
        paddingVertical: 18,
        paddingHorizontal: 20,
        borderRadius: 14,
        backgroundColor: "#FFFFFF",
        alignItems: "center",
        shadowColor: "#0F172A",
        shadowOpacity: 0.2,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 12 },
        elevation: 10
    },
    agendaModalHeader: {
        width: "100%",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 12
    },
    agendaModalTitle: {
        fontSize: 16,
        fontWeight: "700",
        color: "#0F172A"
    },
    agendaCloseButton: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#F1F5F9"
    },
    agendaModalText: {
        marginTop: 12,
        fontSize: 14,
        fontWeight: "600",
        color: "#1E293B"
    },
    agendaModalSubtext: {
        marginTop: 6,
        fontSize: 12,
        color: "#64748B",
        textAlign: "center"
    },
    materialsModalText: {
        marginTop: 12,
        fontSize: 14,
        fontWeight: "600",
        color: "#1E293B",
        textAlign: "center"
    },
    materialsModalSubtext: {
        marginTop: 6,
        fontSize: 12,
        color: "#64748B",
        textAlign: "center"
    },
    materialsUploadedText: {
        marginTop: 10,
        fontSize: 12,
        color: "#1D71B8",
        fontWeight: "600"
    },
    agendaUploadButton: {
        marginTop: 16,
        paddingVertical: 10,
        paddingHorizontal: 18,
        borderRadius: 10,
        backgroundColor: "#1D71B8"
    },
    agendaUploadText: {
        color: "#FFFFFF",
        fontSize: 13,
        fontWeight: "600"
    },
    agendaCameraButton: {
        marginTop: 10,
        paddingVertical: 10,
        paddingHorizontal: 18,
        borderRadius: 10,
        backgroundColor: "#E2E8F0",
        flexDirection: "row",
        alignItems: "center",
        gap: 8
    },
    agendaCameraText: {
        color: "#1D71B8",
        fontSize: 13,
        fontWeight: "600"
    },
    libraryOverlay: {
        flex: 1,
        backgroundColor: "#F1F5F9"
    },
    libraryContainer: {
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 56,
        paddingBottom: 120
    },
    libraryHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 20
    },
    libraryTitle: {
        fontSize: 26,
        fontWeight: "700",
        color: "#2D3748"
    },
    searchButton: {
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
    meetingList: {
        gap: 12
    },
    meetingListScroll: {
        flex: 1
    },
    meetingCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 18,
        paddingHorizontal: 18,
        paddingVertical: 16,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowOffset: { width: 0, height: 8 },
        shadowRadius: 14,
        elevation: 5
    },
    meetingTitle: {
        fontSize: 16,
        fontWeight: "600",
        color: "#2D3748"
    },
    meetingMeta: {
        marginTop: 4,
        fontSize: 13,
        color: "#94A3B8"
    },
    deleteAction: {
        backgroundColor: "#EF4444",
        borderRadius: 18,
        marginLeft: 12,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 18
    },
    deleteActionText: {
        color: "#FFFFFF",
        fontSize: 12,
        fontWeight: "700",
        marginTop: 4
    },
    emptyLibrary: {
        backgroundColor: "#FFFFFF",
        borderRadius: 18,
        paddingVertical: 24,
        paddingHorizontal: 20,
        alignItems: "center",
        shadowColor: "#000",
        shadowOpacity: 0.06,
        shadowOffset: { width: 0, height: 6 },
        shadowRadius: 12,
        elevation: 4
    },
    emptyLibraryTitle: {
        fontSize: 16,
        fontWeight: "600",
        color: "#2D3748",
        marginBottom: 6
    },
    emptyLibraryText: {
        fontSize: 13,
        color: "#94A3B8",
        textAlign: "center",
        lineHeight: 18
    },
    libraryTabBar: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "#FFFFFF",
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 36,
        paddingTop: 10,
        paddingBottom: 18,
        flexDirection: "row",
        justifyContent: "space-between",
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowOffset: { width: 0, height: -4 },
        shadowRadius: 10,
        elevation: 12
    },
    detailScroll: {
        flex: 1
    },
    detailContainer: {
        flexGrow: 1,
        paddingHorizontal: 24,
        paddingTop: 56,
        paddingBottom: 160
    },
    detailHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 16
    },
    detailTitle: {
        fontSize: 24,
        fontWeight: "700",
        color: "#2D3748"
    },
    summaryHintText: {
        marginTop: 6,
        fontSize: 12,
        color: "#94A3B8"
    },
    detailCloseButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#FFFFFF",
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 8,
        elevation: 4
    },
    detailMeetingNameRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 18,
        gap: 8,
        paddingVertical: 4,
        paddingRight: 4
    },
    detailMeetingName: {
        flex: 1,
        fontSize: 18,
        fontWeight: "600",
        color: "#1E293B"
    },
    detailRenameIcon: {
        marginLeft: 4
    },
    uploadToast: {
        marginBottom: 16,
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 12,
        backgroundColor: "#E0F2FE",
        borderWidth: 1,
        borderColor: "#BAE6FD"
    },
    uploadToastText: {
        fontSize: 13,
        color: "#0F172A",
        lineHeight: 18
    },
    detailSection: {
        backgroundColor: "#FFFFFF",
        borderRadius: 18,
        paddingVertical: 16,
        paddingHorizontal: 18,
        marginBottom: 14,
        shadowColor: "#000",
        shadowOpacity: 0.06,
        shadowOffset: { width: 0, height: 6 },
        shadowRadius: 12,
        elevation: 4
    },
    detailSectionActionsRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        marginTop: 12,
        marginBottom: 6
    },
    detailSectionActionGroup: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        flex: 1
    },
    detailSectionHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        marginBottom: 8
    },
    detailSectionHeaderRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 8
    },
    detailIconBubble: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: "#E8F1FB",
        alignItems: "center",
        justifyContent: "center"
    },
    detailSectionTitle: {
        fontSize: 16,
        fontWeight: "600",
        color: "#1E293B"
    },
    detailSectionText: {
        fontSize: 14,
        color: "#64748B",
        lineHeight: 20
    },
    detailSectionMeta: {
        marginTop: 6,
        fontSize: 12,
        color: "#64748B"
    },
    detailSectionPreview: {
        marginTop: 8,
        fontSize: 13,
        color: "#475569",
        lineHeight: 18
    },
    detailSectionError: {
        marginTop: 6,
        fontSize: 12,
        color: "#E11D48"
    },
    detailSectionOpenRow: {
        marginTop: 12,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: "#E2E8F0",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between"
    },
    detailSectionOpenText: {
        fontSize: 13,
        fontWeight: "600",
        color: "#1D71B8"
    },
    detailSectionOpenIcon: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#E8F1FB"
    },
    shareButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#E8F1FB"
    },
    sectionActions: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8
    },
    actionButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 14,
        backgroundColor: "#1D71B8"
    },
    actionButtonText: {
        fontSize: 12,
        color: "#FFFFFF",
        fontWeight: "600"
    },
    translateDropdown: {
        position: "relative"
    },
    translateDropdownToggle: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 14,
        backgroundColor: "#1D71B8"
    },
    translateDropdownText: {
        fontSize: 12,
        color: "#FFFFFF",
        fontWeight: "600"
    },
    translateDropdownMenu: {
        position: "absolute",
        top: 34,
        left: 0,
        minWidth: 140,
        maxHeight: 220,
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowOffset: { width: 0, height: 6 },
        shadowRadius: 12,
        elevation: 6,
        zIndex: 20
    },
    translateDropdownScroll: {
        maxHeight: 200
    },
    translateDropdownItem: {
        paddingHorizontal: 12,
        paddingVertical: 6
    },
    translateDropdownItemText: {
        fontSize: 13,
        color: "#1E293B"
    },
    recordingControls: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        marginTop: 12
    },
    skipButton: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: "#E8F1FB"
    },
    skipButtonText: {
        fontSize: 12,
        color: "#1D71B8",
        fontWeight: "600"
    },
    playButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#1D71B8"
    },
    recordingProgressRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        marginTop: 10
    },
    progressBar: {
        flex: 1,
        height: 6,
        borderRadius: 999,
        backgroundColor: "#E2E8F0",
        overflow: "hidden"
    },
    progressFill: {
        height: "100%",
        backgroundColor: "#1D71B8"
    },
    recordingTimeText: {
        fontSize: 13,
        color: "#64748B"
    }
});
