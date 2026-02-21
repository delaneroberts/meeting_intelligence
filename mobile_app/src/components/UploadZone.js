/**
 * UploadZone – home screen main content: brand, prompt, Record/Upload actions,
 * Add Agenda, Add Materials, Meeting ID input.
 * Parent handles navigation and state; this is presentational.
 */

import React from "react";
import {
    View,
    Text,
    TouchableOpacity,
    TextInput,
    Image,
    StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

export default function UploadZone({
    meetingId,
    onMeetingIdChange,
    onRecord,
    onUpload,
    onAgenda,
    onMaterials,
}) {
    return (
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
                <TouchableOpacity activeOpacity={0.9} onPress={onRecord}>
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
                <TouchableOpacity activeOpacity={0.9} onPress={onUpload}>
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
            <TouchableOpacity style={styles.agendaCard} activeOpacity={0.9} onPress={onAgenda}>
                <View style={styles.agendaLeft}>
                    <View style={styles.agendaIcon}>
                        <Ionicons name="document-text-outline" size={20} color="#6BA3D3" />
                    </View>
                    <Text style={styles.agendaText}>Add Agenda</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#A0AEC0" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.agendaCard} activeOpacity={0.9} onPress={onMaterials}>
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
                    onChangeText={onMeetingIdChange}
                    placeholder="Untitled"
                    placeholderTextColor="#A0AEC0"
                    style={styles.meetingNameInput}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    content: {
        flex: 1,
        paddingHorizontal: 24,
    },
    brandBlock: {
        alignItems: "center",
        marginBottom: 28,
    },
    logoContainer: {
        width: 72,
        height: 72,
        borderRadius: 16,
        overflow: "hidden",
        marginBottom: 12,
    },
    logoImage: {
        width: "100%",
        height: "100%",
    },
    brandTitle: {
        fontSize: 24,
        fontWeight: "700",
        color: "#1E293B",
        marginBottom: 4,
    },
    brandSubtitle: {
        fontSize: 14,
        color: "#64748B",
    },
    prompt: {
        fontSize: 16,
        color: "#475569",
        marginBottom: 20,
    },
    buttonStack: {
        gap: 14,
        marginBottom: 20,
    },
    primaryButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        paddingVertical: 16,
        borderRadius: 16,
    },
    primaryButtonText: {
        fontSize: 17,
        fontWeight: "700",
        color: "#FFFFFF",
    },
    secondaryButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        paddingVertical: 16,
        borderRadius: 16,
    },
    secondaryButtonText: {
        fontSize: 17,
        fontWeight: "700",
        color: "#FFFFFF",
    },
    agendaCard: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "#FFFFFF",
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 14,
        marginBottom: 10,
        shadowColor: "#000",
        shadowOpacity: 0.04,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 8,
        elevation: 2,
    },
    agendaLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    agendaIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: "#EFF6FF",
        alignItems: "center",
        justifyContent: "center",
    },
    agendaIconAlt: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: "#F0FDF4",
        alignItems: "center",
        justifyContent: "center",
    },
    agendaText: {
        fontSize: 15,
        fontWeight: "600",
        color: "#1E293B",
    },
    meetingNameCard: {
        backgroundColor: "#FFFFFF",
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 14,
        shadowColor: "#000",
        shadowOpacity: 0.04,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 8,
        elevation: 2,
    },
    meetingNameLabel: {
        fontSize: 12,
        color: "#64748B",
        marginBottom: 6,
    },
    meetingNameInput: {
        fontSize: 16,
        color: "#1E293B",
        padding: 0,
    },
});
