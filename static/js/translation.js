// ---- Translation functionality ----
translateBtn.addEventListener("click", async () => {
    const targetLanguage = targetLanguageSelect.value;

    if (!targetLanguage) {
        updateTranslationStatus("✗ Please select a target language.", true);
        return;
    }

    if (!currentMeetingData.englishSummary || !currentMeetingData.englishTranscript) {
        updateTranslationStatus("✗ No meeting data to translate yet.", true);
        return;
    }

    if (targetLanguage.toLowerCase() === "english") {
        summaryText.textContent = currentMeetingData.englishSummary;
        transcriptText.textContent = currentMeetingData.englishTranscript;
        currentMeetingData.currentDisplayLanguage = "English";
        updateCurrentLanguageLabel(currentMeetingData.currentDisplayLanguage);
        updateTranslationStatus("✓ Translated to English");
        setTimeout(() => {
            clearTranslationStatus();
        }, 3000);
        return;
    }

    showTranslationLoading();
    translateBtn.disabled = true;
    targetLanguageSelect.disabled = true;

    try {
        const response = await fetch("/translate_content", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                summary: currentMeetingData.englishSummary,
                transcript: currentMeetingData.englishTranscript,
                target_language: targetLanguage,
            }),
        });

        const data = await safeParseJson(response);
        if (!response.ok) {
            const message = data && data.error ? data.error : "Translation failed";
            throw new Error(message);
        }

        if (!data) {
            throw new Error("Unexpected translation response.");
        }

        // Update the display with translated content
        summaryText.textContent = data.translated_summary;
        transcriptText.textContent = data.translated_transcript;
        currentMeetingData.currentDisplayLanguage = targetLanguage;
        updateCurrentLanguageLabel(currentMeetingData.currentDisplayLanguage);

        // Show success message
        updateTranslationStatus(`✓ Translated to ${targetLanguage}`);
        setTimeout(() => {
            clearTranslationStatus();
        }, 3000);

    } catch (err) {
        console.error("Translation error:", err);
        updateTranslationStatus(`✗ Translation failed: ${err.message}`, true);
    } finally {
        translateBtn.disabled = false;
        targetLanguageSelect.disabled = false;
    }
});
