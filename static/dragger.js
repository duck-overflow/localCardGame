const draggable = document.getElementById("draggable");

let isDragging = false;
let offsetX = 0;
let offsetY = 0;

// Funktion für das Starten des Drag-Vorgangs
function startDrag(e) {
    isDragging = true;
    
    // Bei Touch wird `e.touches[0]` verwendet, um die Koordinaten des ersten Fingers zu holen
    const clientX = e.type === "touchstart" ? e.touches[0].clientX : e.clientX;
    const clientY = e.type === "touchstart" ? e.touches[0].clientY : e.clientY;

    offsetX = clientX - draggable.offsetLeft;
    offsetY = clientY - draggable.offsetTop;
    draggable.style.cursor = "grabbing";
}

// Funktion für die Bewegung des Objekts
function onDrag(e) {
    if (!isDragging) return;

    // Bei Touch-Ereignissen, verwenden wir `e.touches[0]` für die Koordinaten
    const clientX = e.type === "touchmove" ? e.touches[0].clientX : e.clientX;
    const clientY = e.type === "touchmove" ? e.touches[0].clientY : e.clientY;

    draggable.style.left = clientX - offsetX + "px";
    draggable.style.top = clientY - offsetY + "px";
}

// Funktion, um den Drag-Vorgang zu beenden
function stopDrag() {
    isDragging = false;
    draggable.style.cursor = "grab";
}

// Event-Listener für Maus
draggable.addEventListener("mousedown", startDrag);
document.addEventListener("mousemove", onDrag);
document.addEventListener("mouseup", stopDrag);

// Event-Listener für Touch
draggable.addEventListener("touchstart", startDrag);
document.addEventListener("touchmove", onDrag);
document.addEventListener("touchend", stopDrag);
