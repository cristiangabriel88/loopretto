// ! Variables
const playButton = document.getElementById("playButton");
const pauseButton = document.getElementById("pauseButton");
const playPauseButton = document.getElementById("play-pause");
const loopButton = document.getElementById("loop");
const zoomSlider = document.getElementById("zoom-range");
const speedDownButton = document.getElementById("decrease-speed");
const speedUpButton = document.getElementById("increase-speed");

let fileIsLoaded = false;
let masterClickTime = null;
let masterLoopStartTime = null;
let masterLoopEndTime = null;
let masterLoopRegion = null;
let currentZoom = 0;

//!SECTION END

function checkFileIfLoaded() {
  if (fileIsLoaded === false) {
    speedDownButton.disabled = true;
    speedUpButton.disabled = true;
    playPauseButton.disabled = true;
    playButton.disabled = true;
    loopButton.disabled = true;
    zoomSlider.disabled = true;
  }
  if (fileIsLoaded === true) {
    speedDownButton.disabled = false;
    speedUpButton.disabled = false;
    playPauseButton.disabled = false;
    playButton.disabled = false;
    loopButton.disabled = false;
    zoomSlider.disabled = false;
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
    let audioUrl = URL.createObjectURL(await response.blob());
    wavesurfer.load(audioUrl);
    fileIsLoaded = true;
  } else {
    alert("Failed to load audio");
    fileIsLoaded = false;
  }

  document.getElementById("load-audio").style.backgroundColor = "#028090"; // Restore original background color
  document.getElementById("load-audio").style.cursor = "pointer";
  document.getElementById("load-audio").disabled = false; // Re-enable the button functionality
  document.getElementById("loading-indicator").style.display = "none"; // Hide loading after audio is loaded
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

    // Change button text and color back to "Set Loop"
    loopButton.textContent = "Set Loop";
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

let isPaused = false;

function togglePlayPause() {
  if (isPaused) {
    playButton.classList.add("hidden");
    pauseButton.classList.remove("hidden");
    pauseButton.classList.add("show");
  } else {
    playButton.classList.remove("hidden");
    playButton.classList.add("show");
    pauseButton.classList.add("hidden");
  }
  isPaused = !isPaused; // Toggle the state
}

//! Add spacebar event for play/pause and seek to loopStart
document.body.onkeyup = function (e) {
  togglePlayPause();
  if (e.keyCode == 32) {
    // Check if the pressed key is the spacebar (key code 32)
    if (wavesurfer.isPlaying()) {
      // If the audio is playing, pause and seek to loopStart
      wavesurfer.pause();
      isPaused = true;
      if (loopStart !== null) {
        wavesurfer.seekTo(loopStart / wavesurfer.getDuration()); // Move the cursor back to loopStart
      }
    } else {
      if (loopRegion) {
        wavesurfer.play(loopStart);
        console.log("Loop is present");
      } else if (
        // If the audio is paused and we've previously paused it, start from loopStart
        loopStart !== null &&
        isPaused
      ) {
        wavesurfer.play(loopStart);
        isPaused = false;
      } else {
        // If loopStart isn't set or it's the first time, just toggle play/pause
        wavesurfer.playPause();
      }
    }
  }
  document.activeElement.blur();
};

// Play/Pause functionality
document.getElementById("play-pause").addEventListener("click", () => {
  wavesurfer.playPause();
});

document.getElementById("play-pause").addEventListener("click", () => {
  togglePlayPause();
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
  currentZoom = Math.max(10, Math.min(100, event.target.value)); // Limit zoom between 10% and 100%
  wavesurfer.zoom(currentZoom * 5); // Scale the zoom for visibility
  updateZoomSlider(currentZoom);
});

updateSpeedDisplay();

//#####FLYOUT MENU#################################################################

// /
