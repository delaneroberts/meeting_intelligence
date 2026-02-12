// ---- General UI helpers ----

function resetUI() {
    clearError();

    progressSection.style.display = "none";
    progressBar.style.width = "0%";
    progressPercent.textContent = "0%";
    progressLabel.textContent = "Starting…";

    resultsSection.style.display = "none";
    languageInfo.style.display = "none";
    languageText.textContent = "";
    summaryText.textContent = "";
    actionItemsList.innerHTML = "";
    transcriptText.textContent = "";
    transcriptFileInfo.textContent = "";
    clearTranslationStatus();
    setTranslationEnabled(false);
    // Hide post actions
    if (postActions) postActions.style.display = "none";
    if (downloadPdfBtn) downloadPdfBtn.href = "#";
    if (discardBtn) discardBtn.onclick = null;
}

function showError(message) {
    if (errorBox) errorBox.style.display = "block";
    if (errorMessage) {
        errorMessage.textContent = message || "An unknown error occurred.";
    }
    updateRetryVisibility();
}

function clearError() {
    if (errorBox) errorBox.style.display = "none";
    if (errorMessage) errorMessage.textContent = "";
    if (retryBtn) retryBtn.style.display = "none";
}

function setProcessingState(isProcessing) {
    if (processBtn) processBtn.disabled = isProcessing;
    if (audioFileInput) audioFileInput.disabled = isProcessing;
}

function updateTranslationStatus(message, isError = false) {
    if (!translationStatus) return;
    translationStatus.style.display = "block";
    const className = isError ? "text-danger" : "text-success";
    translationStatus.innerHTML = `<small class="${className}">${message}</small>`;
}

function clearTranslationStatus() {
    if (!translationStatus) return;
    translationStatus.style.display = "none";
    translationStatus.textContent = "";
}

function showTranslationLoading() {
    if (!translationStatus) return;
    translationStatus.style.display = "block";
    translationStatus.innerHTML = `
        <small class="text-muted">
            <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
            Translating...
        </small>
    `;
}

function updateCurrentLanguageLabel(language) {
    if (!currentLanguageLabel) return;
    if (!language) {
        currentLanguageLabel.style.display = "none";
        currentLanguageLabel.textContent = "";
        return;
    }
    currentLanguageLabel.textContent = `Currently showing: ${language}`;
    currentLanguageLabel.style.display = "block";
}

function setTranslationEnabled(enabled) {
    if (translationControls) {
        translationControls.style.display = enabled ? "block" : "none";
    }
    if (translateBtn) translateBtn.disabled = !enabled;
    if (targetLanguageSelect) {
        targetLanguageSelect.disabled = !enabled;
        if (!enabled) {
            targetLanguageSelect.value = "";
        }
    }
}

function updateRetryVisibility() {
    if (!retryBtn) return;
    const hasFile = audioFileInput && audioFileInput.files && audioFileInput.files.length > 0;
    retryBtn.style.display = hasFile ? "inline-flex" : "none";
}

if (retryBtn) {
    retryBtn.addEventListener("click", () => {
        if (audioFileInput && audioFileInput.files && audioFileInput.files.length > 0 && uploadForm) {
            uploadForm.requestSubmit();
            return;
        }
        showError("Please choose an audio file first.");
    });
}

async function safeParseJson(response) {
    try {
        return await response.json();
    } catch (err) {
        return null;
    }
}

function setProgress(percent, label) {
    progressSection.style.display = "block";
    progressBar.style.width = `${percent}%`;
    progressPercent.textContent = `${percent}%`;
    if (label) {
        progressLabel.textContent = label;
    }
}
