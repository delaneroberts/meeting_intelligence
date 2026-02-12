// ---- Upload existing audio file ----

uploadForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    resetUI();

    const file = audioFileInput.files[0];
    if (!file) {
        showError("Please choose an audio file first.");
        return;
    }

    const formData = new FormData();
    formData.append("audio_file", file);

    await processFormData(formData, "Uploading file…", "Transcribing audio…");
});

// ---- Process FormData (shared by upload + live recording) ----

async function processFormData(formData, initialLabel = "Processing…", transcribingLabel = "Transcribing…") {
    try {
        setProcessingState(true);
        clearError();
        clearTranslationStatus();
        setProgress(5, initialLabel);

        // Add agenda to form data if present
        if (currentAgenda.trim()) {
            formData.append("agenda", currentAgenda);
        }

        const response = await fetch("/process", {
            method: "POST",
            body: formData,
        });

        const parsed = await safeParseJson(response);

        if (!response.ok) {
            let message = `Server error: ${response.status}`;
            if (parsed && parsed.error) {
                message = parsed.error;
            }
            setProgress(0, "Error");
            showError(message);
            return;
        }

        setProgress(60, transcribingLabel);

        const data = parsed;

        if (!data) {
            setProgress(0, "Error");
            showError("Unexpected server response. Please try again.");
            return;
        }

        setProgress(100, "Done");
        progressSection.style.display = "block";

        if (data.error) {
            showError(data.error);
            return;
        }

        // Store the meeting data
        currentMeetingData.originalLanguage = data.original_language || "English";
        currentMeetingData.originalSummary = data.summary || "(No summary returned)";
        currentMeetingData.originalTranscript = data.transcript || "(No transcript)";
        currentMeetingData.englishSummary = data.english_summary || data.summary || "(No summary returned)";
        currentMeetingData.englishTranscript = data.english_transcript || data.transcript || "(No transcript)";
        currentMeetingData.actionItems = data.action_items || [];
        currentMeetingData.englishActionItems = data.english_action_items || data.action_items || [];
        currentMeetingData.currentDisplayLanguage = currentMeetingData.originalLanguage;
        updateCurrentLanguageLabel(currentMeetingData.currentDisplayLanguage);

        // Update results
        resultsSection.style.display = "block";

        // Display language information if available
        if (data.original_language) {
            languageInfo.style.display = "block";
            languageText.textContent = `🌐 Meeting language: ${data.original_language}`;
        } else {
            languageInfo.style.display = "none";
        }

        // Always enable translation controls so English meetings can be translated too
        setTranslationEnabled(true);

        // Display content based on settings
        const summaryPref = (appSettings.summary_language || "auto").toLowerCase();
        const transcriptPref = (appSettings.default_language || "auto").toLowerCase();

        summaryText.textContent =
            summaryPref === "english" && currentMeetingData.englishSummary
                ? currentMeetingData.englishSummary
                : currentMeetingData.originalSummary;

        transcriptText.textContent =
            transcriptPref === "english" && currentMeetingData.englishTranscript
                ? currentMeetingData.englishTranscript
                : currentMeetingData.originalTranscript;

        actionItemsList.innerHTML = "";
        const actionItemsToShow =
            summaryPref === "english" && Array.isArray(currentMeetingData.englishActionItems)
                ? currentMeetingData.englishActionItems
                : currentMeetingData.actionItems;

        if (Array.isArray(actionItemsToShow) && actionItemsToShow.length > 0) {
            actionItemsToShow.forEach((item) => {
                const li = document.createElement("li");
                li.textContent = item;
                actionItemsList.appendChild(li);
            });
        } else {
            const li = document.createElement("li");
            li.textContent = "(No action items found)";
            actionItemsList.appendChild(li);
        }

        if (data.transcript_file) {
            transcriptFileInfo.textContent = `Transcript saved as: ${data.transcript_file}`;
        } else {
            transcriptFileInfo.textContent = "";
        }

        // ---- NEW: Post-processing buttons (Download PDF + Discard) ----
        if (postActions && downloadPdfBtn && discardBtn && data.download_url && data.discard_url) {
            postActions.style.display = "block";

            // Download PDF
            downloadPdfBtn.href = data.download_url;

            // Discard results
            discardBtn.onclick = async () => {
                const ok = confirm("Discard transcript/summary/action items for this meeting? This cannot be undone.");
                if (!ok) return;

                try {
                    const resp = await fetch(data.discard_url, { method: "POST" });
                    if (!resp.ok) {
                        alert("Discard failed.");
                        return;
                    }
                    resetUI();
                    alert("Discarded.");
                } catch (e) {
                    console.error(e);
                    alert("Discard failed (network error).");
                }
            };
        } else if (postActions) {
            postActions.style.display = "none";
        }

    } catch (err) {
        console.error("Request failed:", err);
        setProgress(0, "Error");
        showError(err.message || "Network or server error.");
    } finally {
        setProcessingState(false);
    }
}

// ---- "Show transcript folder path" button ----

if (openTranscriptsBtn) {
    openTranscriptsBtn.addEventListener("click", () => {
        // This just shows a message. If you want, you can later add a small
        // endpoint that returns the path or open Finder via a custom scheme.
        alert("Transcripts are saved in the 'transcripts' folder inside your meeting_assistant project.");
    });
}
