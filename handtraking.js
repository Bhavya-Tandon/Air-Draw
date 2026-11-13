
import {
    FilesetResolver,
    HandLandmarker
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.mjs";

import {
    video,
    startButton,
    stopButton,
    statusText,
    statusDot,
    placeholder,
    message,
    startCamera,
    stopCamera
} from "./camera.js";

import {
    setupDrawingCanvas,
    drawAt,
    pauseDrawing,
    clearDrawing,
    stopDrawing,
    setDrawingColor
} from "./drawing.js";


const canvas = document.getElementById("handCanvas");
const ctx = canvas.getContext("2d");

const handStatus = document.getElementById("handStatus");
const fingerPosition = document.getElementById("fingerPosition");
const drawStatus = document.getElementById("drawStatus");

const clearButton = document.getElementById("clearCanvas");
const colorPicker = document.getElementById("drawingColor");
const pinchStates = new Map();

colorPicker.addEventListener("input", () => {
    setDrawingColor(colorPicker.value);
});

let handLandmarker = null;

let animationFrame = null;

let lastVideoTime = -1;

let lastDetectedHandCount = 0;


// LOAD MEDIAPIPE

async function initializeHandTracking() {

    message.textContent = "Loading hand tracking model...";

    const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
    );

    handLandmarker = await HandLandmarker.createFromOptions(
        vision,
        {
            baseOptions: {
                modelAssetPath:
                    "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
            },

            runningMode: "VIDEO",

            numHands: 2,

            minHandDetectionConfidence: 0.5,

            minHandPresenceConfidence: 0.5,

            minTrackingConfidence: 0.5
        }
    );

    message.textContent = "Hand tracking ready!";
}


// DETECT PINCH

function isPinching(firstFinger, secondFinger, handIndex, action) {
    const key = `${handIndex}:${action}`;
    const state = pinchStates.get(key);
    const now = performance.now();
    const dx = firstFinger.x - secondFinger.x;
    const dy = firstFinger.y - secondFinger.y;
    const distance = Math.hypot(dx, dy);
    const wasPinching = state && state.active;
    const threshold = wasPinching ? 0.075 : 0.055;

    if (distance < threshold) {
        pinchStates.set(key, { active: true, lastPinchTime: now });
        return true;
    }

    if (wasPinching && now - state.lastPinchTime < 90) {
        return true;
    }

    pinchStates.set(key, { active: false, lastPinchTime: 0 });
    return false;
}


// DRAW HAND LANDMARKS

function drawHand(landmarks) {
    const connections = HandLandmarker.HAND_CONNECTIONS;

    ctx.lineWidth = 3;
    ctx.strokeStyle = "#8065f5";

    for (const connection of connections) {

        const start = landmarks[connection.start];
        const end = landmarks[connection.end];

        ctx.beginPath();

        ctx.moveTo(
            (1 - start.x) * canvas.width,
            start.y * canvas.height
        );

        ctx.lineTo(
            (1 - end.x) * canvas.width,
            end.y * canvas.height
        );

        ctx.stroke();
    }


    // DRAW LANDMARK DOTS

    landmarks.forEach((point, index) => {

        const x = (1 - point.x) * canvas.width;
        const y = point.y * canvas.height;

        ctx.beginPath();

        ctx.arc(
            x,
            y,
            index === 8 ? 9 : 4,
            0,
            Math.PI * 2
        );

        ctx.fillStyle =
            index === 8 ? "#35d07f" : "#ffffff";

        ctx.fill();
    });

}


// MAIN HAND DETECTION

function detectHands() {

    if (
        video.readyState >= 2 &&
        video.currentTime !== lastVideoTime
    ) {

        lastVideoTime = video.currentTime;

        const results = handLandmarker.detectForVideo(
            video,
            performance.now()
        );

        ctx.clearRect(
            0,
            0,
            canvas.width,
            canvas.height
        );


        const handCount = results.landmarks.length;
        const handPositions = [];
        let drawingCount = 0;
        let erasingCount = 0;

        for (let handIndex = 0; handIndex < handCount; handIndex++) {
            const landmarks = results.landmarks[handIndex];
            drawHand(landmarks);

            const thumb = landmarks[4];
            const index = landmarks[8];
            const middle = landmarks[12];
            const x = (1 - index.x) * canvas.width;
            const y = index.y * canvas.height;
            const drawing = isPinching(thumb, index, handIndex, "draw");
            const erasing = isPinching(index, middle, handIndex, "erase");
            const active = erasing || drawing;

            drawAt(
                x,
                y,
                active,
                handIndex,
                erasing ? "erase" : "draw"
            );

            if (erasing) {
                erasingCount++;
            } else if (drawing) {
                drawingCount++;
            }

            handPositions.push(
                `Hand ${handIndex + 1}: X: ${Math.round(x)}, Y: ${Math.round(y)}`
            );
        }

        for (let handIndex = handCount; handIndex < lastDetectedHandCount; handIndex++) {
            pauseDrawing(handIndex);
        }

        lastDetectedHandCount = handCount;
        const activeCount = drawingCount + erasingCount;
        handStatus.textContent = handCount === 1
            ? "Hands: 1 detected"
            : `Hands: ${handCount} detected`;
        fingerPosition.textContent = handPositions.length > 0
            ? handPositions.join(" | ")
            : "Index Fingers: --, --";
        drawStatus.textContent = erasingCount > 0
            ? `Erasing: ON (${erasingCount} ${erasingCount === 1 ? "hand" : "hands"})`
            : drawingCount > 0
                ? `Drawing: ON (${drawingCount} ${drawingCount === 1 ? "hand" : "hands"})`
                : "Drawing: OFF";
        drawStatus.style.color = erasingCount > 0
            ? "#ff8b9d"
            : activeCount > 0
                ? "#35d07f"
                : "#aaa";

    }

    animationFrame = requestAnimationFrame(detectHands);

}


// START CAMERA AND TRACKING

startButton.addEventListener("click", async () => {

    try {

        startButton.disabled = true;

        if (!handLandmarker) {

            await initializeHandTracking();

        }

        await startCamera();

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        setupDrawingCanvas(
            video.videoWidth,
            video.videoHeight
        );

        lastVideoTime = -1;
        lastDetectedHandCount = 0;
        pinchStates.clear();

        placeholder.classList.add("hidden");

        statusText.textContent = "Camera Online";

        statusDot.classList.add("active");

        message.textContent =
            "Pinch thumb and index to draw; pinch index and middle to erase.";

        stopButton.disabled = false;

        detectHands();

    }

    catch (error) {

        console.error("AirDraw Error:", error);

        message.textContent = "Error: " + error.message;

        stopCamera();

        stopDrawing();
        pinchStates.clear();
        lastDetectedHandCount = 0;

        startButton.disabled = false;

    }

});


// STOP CAMERA

stopButton.addEventListener("click", () => {

    stopCamera();

    cancelAnimationFrame(animationFrame);

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    stopDrawing();
    pinchStates.clear();

    handStatus.textContent = "Hands: 0 detected";

    fingerPosition.textContent = "Index Fingers: --, --";

    drawStatus.textContent = "Drawing: OFF";

    placeholder.classList.remove("hidden");

    statusText.textContent = "Camera Offline";

    statusDot.classList.remove("active");

    message.textContent = "Camera stopped.";

    startButton.disabled = false;
    stopButton.disabled = true;

});


// CLEAR CANVAS

clearButton.addEventListener("click", () => {

    clearDrawing();

    message.textContent = "Drawing cleared!";

});