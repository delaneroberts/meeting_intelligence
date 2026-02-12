// ---- Live recording via MediaRecorder ----

function setLiveStatus(message) {
    liveStatus.textContent = message || "";
}

function setLiveButtonsState({ canRecord, canPause, canStop }) {
    recordBtn.disabled = !canRecord;
    pauseBtn.disabled = !canPause;
    stopBtn.disabled = !canStop;
    if (coachBtn) {
        coachBtn.disabled = !canStop; // Coach button enabled only when recording
    }
}

// ---- Auto-detect Q&A functionality ----

function updateAutoQADisplay() {
    if (detectedQuestions.length === 0) {
        autoQAPanel.style.display = "none";
    } else {
        autoQAPanel.style.display = "block";
        autoQACount.textContent = `(${detectedQuestions.length})`;

        autoQAList.innerHTML = "";
        detectedQuestions.forEach((qa, idx) => {
            const qaItem = document.createElement("div");
            qaItem.style.cssText = "margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #e9ecef;";

            const rhetoLabel = qa.isRhetorical ? '<span class="badge bg-warning-subtle text-warning-emphasis ms-2">Rhetorical</span>' : '';

            qaItem.innerHTML = `
        <div style="margin-bottom: 6px;">
          <strong style="font-size: 0.95rem;">Q${idx + 1}:</strong> <span style="font-size: 0.95rem;">${escapeHtml(qa.question)}</span>${rhetoLabel}
        </div>
        <div style="margin-left: 20px; font-size: 0.9rem; color: #495057;">
          <strong>A:</strong> ${escapeHtml(qa.answer)}
        </div>
      `;

            autoQAList.appendChild(qaItem);
        });

        // Auto-scroll to bottom
        autoQAList.scrollTop = autoQAList.scrollHeight;
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Toggle auto Q&A panel collapse
autoQAToggle.addEventListener("click", () => {
    autoQAPanelCollapsed = !autoQAPanelCollapsed;
    autoQAList.style.display = autoQAPanelCollapsed ? "none" : "block";
    autoQAToggle.textContent = autoQAPanelCollapsed ? "▶ Meeting Q&A" : "▼ Meeting Q&A";
});

async function detectAndAnswerQuestions() {
    const newTranscript = currentLiveTranscript.substring(lastProcessedTranscriptLength);

    if (newTranscript.trim().length < 20) {
        // Not enough new content to process
        console.log("Auto-detect: Not enough content yet", newTranscript.trim().length, "chars");
        return;
    }

    console.log("Auto-detect: Processing", newTranscript.trim().length, "chars of new transcript");
    lastProcessedTranscriptLength = currentLiveTranscript.length;

    try {
        const response = await fetch("/detect_questions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                new_transcript: newTranscript,
                full_transcript: currentLiveTranscript,
            }),
        });

        if (!response.ok) {
            console.warn("Question detection failed:", response.status);
            return;
        }

        const data = await response.json();
        const questions = data.questions || [];

        console.log("Auto-detect: Found", questions.length, "questions");

        for (const q of questions) {
            // Check if we already have this question
            const isDuplicate = detectedQuestions.some(
                (existingQ) => existingQ.question.toLowerCase() === q.question.toLowerCase()
            );

            if (!isDuplicate) {
                console.log("Adding new question:", q.question);
                detectedQuestions.push({
                    question: q.question,
                    answer: q.answer,
                    isRhetorical: q.is_rhetorical || false,
                });
            }
        }

        if (questions.length > 0) {
            updateAutoQADisplay();
        }
    } catch (err) {
        console.error("Auto-detection error:", err);
    }
}

