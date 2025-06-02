// ! Variables
const playButton = document.getElementById("playButton");
const pauseButton = document.getElementById("pauseButton");
const playPauseButton = document.getElementById("play-pause");
const loopButton = document.getElementById("loop");
const zoomSlider = document.getElementById("zoom-range");
const speedDownButton = document.getElementById("decrease-speed");
const speedUpButton = document.getElementById("increase-speed");
// const pitchDownButton = document.getElementById("decrease-pitch");
// const pitchUpButton = document.getElementById("increase-pitch");
const addNewAudioButton = document.getElementById("addNewAudioButton");
const downloadAudioButton = document.getElementById("downloadAudioButton");
const showPianoButton = document.getElementById("showPianoButton");
const mainContainer = document.getElementById("mainContainer");

let fileIsLoaded = false;
let masterClickTime = null;
let masterLoopStartTime = null;
let masterLoopEndTime = null;
let masterLoopRegion = null;
let loopStart = null;
let currentZoom = 0;

const thumbAndTitleZone = document.getElementById("thumb-and-title-zone");
thumbAndTitleZone.classList.add("hidden");
document.getElementById("piano-body").setAttribute("hidden", true);

//!SECTION END

//*NOTE - Menu Links

document.addEventListener("DOMContentLoaded", function () {
  const body = document.body;
  const themeSwitcherButton = document.getElementById("theme-switcher");
  const h1 = document.getElementById("headerText");
  const headerIcon = document.getElementById("headerIcon");

  themeSwitcherButton.addEventListener("click", function (e) {
    e.preventDefault();

    if (body.classList.contains("theme1")) {
      body.classList.remove("theme1");
      body.classList.add("theme2");
      // h1.classList.add("text-gray-100");
      // headerIcon.classList.add("text-gray-100");
    } else {
      body.classList.remove("theme2");
      body.classList.add("theme1");
      // h1.classList.remove("text-gray-100");
      // headerIcon.classList.remove("text-gray-100");
    }
  });
  document.activeElement.blur();
});

let audioFile = "";

downloadAudioButton.addEventListener("click", async () => {
  const title = document.getElementById("video-title").textContent.trim();
  const sanitizedTitle = title.replace(/[^a-z0-9]/gi, "_").toLowerCase();

  const audioResponse = await fetch(`/audio/${audioFile}`);
  const blob = await audioResponse.blob();

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);

  // Extract extension from filename (e.g., "audio.m4a" → ".m4a")
  const ext = audioFile.split(".").pop();
  a.download = `${sanitizedTitle || "audio"}.${ext}`;

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
});

document.addEventListener("DOMContentLoaded", function () {
  const zenButton = document.getElementById("zen-mode");

  zenButton.addEventListener("click", function (event) {
    event.preventDefault();

    const docElm = document.documentElement;

    if (
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    ) {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    } else {
      if (docElm.requestFullscreen) {
        docElm.requestFullscreen();
      } else if (docElm.mozRequestFullScreen) {
        docElm.mozRequestFullScreen();
      } else if (docElm.webkitRequestFullscreen) {
        docElm.webkitRequestFullscreen();
      } else if (docElm.msRequestFullscreen) {
        docElm.msRequestFullscreen();
      }
    }

    // Blur so focus doesn't stay on menu item
    document.activeElement.blur();
  });

  // Track fullscreen status
  document.addEventListener("fullscreenchange", function () {
    const zenButton = document.getElementById("zen-mode");
    if (document.fullscreenElement) {
      zenButton.classList.add("bg-blue-400", "text-black");
      mainContainer.classList.add("mt-16");
      document.getElementById("dropdownMenu").removeAttribute("open");
    } else {
      zenButton.classList.remove("bg-blue-400", "text-black");
      mainContainer.classList.remove("mt-16");
      document.getElementById("dropdownMenu").removeAttribute("open");
    }
  });
});

// Section end

function checkFileIfLoaded() {
  if (fileIsLoaded === false) {
    speedDownButton.disabled = true;
    speedUpButton.disabled = true;
    // pitchDownButton.disabled = true;
    // pitchUpButton.disabled = true;
    playPauseButton.disabled = true;
    playButton.disabled = true;
    loopButton.disabled = true;
    zoomSlider.disabled = true;
    showPianoButton.disabled = true;
  }
  if (fileIsLoaded === true) {
    speedDownButton.disabled = false;
    speedUpButton.disabled = false;
    // pitchDownButton.disabled = false;
    // pitchUpButton.disabled = false;
    playPauseButton.disabled = false;
    playButton.disabled = false;
    loopButton.disabled = false;
    zoomSlider.disabled = false;
    showPianoButton.disabled = false;
  }
}

