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
    Share
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Audio } from "expo-av";
import {
    GestureHandlerRootView,
    State,
    Swipeable,
    TapGestureHandler
} from "react-native-gesture-handler";
import MeetingNameScreen from "./MeetingNameScreen";
import appConfig from "../config/appConfig";
import SettingsScreen from "./SettingsScreen";

export default function HomeScreen({
    onStartRecording,
    onUploadRecording,
    libraryItems = [],
    onLibraryOpen,
    onDeleteRecording,
    settings,
    onSettingsChange
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
    const swipeableRefs = useRef(new Map());
    const [audioLoading, setAudioLoading] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackPosition, setPlaybackPosition] = useState(0);
    const [playbackDuration, setPlaybackDuration] = useState(0);
    const [sound, setSound] = useState(null);
    const [progressBarWidth, setProgressBarWidth] = useState(0);

    const materialsLimits = appConfig.meetingMaterials;

    const meetingList = useMemo(() => {
        if (!libraryItems.length) {
            return [];
        }
        return libraryItems.map((item) => {
            const created = item.createdAt ? new Date(item.createdAt) : new Date();
            const date = created.toLocaleDateString(undefined, {
                month: "short",
                day: "numeric"
            });
            const time = created.toLocaleTimeString(undefined, {
                hour: "numeric",
                minute: "2-digit"
            });
            const statusLabel = item.status === "transcribing" ? "Transcribing" : "Saved";
            return {
                id: item.id,
                title: item.meetingName || "Untitled",
                date,
                time,
                statusLabel,
                recordingUri: item.recordingUri,
                summary: item.summary || "",
                transcript: item.transcript || ""
            };
        });
    }, [libraryItems]);

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
        if (pendingAction === "upload") {
            onUploadRecording?.(trimmedName);
        } else if (pendingAction === "agenda") {
            setShowAgendaUpload(true);
        } else {
            onStartRecording?.(trimmedName);
        }
        setPendingAction(null);
    };

    const handleActionPress = (action) => {
        const trimmedName = meetingId.trim();
        if (!trimmedName) {
            setPendingAction(action);
            setModalDefaultName(formattedTimestamp);
            if (action === "upload") {
                setModalButtonLabel("Upload Recording");
            } else if (action === "agenda") {
                setModalButtonLabel("Add Agenda");
            } else {
                setModalButtonLabel("Start Recording");
            }
            setShowMeetingName(true);
            return;
        }
        if (action === "upload") {
            onUploadRecording?.(trimmedName);
        } else if (action === "agenda") {
            setShowAgendaUpload(true);
        } else {
            onStartRecording?.(trimmedName);
        };
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
        setShowLibraryModal(true);
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
            <View style={styles.content}>
                <View style={styles.brandBlock}>
                    <View style={styles.logoContainer}>
                        <Image
                            source={require("../../assets/alta-vista-logo.png")}
                            style={styles.logoImage}
                            resizeMode="cover"
                        />
                    </View>
                    <Text style={styles.brandTitle}>Alta Vista</Text>
                    <Text style={styles.brandSubtitle}>Meeting Intelligence</Text>
                </View>

                <Text style={styles.prompt}>What would you like to do?</Text>

                <View style={styles.buttonStack}>
                    <TouchableOpacity
                        activeOpacity={0.9}
                        onPress={() => handleActionPress("record")}
                    >
                        <LinearGradient
                            colors={["#FF9A3D", "#F48B1F"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.primaryButton}
                        >
                            <Ionicons name="mic" size={22} color="#FFFFFF" />
                            <Text style={styles.primaryButtonText}>Record Meeting</Text>
                        </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity
                        activeOpacity={0.9}
                        onPress={() => handleActionPress("upload")}
                    >
                        <LinearGradient
                            colors={["#6BB6E5", "#4E8ECF"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.secondaryButton}
                        >
                            <Ionicons name="cloud-upload" size={22} color="#FFFFFF" />
                            <Text style={styles.secondaryButtonText}>Upload Recording</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>

                <TouchableOpacity
                    style={styles.agendaCard}
                    activeOpacity={0.9}
                    onPress={() => handleActionPress("agenda")}
                >
                    <View style={styles.agendaLeft}>
                        <View style={styles.agendaIcon}>
                            <Ionicons name="document-text-outline" size={20} color="#6BA3D3" />
                        </View>
                        <Text style={styles.agendaText}>Add Agenda</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#A0AEC0" />
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.agendaCard}
                    activeOpacity={0.9}
                    onPress={() => setShowMaterialsUpload(true)}
                >
                    <View style={styles.agendaLeft}>
                        <View style={styles.agendaIconAlt}>
                            <Ionicons name="folder-open" size={20} color="#6BA3D3" />
                        </View>
                        <Text style={styles.agendaText}>Add Meeting Materials</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#A0AEC0" />
                </TouchableOpacity>

                <View style={styles.meetingNameCard}>
                    <Text style={styles.meetingNameLabel}>Meeting ID</Text>
                    <TextInput
                        value={meetingId}
                        onChangeText={setMeetingId}
                        placeholder="Untitled"
                        placeholderTextColor="#A0AEC0"
                        style={styles.meetingNameInput}
                    />
                </View>
            </View>

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
                            <Text style={styles.libraryTitle}>Meetings</Text>
                            <TouchableOpacity style={styles.searchButton} activeOpacity={0.85}>
                                <Ionicons name="search" size={20} color="#64748B" />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.meetingList}>
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
                        </View>
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

            <Modal animationType="slide" transparent visible={showLibraryDetail}>
                <GestureHandlerRootView style={styles.libraryOverlay}>
                    <View style={styles.detailContainer}>
                        <View style={styles.detailHeader}>
                            <Text style={styles.detailTitle}>Meeting Details</Text>
                            <TouchableOpacity
                                style={styles.detailCloseButton}
                                onPress={handleLibraryDetailClose}
                            >
                                <Ionicons name="close" size={18} color="#64748B" />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.detailMeetingName}>
                            {selectedLibraryItem?.title || "Untitled"}
                        </Text>

                        <View style={styles.detailSection}>
                            <View style={styles.detailSectionHeaderRow}>
                                <View style={styles.detailSectionHeader}>
                                    <View style={styles.detailIconBubble}>
                                        <Ionicons name="mic" size={18} color="#1D71B8" />
                                    </View>
                                    <Text style={styles.detailSectionTitle}>Recording</Text>
                                </View>
                                <TouchableOpacity
                                    style={styles.shareButton}
                                    onPress={handleShareRecording}
                                    disabled={!selectedLibraryItem?.recordingUri}
                                >
                                    <Ionicons name="share-outline" size={18} color="#1D71B8" />
                                </TouchableOpacity>
                            </View>
                            <Text style={styles.detailSectionText}>
                                {selectedLibraryItem?.recordingUri
                                    ? "Saved on device"
                                    : "Recording not available"}
                            </Text>
                            <View style={styles.recordingControls}>
                                <TouchableOpacity
                                    style={styles.skipButton}
                                    onPress={() => handleSeekBy(-15)}
                                    disabled={!sound}
                                >
                                    <Ionicons name="play-skip-back" size={16} color="#1D71B8" />
                                    <Text style={styles.skipButtonText}>15s</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.playButton}
                                    onPress={handleTogglePlayback}
                                    disabled={!selectedLibraryItem?.recordingUri || audioLoading}
                                >
                                    <Ionicons
                                        name={isPlaying ? "pause" : "play"}
                                        size={18}
                                        color="#FFFFFF"
                                    />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.skipButton}
                                    onPress={() => handleSeekBy(15)}
                                    disabled={!sound}
                                >
                                    <Ionicons name="play-skip-forward" size={16} color="#1D71B8" />
                                    <Text style={styles.skipButtonText}>15s</Text>
                                </TouchableOpacity>
                            </View>
                            <View style={styles.recordingProgressRow}>
                                <Text style={styles.recordingTimeText}>
                                    {formatTime(playbackPosition)}
                                </Text>
                                <Pressable
                                    style={styles.progressBar}
                                    onLayout={({ nativeEvent }) =>
                                        setProgressBarWidth(nativeEvent.layout.width)
                                    }
                                    onPress={({ nativeEvent }) => {
                                        if (!progressBarWidth) {
                                            return;
                                        }
                                        handleSeekTo(nativeEvent.locationX / progressBarWidth);
                                    }}
                                >
                                    <View
                                        style={[
                                            styles.progressFill,
                                            {
                                                width: `${playbackDuration
                                                    ? (playbackPosition / playbackDuration) * 100
                                                    : 0
                                                    }%`
                                            }
                                        ]}
                                    />
                                </Pressable>
                                <Text style={styles.recordingTimeText}>
                                    {formatTime(playbackDuration)}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.detailSection}>
                            <View style={styles.detailSectionHeader}>
                                <View style={styles.detailIconBubble}>
                                    <Ionicons name="document-text-outline" size={18} color="#1D71B8" />
                                </View>
                                <Text style={styles.detailSectionTitle}>Summary</Text>
                            </View>
                            <Text style={styles.detailSectionText}>
                                {selectedLibraryItem?.summary
                                    ? selectedLibraryItem.summary
                                    : "Summary not available yet."}
                            </Text>
                        </View>

                        <View style={styles.detailSection}>
                            <View style={styles.detailSectionHeader}>
                                <View style={styles.detailIconBubble}>
                                    <Ionicons name="chatbubble-ellipses-outline" size={18} color="#1D71B8" />
                                </View>
                                <Text style={styles.detailSectionTitle}>Transcript</Text>
                            </View>
                            <Text style={styles.detailSectionText}>
                                {selectedLibraryItem?.transcript
                                    ? selectedLibraryItem.transcript
                                    : "Transcript not available yet."}
                            </Text>
                        </View>
                    </View>
                </GestureHandlerRootView>
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
    detailContainer: {
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 56,
        paddingBottom: 40
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
    detailMeetingName: {
        fontSize: 18,
        fontWeight: "600",
        color: "#1E293B",
        marginBottom: 18
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
    shareButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#E8F1FB"
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
