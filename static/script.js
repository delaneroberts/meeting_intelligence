// DOM elements


const uploadForm = document.getElementById("uploadForm");
const audioFileInput = document.getElementById("audioFile");
const processBtn = document.getElementById("processBtn");
const openTranscriptsBtn = document.getElementById("openTranscriptsBtn");

const progressSection = document.getElementById("progressSection");
const progressBar = document.getElementById("progressBar");
const progressLabel = document.getElementById("progressLabel");
const progressPercent = document.getElementById("progressPercent");

const errorBox = document.getElementById("errorBox");

const resultsSection = document.getElementById("resultsSection");
const languageInfo = document.getElementById("languageInfo");
const languageText = document.getElementById("languageText");
const summaryText = document.getElementById("summaryText");
const actionItemsList = document.getElementById("actionItemsList");
const transcriptText = document.getElementById("transcriptText");
const transcriptFileInfo = document.getElementById("transcriptFileInfo");

// Copy buttons
const copySummaryBtn = document.getElementById("copySummaryBtn");
const copyTranscriptBtn = document.getElementById("copyTranscriptBtn");

// Translation elements
const translationControls = document.getElementById("translationControls");
const targetLanguageSelect = document.getElementById("targetLanguageSelect");
const translateBtn = document.getElementById("translateBtn");
const translationStatus = document.getElementById("translationStatus");

// Post-processing actions (PDF / discard)
const postActions = document.getElementById("postActions");
const downloadPdfBtn = document.getElementById("downloadPdfBtn");
const discardBtn = document.getElementById("discardBtn");

// Agenda elements
const agendaBtn = document.getElementById("agendaBtn");
const agendaStatus = document.getElementById("agendaStatus");
const agendaModal = new bootstrap.Modal(document.getElementById("agendaModal"));
const agendaTextArea = document.getElementById("agendaTextArea");
const agendaFile = document.getElementById("agendaFile");
const agendaSaveBtn = document.getElementById("agendaSaveBtn");
const agendaClearBtn = document.getElementById("agendaClearBtn");

// Live recording elements
const recordBtn = document.getElementById("recordBtn");
const pauseBtn = document.getElementById("pauseBtn");
const stopBtn = document.getElementById("stopBtn");
const liveStatus = document.getElementById("liveStatus");

// Auto-detect Q&A panel elements
const autoQAPanel = document.getElementById("autoQAPanel");
const autoQAToggle = document.getElementById("autoQAToggle");
const autoQAList = document.getElementById("autoQAList");
const autoQACount = document.getElementById("autoQACount");

// Store current agenda in memory
let currentAgenda = "";

// Store original and translated content
let currentMeetingData = {
  originalLanguage: "English",
  originalSummary: "",
  originalTranscript: "",
  englishSummary: "",
  englishTranscript: "",
  actionItems: [],
  currentDisplayLanguage: "English" // Track what language is currently displayed
};

// ---- Agenda management ----

function updateAgendaStatus() {
  if (currentAgenda.trim()) {
    const itemCount = currentAgenda.trim().split("\n").filter(line => line.trim()).length;
    agendaStatus.textContent = `✓ Agenda set (${itemCount} items)`;
    agendaStatus.classList.remove("text-danger");
    agendaStatus.classList.add("text-success");
  } else {
    agendaStatus.textContent = "No agenda";
    agendaStatus.classList.remove("text-success");
    agendaStatus.classList.add("text-muted");
  }
}

agendaBtn.addEventListener("click", () => {
  // Reset form when opening modal
  agendaTextArea.value = currentAgenda;
  agendaFile.value = "";
  agendaModal.show();
});

agendaSaveBtn.addEventListener("click", async () => {
  // Check if text input has content
  const textContent = agendaTextArea.value.trim();

  if (textContent) {
    currentAgenda = textContent;
    updateAgendaStatus();
    agendaModal.hide();
    return;
  }

  // Check if file was uploaded
  if (agendaFile.files.length > 0) {
    const file = agendaFile.files[0];

    if (file.type === "application/pdf") {
      // For PDF, we'd need a library to parse it. For now, show a message.
      showError("PDF parsing is not yet supported. Please paste the content as text.");
      return;
    }

    try {
      const content = await file.text();
      currentAgenda = content;
      updateAgendaStatus();
      agendaModal.hide();
    } catch (err) {
      showError("Could not read the agenda file: " + err.message);
    }
  } else {
    showError("Please enter agenda items or upload a file.");
  }
});

agendaClearBtn.addEventListener("click", () => {
  currentAgenda = "";
  agendaTextArea.value = "";
  agendaFile.value = "";
  updateAgendaStatus();
  agendaModal.hide();
});

// Initialize agenda status
updateAgendaStatus();

// ---- General UI helpers ----

function resetUI() {
  errorBox.style.display = "none";
  errorBox.textContent = "";

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
  // Hide post actions
  if (postActions) postActions.style.display = "none";
  if (downloadPdfBtn) downloadPdfBtn.href = "#";
  if (discardBtn) discardBtn.onclick = null;
}