function updateZoomSlider(value) {
  document.getElementById("zoom-range").value = value;
  document.getElementById("zoom-display").textContent = `${value}%`;
}

updateZoomSlider(currentZoom);
checkFileIfLoaded();

document.getElementById("load-audio").addEventListener("click", async () => {
  checkFileIfLoaded();
  document.getElementById("loading-indicator").style.display = "block"; // Show loading
  document.getElementById("load-audio").style.backgroundColor = "gray";
  document.getElementById("load-audio").style.cursor = "not-allowed";
  document.getElementById("load-audio").disabled = true; // Disable the button functionality
  let youtubeUrl = document.getElementById("youtube-url").value;

  const response = await fetch("/get_audio", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url: youtubeUrl }),
  });

  if (response.ok) {
    const data = await response.json();

    audioFile = data.audio_file;

    document.getElementById("video-title").textContent = data.title;
    document.getElementById("video-thumbnail").src = data.thumbnail;

    const audioResponse = await fetch(`/audio/${audioFile}`);
    const audioBlob = await audioResponse.blob();

    let audioUrl = URL.createObjectURL(audioBlob);
    wavesurfer.load(audioUrl);

    fileIsLoaded = true;

    document.getElementById("loading-zone").hidden = true;
    document.getElementById("thumb-and-title-zone").classList.remove("hidden");
  } else {
    alert("Failed to load audio");
    fileIsLoaded = false;
  }

  document.getElementById("load-audio").style.backgroundColor = "#028090";
  document.getElementById("load-audio").style.cursor = "pointer";
  document.getElementById("load-audio").disabled = false;
  document.getElementById("loading-indicator").style.display = "none";
  checkFileIfLoaded();
});

let wavesurfer = WaveSurfer.create({
  container: "#waveform",
  waveColor: "#083172",
  progressColor: "grey",
  backend: "MediaElement",
  autoCenter: false,
  plugins: [
    WaveSurfer.timeline.create({
      container: "#wave-timeline", // Reference the timeline container
      timeInterval: 1, // Time interval for the grid (in seconds)
      primaryLabelInterval: 10, // Label every 10 seconds
      secondaryLabelInterval: 5, // Smaller tick marks every 5 seconds
    }),
    WaveSurfer.regions.create(),
  ],
});

addNewAudioButton.addEventListener("click", () => {
  document.getElementById("thumb-and-title-zone").classList.add("hidden");
  document.getElementById("loading-zone").hidden = false;
});
// ANCHOR #####################################################
//*********************LOOP START**************************** */

wavesurfer.on("seek", (progress) => {
  const clickTime = wavesurfer.getDuration() * progress;
  masterClickTime = clickTime;
  loopStart = clickTime;
  masterLoopStartTime = loopStart;
});

let loopRegion = null;

// Toggle loop region creation/removal
loopButton.addEventListener("click", () => {
  wavesurfer.on("region-update-end", (region) => {
    // Update masterClickTime when the region is dragged
    if (loopRegion && region.id === loopRegion.id) {
      masterClickTime = region.start; // Update masterClickTime to the new start of the loop region
      loopStart = region.start; // Also update loopStart for consistency
    }
  });
  if (loopRegion) {
    // Clear the loop region if it exists
    loopRegion.remove();
    loopRegion = null;
    loopStart = masterClickTime;
    loopEnd = masterLoopEndTime;

    // Change button text and color back to "Loop Section"
    loopButton.textContent = "Loop Section";
    loopButton.style.backgroundColor = "#028090"; // Original color
  } else if (loopStart !== null) {
    // Create a loop region if none exists
    const duration = wavesurfer.getDuration();
    loopEnd = Math.min(loopStart + 5, duration); // Default 5-second loop region

    loopRegion = wavesurfer.addRegion({
      start: masterClickTime,
      end: loopEnd,
      color: "rgba(0, 255, 0, 0.2)", // Green semi-transparent region
      drag: true, // Allow dragging the region
      resize: true, // Allow resizing the region
      loop: true, // Enable looping
    });

    // Change button text and color to indicate the loop is set
    loopButton.textContent = "Clear Loop";
    loopButton.style.backgroundColor = "red"; // Change color to indicate active loop
  } else {
    alert("Set a marker on the waveform before creating a loop!"); // Inform the user if no loop start is set
  }
  document.activeElement.blur();
});