// Start a new recording
recordBtn.addEventListener("click", async () => {
    resetUI();
    currentLiveTranscript = ""; // Reset live transcript for coach

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showError("Live recording is not supported in this browser.");
        return;
    }

    try {
        recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });

        recordedChunks = [];
        mediaRecorder = new MediaRecorder(recordingStream);

        mediaRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };

        mediaRecorder.onstart = () => {
            setLiveStatus("Recording…");
            setLiveButtonsState({ canRecord: false, canPause: true, canStop: true });

            // Reset auto-detection state
            detectedQuestions = [];
            lastProcessedTranscriptLength = 0;
            autoQAPanelCollapsed = false;
            updateAutoQADisplay();

            // Start auto-detection interval (every 8 seconds)
            if (appSettings.auto_detect_qa !== false) {
                autoDetectionInterval = setInterval(() => {
                    detectAndAnswerQuestions();
                }, 8000);
            }

            // Start live transcription for coach
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (SpeechRecognition) {
                const liveRecognition = new SpeechRecognition();
                liveRecognition.continuous = true;
                liveRecognition.interimResults = true;
                liveRecognition.lang = "en-US";

                liveRecognition.onstart = () => {
                    console.log("Live transcription started");
                };

                liveRecognition.onresult = (event) => {
                    let interimTranscript = "";
                    for (let i = event.resultIndex; i < event.results.length; i++) {
                        const transcript = event.results[i][0].transcript;
                        if (event.results[i].isFinal) {
                            currentLiveTranscript += transcript + " ";
                            console.log("Live transcript updated:", currentLiveTranscript.length, "chars");
                        } else {
                            interimTranscript += transcript;
                        }
                    }
                };

                liveRecognition.onerror = (event) => {
                    // Silently handle errors for live transcription
                    console.warn("Live transcription error:", event.error);
                    // Try to restart on errors like "network" or "no-speech"
                    if (event.error === "network" || event.error === "no-speech") {
                        console.log("Attempting to restart live recognition...");
                        try {
                            setTimeout(() => {
                                if (mediaRecorder && mediaRecorder.state !== "inactive") {
                                    liveRecognition.start();
                                }
                            }, 1000);
                        } catch (e) {
                            console.warn("Could not restart:", e);
                        }
                    }
                };

                liveRecognition.onend = () => {
                    console.log("Live transcription ended");
                    // Restart if recording is still active
                    if (mediaRecorder && mediaRecorder.state !== "inactive") {
                        console.log("Restarting live transcription...");
                        try {
                            liveRecognition.start();
                        } catch (e) {
                            console.warn("Could not restart live recognition:", e);
                        }
                    }
                };

                try {
                    liveRecognition.start();
                    mediaRecorder.liveRecognition = liveRecognition; // Store reference to stop later
                } catch (err) {
                    console.error("Error starting live recognition:", err);
                }
            } else {
                console.warn("Speech Recognition not supported");
            }
        };

        mediaRecorder.onpause = () => {
            setLiveStatus("Recording paused.");
        };

        mediaRecorder.onresume = () => {
            setLiveStatus("Recording…");
        };

        mediaRecorder.onstop = async () => {
            setLiveStatus("Processing recording…");
            setLiveButtonsState({ canRecord: true, canPause: false, canStop: false });

            // Stop auto-detection
            if (autoDetectionInterval) {
                clearInterval(autoDetectionInterval);
                autoDetectionInterval = null;
            }

            if (recordingStream) {
                recordingStream.getTracks().forEach((track) => track.stop());
                recordingStream = null;
            }

            // Stop live transcription
            if (mediaRecorder.liveRecognition) {
                mediaRecorder.liveRecognition.stop();
                mediaRecorder.liveRecognition = null;
            }

            if (!recordedChunks.length) {
                showError("No audio was recorded.");
                setLiveStatus("");
                return;
            }

            const blob = new Blob(recordedChunks, { type: "audio/webm" });
            const file = new File([blob], "live_recording.webm", { type: "audio/webm" });

            const formData = new FormData();
            formData.append("audio_file", file);

            await processFormData(formData, "Uploading recording…", "Transcribing recording…");
            setLiveStatus("Recording processed.");
        };

        mediaRecorder.start();
    } catch (err) {
        console.error("Error starting recording:", err);
        showError("Could not access microphone. Check browser permissions.");
        setLiveButtonsState({ canRecord: true, canPause: false, canStop: false });
    }
});

// Pause / resume
pauseBtn.addEventListener("click", () => {
    if (!mediaRecorder) return;

    if (mediaRecorder.state === "recording") {
        mediaRecorder.pause();
        pauseBtn.textContent = "▶ Resume";
    } else if (mediaRecorder.state === "paused") {
        mediaRecorder.resume();
        pauseBtn.textContent = "⏸ Pause";
    }
});

// Stop and send
stopBtn.addEventListener("click", () => {
    if (!mediaRecorder) return;

    if (mediaRecorder.state === "recording" || mediaRecorder.state === "paused") {
        mediaRecorder.stop();
        pauseBtn.textContent = "⏸ Pause";
    }
});

// Initial state for live buttons
setLiveButtonsState({ canRecord: true, canPause: false, canStop: false });
setLiveStatus("");
