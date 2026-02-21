/**
 * TranscriptView – transcript section in meeting details: Create/Replace, Translate, Share,
 * timestamp, preview, "View transcript" link.
 * Parent owns state and API; this is presentational.
 */

import React from "react";
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function TranscriptView({
    hasTranscript,
    transcriptCreatedAt,
    transcriptPreview,
    transcriptLanguage,
    translateError,
    showTranslateDropdown,
    isTranslating,
    languages,
    formatTimestamp,
    onCreateReplace,
    onTranslateToggle,
    onTranslate,
    onShare,
    onViewTranscript,
}) {
    return (
        <TouchableOpacity
            style={styles.section}
            activeOpacity={0.9}
            onPress={onViewTranscript}
            disabled={!hasTranscript}
        >
            <View style={styles.sectionHeader}>
                <View style={styles.header}>
                    <View style={styles.iconBubble}>
                        <Ionicons name="chatbubble-ellipses-outline" size={18} color="#1D71B8" />
                    </View>
                    <Text style={styles.sectionTitle}>Transcript</Text>
                </View>
            </View>
            <View style={styles.actionsRow}>
                <View style={styles.actionGroup}>
                    <TouchableOpacity style={styles.actionButton} onPress={onCreateReplace}>
                        <Text style={styles.actionButtonText}>
                            {hasTranscript ? "Replace" : "Create"}
                        </Text>
                    </TouchableOpacity>
                    <View style={styles.translateDropdown}>
                        <TouchableOpacity
                            style={styles.translateDropdownToggle}
                            onPress={onTranslateToggle}
                            disabled={!hasTranscript}
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
                                    {languages.map((lang) => (
                                        <TouchableOpacity
                                            key={lang}
                                            style={styles.translateDropdownItem}
                                            onPress={() => onTranslate(lang)}
                                            disabled={isTranslating}
                                        >
                                            <Text style={styles.translateDropdownItemText}>
                                                {lang}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        ) : null}
                    </View>
                </View>
                <TouchableOpacity style={styles.shareButton} onPress={onShare} disabled={!hasTranscript}>
                    <Ionicons name="share-outline" size={18} color="#1D71B8" />
                </TouchableOpacity>
            </View>
            <Text style={styles.sectionText}>
                {transcriptCreatedAt
                    ? formatTimestamp(transcriptCreatedAt)
                    : "Transcript not available yet."}
            </Text>
            {hasTranscript && transcriptPreview ? (
                <Text style={styles.preview} numberOfLines={2}>
                    {transcriptPreview}
                </Text>
            ) : null}
            {transcriptLanguage ? (
                <Text style={styles.meta}>Language: {transcriptLanguage}</Text>
            ) : null}
            {translateError ? (
                <Text style={styles.errorText}>{translateError}</Text>
            ) : null}
            {hasTranscript ? (
                <View style={styles.openRow}>
                    <Text style={styles.openText}>View transcript</Text>
                    <View style={styles.openIcon}>
                        <Ionicons name="chevron-forward" size={16} color="#1D71B8" />
                    </View>
                </View>
            ) : null}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    section: {
        marginBottom: 20,
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        padding: 16,
        shadowColor: "#000",
        shadowOpacity: 0.04,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 8,
        elevation: 2,
    },
    sectionHeader: { marginBottom: 8 },
    header: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    iconBubble: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: "#EFF6FF",
        alignItems: "center",
        justifyContent: "center",
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: "700",
        color: "#1E293B",
    },
    actionsRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 8,
    },
    actionGroup: { flexDirection: "row", alignItems: "center", gap: 10 },
    actionButton: {
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 10,
        backgroundColor: "#1D71B8",
    },
    actionButtonText: {
        fontSize: 14,
        fontWeight: "600",
        color: "#FFFFFF",
    },
    translateDropdown: { position: "relative" },
    translateDropdownToggle: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 10,
        backgroundColor: "#1D71B8",
    },
    translateDropdownText: {
        fontSize: 13,
        color: "#FFFFFF",
        fontWeight: "600",
    },
    translateDropdownMenu: {
        position: "absolute",
        top: "100%",
        left: 0,
        marginTop: 4,
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        maxHeight: 200,
        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 4,
        zIndex: 10,
    },
    translateDropdownScroll: { maxHeight: 200 },
    translateDropdownItem: {
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    translateDropdownItemText: {
        fontSize: 14,
        color: "#1E293B",
    },
    shareButton: { padding: 8 },
    sectionText: {
        fontSize: 13,
        color: "#64748B",
        marginBottom: 6,
    },
    preview: {
        fontSize: 13,
        color: "#475569",
        marginBottom: 6,
    },
    meta: {
        fontSize: 12,
        color: "#64748B",
        marginBottom: 6,
    },
    errorText: {
        fontSize: 12,
        color: "#DC2626",
        marginBottom: 6,
    },
    openRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 8,
    },
    openText: {
        fontSize: 14,
        fontWeight: "600",
        color: "#1D71B8",
    },
    openIcon: {},
});