function showError(message) {
  errorBox.style.display = "block";
  errorBox.textContent = message || "An unknown error occurred.";
}

function setProgress(percent, label) {
  progressSection.style.display = "block";
  progressBar.style.width = `${percent}%`;
  progressPercent.textContent = `${percent}%`;
  if (label) {
    progressLabel.textContent = label;
  }
}

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
    setProgress(5, initialLabel);

    // Add agenda to form data if present
    if (currentAgenda.trim()) {
      formData.append("agenda", currentAgenda);
    }

    const response = await fetch("/process", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      let message = `Server error: ${response.status}`;
      try {
        const data = await response.json();
        if (data && data.error) {
          message = data.error;
        }
      } catch (_) {
        // ignore JSON errors
      }
      setProgress(0, "Error");
      showError(message);
      return;
    }

    setProgress(60, transcribingLabel);

    const data = await response.json();

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

    // Update results
    resultsSection.style.display = "block";

    // Display language information if available
    if (data.original_language && data.original_language !== "English") {
      languageInfo.style.display = "block";
      languageText.textContent = `🌐 Meeting language: ${data.original_language}`;

      // Show translation controls for non-English meetings
      translationControls.style.display = "block";
      targetLanguageSelect.value = ""; // Reset selection
    } else {
      languageInfo.style.display = "none";
      translationControls.style.display = "none";
    }

    // Display the original language content
    summaryText.textContent = currentMeetingData.originalSummary;
    transcriptText.textContent = currentMeetingData.originalTranscript;

    actionItemsList.innerHTML = "";
    if (Array.isArray(currentMeetingData.actionItems) && currentMeetingData.actionItems.length > 0) {
      currentMeetingData.actionItems.forEach((item) => {
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

// ---- Live recording via MediaRecorder ----

let mediaRecorder = null;
let recordedChunks = [];
let recordingStream = null;

// Live transcript for current recording
let currentLiveTranscript = "";

// Auto-detect Q&A state
let detectedQuestions = []; // Array of {question, answer, isRhetorical}
let lastProcessedTranscriptLength = 0;
let autoQAPanelCollapsed = false;
let autoDetectionInterval = null;

function setLiveStatus(message) {
  liveStatus.textContent = message || "";
}

function setLiveButtonsState({ canRecord, canPause, canStop }) {
  recordBtn.disabled = !canRecord;
  pauseBtn.disabled = !canPause;
  stopBtn.disabled = !canStop;
  coachBtn.disabled = !canStop; // Coach button enabled only when recording
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
      autoDetectionInterval = setInterval(() => {
        detectAndAnswerQuestions();
      }, 8000);

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
    }; mediaRecorder.onpause = () => {
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

// ---- Translation functionality ----
translateBtn.addEventListener("click", async () => {
  const targetLanguage = targetLanguageSelect.value;

  if (!targetLanguage) {
    alert("Please select a target language");
    return;
  }

  if (!currentMeetingData.englishSummary || !currentMeetingData.englishTranscript) {
    alert("No meeting data to translate");
    return;
  }

  translationStatus.style.display = "block";
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

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Translation failed");
    }

    const data = await response.json();

    // Update the display with translated content
    summaryText.textContent = data.translated_summary;
    transcriptText.textContent = data.translated_transcript;
    currentMeetingData.currentDisplayLanguage = targetLanguage;

    // Show success message
    translationStatus.innerHTML = `<small class="text-success">✓ Translated to ${targetLanguage}</small>`;
    setTimeout(() => {
      translationStatus.style.display = "none";
    }, 3000);

  } catch (err) {
    console.error("Translation error:", err);
    translationStatus.innerHTML = `<small class="text-danger">✗ Translation failed: ${err.message}</small>`;
  } finally {
    translateBtn.disabled = false;
    targetLanguageSelect.disabled = false;
  }
});

// ---- Copy button functionality ----
function copyToClipboard(text, button) {
  navigator.clipboard.writeText(text).then(() => {
    const originalText = button.textContent;
    button.textContent = "✓ Copied!";
    button.classList.add("btn-success");
    button.classList.remove("btn-outline-secondary");

    setTimeout(() => {
      button.textContent = originalText;
      button.classList.remove("btn-success");
      button.classList.add("btn-outline-secondary");
    }, 2000);
  }).catch(err => {
    console.error("Failed to copy:", err);
    alert("Failed to copy to clipboard. Try again.");
  });
}

copySummaryBtn.addEventListener("click", () => {
  if (summaryText.textContent) {
    copyToClipboard(summaryText.textContent, copySummaryBtn);
  } else {
    alert("No summary to copy yet.");
  }
});

copyTranscriptBtn.addEventListener("click", () => {
  if (transcriptText.textContent) {
    copyToClipboard(transcriptText.textContent, copyTranscriptBtn);
  } else {
    alert("No transcript to copy yet.");
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
