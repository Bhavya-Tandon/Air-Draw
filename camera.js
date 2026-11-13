
export const video = document.getElementById("webcam");

export const startButton = document.getElementById("startCamera");
export const stopButton = document.getElementById("stopCamera");

export const statusText = document.getElementById("statusText");
export const statusDot = document.getElementById("statusDot");

export const placeholder = document.getElementById("placeholder");
export const message = document.getElementById("message");

let cameraStream = null;

export async function startCamera() {

    cameraStream = await navigator.mediaDevices.getUserMedia({
        video: {
            facingMode: "user",
            width: 640,
            height: 480
        },
        audio: false
    });

    video.srcObject = cameraStream;

    await video.play();

    return true;
}

export function stopCamera() {

    if (cameraStream) {

        cameraStream.getTracks().forEach(track => {
            track.stop();
        });

        cameraStream = null;
    }

    video.srcObject = null;
}
