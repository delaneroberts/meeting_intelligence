import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function RecordingScreen({ meetingName = "New Meeting", onBack }) {
    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
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
                <Text style={styles.timerValue}>00:18</Text>
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
                <Text style={styles.statusTitle}>Recording in progress</Text>
                <Text style={styles.statusSubtitle}>Speak naturally. We will capture key points.</Text>
            </View>

            <View style={styles.controls}>
                <TouchableOpacity style={styles.secondaryControl} activeOpacity={0.85}>
                    <Ionicons name="pause" size={20} color="#1D71B8" />
                    <Text style={styles.secondaryText}>Pause</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.primaryControl} activeOpacity={0.85}>
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
    }
});
