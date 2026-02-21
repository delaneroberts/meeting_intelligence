/**
 * MeetingControls – recording playback section in meeting details.
 * Play/pause, skip, progress bar, share. Keeps API and state in parent.
 */

import React from "react";
import { View, Text, TouchableOpacity, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function MeetingControls({
    recordingUri,
    playbackDuration,
    playbackPosition,
    progressBarWidth,
    isPlaying,
    audioLoading,
    hasSound,
    formatTime,
    onShare,
    onSeekBy,
    onTogglePlayback,
    onSeekTo,
    onProgressBarLayout,
}) {
    const progressPercent = playbackDuration
        ? (playbackPosition / playbackDuration) * 100
        : 0;

    return (
        <View style={styles.section}>
            <View style={styles.headerRow}>
                <View style={styles.header}>
                    <View style={styles.iconBubble}>
                        <Ionicons name="mic" size={18} color="#1D71B8" />
                    </View>
                    <Text style={styles.sectionTitle}>Recording</Text>
                </View>
                <TouchableOpacity
                    style={styles.shareButton}
                    onPress={onShare}
                    disabled={!recordingUri}
                >
                    <Ionicons name="share-outline" size={18} color="#1D71B8" />
                </TouchableOpacity>
            </View>
            <Text style={styles.sectionText}>
                {recordingUri
                    ? `Recording length: ${formatTime(playbackDuration)}`
                    : "Recording not available"}
            </Text>
            <View style={styles.controls}>
                <TouchableOpacity
                    style={styles.skipButton}
                    onPress={() => onSeekBy(-15)}
                    disabled={!hasSound}
                >
                    <Ionicons name="play-skip-back" size={16} color="#1D71B8" />
                    <Text style={styles.skipButtonText}>15s</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.playButton}
                    onPress={onTogglePlayback}
                    disabled={!recordingUri || audioLoading}
                >
                    <Ionicons
                        name={isPlaying ? "pause" : "play"}
                        size={18}
                        color="#FFFFFF"
                    />
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.skipButton}
                    onPress={() => onSeekBy(15)}
                    disabled={!hasSound}
                >
                    <Ionicons name="play-skip-forward" size={16} color="#1D71B8" />
                    <Text style={styles.skipButtonText}>15s</Text>
                </TouchableOpacity>
            </View>
            <View style={styles.progressRow}>
                <Text style={styles.timeText}>{formatTime(playbackPosition)}</Text>
                <Pressable
                    style={styles.progressBar}
                    onLayout={onProgressBarLayout}
                    onPress={(e) => {
                        if (progressBarWidth) {
                            onSeekTo(e.nativeEvent.locationX / progressBarWidth);
                        }
                    }}
                >
                    <View
                        style={[styles.progressFill, { width: `${progressPercent}%` }]}
                    />
                </Pressable>
                <Text style={styles.timeText}>{formatTime(playbackDuration)}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    section: {
        marginBottom: 20,
    },
    headerRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 8,
    },
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
    shareButton: {
        padding: 8,
    },
    sectionText: {
        fontSize: 13,
        color: "#64748B",
        marginBottom: 12,
    },
    controls: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
        marginBottom: 12,
    },
    skipButton: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingVertical: 8,
        paddingHorizontal: 12,
    },
    skipButtonText: {
        fontSize: 14,
        color: "#1D71B8",
        fontWeight: "600",
    },
    playButton: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: "#1D71B8",
        alignItems: "center",
        justifyContent: "center",
    },
    progressRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    timeText: {
        fontSize: 12,
        color: "#64748B",
        minWidth: 36,
    },
    progressBar: {
        flex: 1,
        height: 6,
        backgroundColor: "#E2E8F0",
        borderRadius: 3,
        overflow: "hidden",
    },
    progressFill: {
        height: "100%",
        backgroundColor: "#1D71B8",
        borderRadius: 3,
    },
});