// ANCHOR #####################################################
//*********************LOOP END**************************** */

let isPaused = true;

function togglePlayPause() {
  if (!isPaused) {
    playButton.classList.add("hidden");
    pauseButton.classList.remove("hidden");
    pauseButton.classList.add("show");
  } else {
    playButton.classList.remove("hidden");
    playButton.classList.add("show");
    pauseButton.classList.add("hidden");
  }
  // isPaused = !isPaused; // Toggle the state
}

//! Add spacebar event for play/pause and seek to loopStart
document.body.onkeyup = function (e) {
  if (e.keyCode == 32) {
    if (wavesurfer.isPlaying()) {
      wavesurfer.pause();
      isPaused = true;
      togglePlayPause();
      if (loopStart !== null) {
        wavesurfer.seekTo(loopStart / wavesurfer.getDuration()); // Move the cursor back to loopStart
      }
    } else {
      if (loopRegion) {
        wavesurfer.play(loopStart);
      } else if (loopStart !== null && isPaused) {
        wavesurfer.play(loopStart);
        isPaused = false;
        togglePlayPause();
        // if (player.state === "started") {
        //   player.stop();
        // } else {
        //   player.start();
        // }
      } else if (loopStart == null && isPaused) {
        loopStart = 0;
        wavesurfer.play();
        isPaused = false;
        togglePlayPause();
      } else {
        wavesurfer.playPause();
        togglePlayPause();
      }
    }
  }
};

document.getElementById("play-pause").addEventListener("click", () => {
  if (wavesurfer.isPlaying()) {
    wavesurfer.pause();
    isPaused = true;
    togglePlayPause();
  } else {
    wavesurfer.play();
    isPaused = false;
    togglePlayPause();
  }
  document.activeElement.blur();
});

document.addEventListener("keydown", function (e) {
  if (!fileIsLoaded) return;

  const currentTime = wavesurfer.getCurrentTime();
  const duration = wavesurfer.getDuration();

  if (e.key === "ArrowLeft") {
    e.preventDefault();
    const newTime = Math.max(0, currentTime - 0.5);
    wavesurfer.setCurrentTime(newTime);
  }

  if (e.key === "ArrowRight") {
    e.preventDefault();
    const newTime = Math.min(duration, currentTime + 0.5);
    wavesurfer.setCurrentTime(newTime);
  }
});

//* Speed control ///////////////////////////////

let currentSpeed = 1.0;

// Function to update the speed display
function updateSpeedDisplay() {
  document.getElementById("speed-display").textContent = `${Math.round(
    currentSpeed * 100
  )}%`;
}

// Event listener for decreasing the speed
document.getElementById("decrease-speed").addEventListener("click", () => {
  if (currentSpeed > 0.1) {
    // Ensure speed doesn't go below 10%
    currentSpeed = Math.max(0.1, currentSpeed - 0.1);
    wavesurfer.setPlaybackRate(currentSpeed);
    updateSpeedDisplay();
  }
  document.activeElement.blur();
});

// Event listener for increasing the speed
document.getElementById("increase-speed").addEventListener("click", () => {
  if (currentSpeed < 2.0) {
    // Ensure speed doesn't go above 200%
    currentSpeed = Math.min(2.0, currentSpeed + 0.1);
    wavesurfer.setPlaybackRate(currentSpeed);
    updateSpeedDisplay();
  }
  document.activeElement.blur();
});

//* Function to update the zoom display and wheel functionality

document.getElementById("waveform").addEventListener("wheel", (e) => {
  if (fileIsLoaded) {
    e.preventDefault(); // Prevent default scrolling behavior

    // Adjust zoom level based on scroll direction
    currentZoom = Math.max(
      0,
      Math.min(100, currentZoom + (e.deltaY < 0 ? 10 : -10))
    );

    // Apply zoom level, scaled for better visibility at low levels
    let scaledZoom = currentZoom * 5; // 10% zoom becomes 50px/sec, 100% becomes 500px/sec
    wavesurfer.zoom(scaledZoom);

    // Update the zoom slider
    updateZoomSlider(currentZoom);
  }
});

