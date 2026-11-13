const canvas = document.getElementById("drawingCanvas");

const ctx = canvas.getContext("2d");

const previousPoints = new Map();
let drawingColor = "#8065f5";

const minimumCutoff = 1.2;
const speedSmoothing = 0.025;
const derivativeCutoff = 1;
const trackingGracePeriod = 250;


function smoothingAlpha(deltaTime, cutoff) {
    const timeConstant = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + timeConstant / deltaTime);
}


function lowPass(value, previousValue, alpha) {
    return alpha * value + (1 - alpha) * previousValue;
}


function startPoint(x, y, now, tool) {
    return {
        x,
        y,
        filteredX: x,
        filteredY: y,
        speedX: 0,
        speedY: 0,
        time: now,
        tool,
        timeoutId: null
    };
}


// SET UP CANVAS

export function setupDrawingCanvas(width, height) {

    canvas.width = width;
    canvas.height = height;
    previousPoints.clear();

    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.strokeStyle = drawingColor;
}

export function setDrawingColor(color) {
    drawingColor = color;
    ctx.strokeStyle = drawingColor;
}


// DRAW USING FINGER POSITION

export function drawAt(x, y, active, sourceId = 0, tool = "draw") {
    let previousPoint = previousPoints.get(sourceId);

    if (!active) {
        if (previousPoint && previousPoint.timeoutId !== null) {
            clearTimeout(previousPoint.timeoutId);
        }
        previousPoints.delete(sourceId);
        return;
    }

    const now = performance.now();
    if (!previousPoint || previousPoint.tool !== tool) {
        if (previousPoint && previousPoint.timeoutId !== null) {
            clearTimeout(previousPoint.timeoutId);
        }
        previousPoints.set(sourceId, startPoint(x, y, now, tool));
        return;
    }

    if (previousPoint.timeoutId !== null) {
        clearTimeout(previousPoint.timeoutId);
        previousPoint.timeoutId = null;
    }

    const deltaTime = Math.max((now - previousPoint.time) / 1000, 1 / 120);
    const rawSpeedX = (x - previousPoint.x) / deltaTime;
    const rawSpeedY = (y - previousPoint.y) / deltaTime;
    const derivativeAlpha = smoothingAlpha(deltaTime, derivativeCutoff);
    const speedX = lowPass(rawSpeedX, previousPoint.speedX, derivativeAlpha);
    const speedY = lowPass(rawSpeedY, previousPoint.speedY, derivativeAlpha);
    const cutoff = minimumCutoff + speedSmoothing * Math.hypot(speedX, speedY);
    const alpha = smoothingAlpha(deltaTime, cutoff);
    const filteredX = lowPass(x, previousPoint.filteredX, alpha);
    const filteredY = lowPass(y, previousPoint.filteredY, alpha);

    ctx.save();
    ctx.globalCompositeOperation = tool === "erase"
        ? "destination-out"
        : "source-over";
    ctx.strokeStyle = tool === "erase" ? "#000000" : drawingColor;
    ctx.lineWidth = tool === "erase"
        ? Math.max(24, Math.min(canvas.width, canvas.height) * 0.07)
        : 6;
    ctx.beginPath();
    ctx.moveTo(previousPoint.filteredX, previousPoint.filteredY);
    ctx.lineTo(filteredX, filteredY);
    ctx.stroke();
    ctx.restore();

    previousPoints.set(sourceId, {
        ...previousPoint,
        x,
        y,
        filteredX,
        filteredY,
        speedX,
        speedY,
        time: now
    });
}


export function pauseDrawing(sourceId = 0) {
    const previousPoint = previousPoints.get(sourceId);
    if (!previousPoint || previousPoint.timeoutId !== null) {
        return;
    }

    previousPoint.timeoutId = setTimeout(() => {
        if (previousPoints.get(sourceId) === previousPoint) {
            previousPoints.delete(sourceId);
        }
    }, trackingGracePeriod);
}


// CLEAR DRAWING

export function clearDrawing() {

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    for (const point of previousPoints.values()) {
        if (point.timeoutId !== null) {
            clearTimeout(point.timeoutId);
        }
    }
    previousPoints.clear();
}


// RESET DRAWING STATE

export function stopDrawing() {
    for (const point of previousPoints.values()) {
        if (point.timeoutId !== null) {
            clearTimeout(point.timeoutId);
        }
    }
    previousPoints.clear();
}
