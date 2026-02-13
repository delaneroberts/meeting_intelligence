import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import MeetingNameScreen from "./MeetingNameScreen";

export default function HomeScreen({ onStartRecording, onUploadRecording }) {
    const [showMeetingName, setShowMeetingName] = useState(false);
    const [meetingId, setMeetingId] = useState("");
    const [modalDefaultName, setModalDefaultName] = useState("");
    const [modalButtonLabel, setModalButtonLabel] = useState("Start Recording");
    const [pendingAction, setPendingAction] = useState(null);

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
            setModalButtonLabel(action === "upload" ? "Upload Recording" : "Start Recording");
            setShowMeetingName(true);
            return;
        }
        if (action === "upload") {
            onUploadRecording?.(trimmedName);
        } else {
            onStartRecording?.(trimmedName);
        }
    };

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

                <TouchableOpacity style={styles.agendaCard} activeOpacity={0.9}>
                    <View style={styles.agendaLeft}>
                        <View style={styles.agendaIcon}>
                            <Ionicons name="document-text-outline" size={20} color="#6BA3D3" />
                        </View>
                        <Text style={styles.agendaText}>Add Agenda</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#A0AEC0" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.agendaCard} activeOpacity={0.9}>
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
                <TouchableOpacity style={styles.tabItem} activeOpacity={0.8}>
                    <Ionicons name="home" size={22} color="#1D71B8" />
                    <Text style={styles.tabLabelActive}>Home</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.tabItem} activeOpacity={0.8}>
                    <Ionicons name="albums" size={22} color="#94A3B8" />
                    <Text style={styles.tabLabel}>Library</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.tabItem} activeOpacity={0.8}>
                    <Ionicons name="settings" size={22} color="#94A3B8" />
                    <Text style={styles.tabLabel}>Settings</Text>
                </TouchableOpacity>
            </View>

            {showMeetingName && (
                <View style={styles.modalOverlay}>
                    <MeetingNameScreen
                        onClose={handleClose}
                        onStart={handleStart}
                        initialValue={modalDefaultName}
                        buttonLabel={modalButtonLabel}
                    />
                </View>
            )}
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
    }
});