//* Function to update zoom based on the slider input
document.getElementById("zoom-range").addEventListener("input", (event) => {
  currentZoom = Math.max(0, Math.min(100, event.target.value)); // Limit zoom between 10% and 100%
  wavesurfer.zoom(currentZoom * 2.5); // Scale the zoom for visibility
  updateZoomSlider(currentZoom);
  document.activeElement.blur();
});

updateSpeedDisplay();

//ANCHOR ######################################################################
// *PIANO ####################################################################
const WHITE_KEYS = ["z", "x", "c", "v", "b", "n", "m"];
const BLACK_KEYS = ["s", "d", "g", "h", "j"];

const keys = document.querySelectorAll(".key");
const whiteKeys = document.querySelectorAll(".key.white");
const blackKeys = document.querySelectorAll(".key.black");

keys.forEach((key) => {
  key.addEventListener("click", () => playNote(key));
});

document.addEventListener("keydown", (e) => {
  if (fileIsLoaded) {
    if (e.repeat) return;
    const key = e.key;
    const whiteKeyIndex = WHITE_KEYS.indexOf(key);
    const blackKeyIndex = BLACK_KEYS.indexOf(key);

    if (whiteKeyIndex > -1) playNote(whiteKeys[whiteKeyIndex]);
    if (blackKeyIndex > -1) playNote(blackKeys[blackKeyIndex]);
  }
});

function playNote(key) {
  if (fileIsLoaded) {
    const noteAudio = document.getElementById(key.dataset.note);
    noteAudio.currentTime = 0;
    noteAudio.play().catch((error) => {
      console.error("Audio playback failed:", error);
    });
    key.classList.add("active");
    noteAudio.addEventListener("ended", () => {
      key.classList.remove("active");
    });
  }
}

showPianoButton.addEventListener("click", function () {
  const pianoBody = document.getElementById("piano-body");

  // Toggle the 'show' class
  if (pianoBody.classList.contains("show")) {
    pianoBody.classList.remove("show");
    showPianoButton.style.display = "block";
  } else {
    pianoBody.classList.add("show");
  }
  showPianoButton.blur();
});
//* Pitch controls ###########################################################
// Initialize the current pitch in semitones
// let currentPitch = 0; // Starting pitch at 0 semitones
// const maxPitch = 12; // Maximum of 12 semitones up
// const minPitch = -12; // Minimum of 12 semitones down

// const pitchDisplay = document.getElementById("pitch-display");

// // Create the Tone.js PitchShift node
// const pitchShift = new Tone.PitchShift({
//   pitch: currentPitch, // Set the starting pitch shift to 0 semitones
//   wet: 1, // Fully apply pitch shift effect
// });

// // Function to update the pitch shift in real-time
// function applyPitchShift() {
//   pitchShift.pitch = currentPitch; // Update the pitch shift in semitones
// }

// // Event listener for increasing the pitch
// pitchUpButton.addEventListener("click", () => {
//   if (currentPitch < maxPitch) {
//     currentPitch += 1; // Increase pitch by one semitone
//     applyPitchShift(); // Apply the new pitch shift
//     updatePitchDisplay(); // Update the display
//     document.activeElement.blur();
//   }
// });

// // Event listener for decreasing the pitch
// pitchDownButton.addEventListener("click", () => {
//   if (currentPitch > minPitch) {
//     currentPitch -= 1; // Decrease pitch by one semitone
//     applyPitchShift(); // Apply the new pitch shift
//     updatePitchDisplay(); // Update the display
//     document.activeElement.blur();
//   }
// });

// // Function to update the pitch display
// function updatePitchDisplay() {
//   pitchDisplay.textContent = `${currentPitch} st`; // Display the current pitch in semitones
// }

// Get the WaveSurfer audio context and apply the pitch shift after the audio is loaded
// wavesurfer.on("ready", () => {
//   const waveSurferAudioContext = wavesurfer.backend.getAudioContext();
//   const mediaElement = wavesurfer.backend.media;

//   // Create a MediaElementSource from the WaveSurfer's media element
//   const source = waveSurferAudioContext.createMediaElementSource(mediaElement);

//   // Connect the media element to the PitchShift node and then to the destination (speakers)
//   source.connect(pitchShift).toDestination();
// });
// /
