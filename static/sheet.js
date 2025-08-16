let current = "";
// Map talent key -> { min, max } where S=-1, A=0, ..., G=6
const talentRanges = {};

window.onload = function() {

    buildDisplay("vgr");

}

function adjustScore(attribute, change) {
    const scoreElement = document.getElementById(`${attribute}-score`);
    let currentScore = isNaN(parseInt(scoreElement.innerText))
    ? scoreElement.innerText.charCodeAt(0) - 65
    : parseInt(scoreElement.innerText);

    currentScore += change;

    if (isNaN(parseInt(scoreElement.innerText))) {
        //Letters
        console.log(currentScore);
        if (currentScore == 17) currentScore = -1;
        if (currentScore == 19) currentScore = 0;
        // Apply per-talent range limits (defaults to S-G if not found)
        const range = talentRanges[attribute];
        const minIdx = range ? range.min : -1; // S
        const maxIdx = range ? range.max : 6;  // G
        if (currentScore < minIdx) currentScore = minIdx;
        if (currentScore > maxIdx) currentScore = maxIdx;

        if (currentScore != -1) {
            scoreElement.innerText = String.fromCharCode(currentScore + 65);
        } else {
            scoreElement.innerText = String.fromCharCode(currentScore + 84);
        }
        
    } else {
        //Numbers
        if (currentScore < 0) currentScore = 0;
        if (currentScore > 25) currentScore = 25;
        scoreElement.innerHTML = currentScore;
    }
}

async function buildDisplay(type) {
    if (current !== type) {
        // remove old first
        await deleteElements(current);
        current = type;
    } else {
        // toggle off
        await deleteElements(type);
        current = "";
        setActiveButton(null);
        return;
    }

    // update button UI
    setActiveButton(type);

    var parentElement = document.getElementsByClassName("talents")[0];

    fetch("../static/talents.json")
    .then(response => response.json())
    .then(data => {
        data.Talents.forEach(talent => {

            var name = talent.name;
            var category = talent.category.split(" ")[0];
            var doubleCategory = talent.category;
            if (!category.includes(type)) {
                return;
            }
            var defaultSymbol = talent.default;
            var key = name.split(" ")[0].toLowerCase();
            talentRanges[key] = parseRange(talent.range);
            formatIconName(name, doubleCategory);
            var parts = [formatIconName(name, doubleCategory), category, defaultSymbol];
            // Pass the active filter type so created elements canx be tagged correctly
            createElements(parts, parentElement, type);

        });
    })
    .catch(error => console.error("Fehler beim Laden der JSON:", error));
}

function formatIconName(name, category) {
    var cats = category.split(" ");
    let partname = "(";
    cats.forEach(e => partname = partname + e.toUpperCase() + " / ");
    return (name + " " + partname.substring(0, partname.length - 3) + ")");
}

function deleteElements(typeToDelete) {
    if (!typeToDelete) return Promise.resolve();
    const elements = document.querySelectorAll(`.talent[data-type="${typeToDelete}"]`);
    const removals = Array.from(elements).map(e => new Promise(resolve => {
        e.classList.add("fade-out");
        const remove = () => { if (e && e.parentNode) e.remove(); resolve(); };
        e.addEventListener("transitionend", remove, { once: true });
        // Fallback in case no CSS transition is defined
        setTimeout(remove, 300);
    }));
    return Promise.all(removals);
}

function setActiveButton(activeType) {
    const buttons = document.querySelectorAll('.buttons button');
    buttons.forEach(btn => {
        const oc = btn.getAttribute('onclick') || '';
        const isActive = !!activeType && oc.includes(`'${activeType}'`);
        btn.disabled = isActive;
        btn.classList.toggle('active', isActive);
    });
}

function createElements(parts, parentElement, activeType) {
    var name = parts[0];
    var classes = [parts[1]];
    
    // Build Element
    var parent = document.createElement("div");
    parent.classList.add("talent");
    parent.classList.add("fade-in");
    classes.forEach(e => parent.classList.add(e));
    
    var elementName = document.createElement("span");
    elementName.innerHTML = name;

    var firstButtonList = ["&#9664;", [name.split(" ")[0].toLowerCase(), -1], ["arrow", "down"]];
    var firstButton = createButtonElement(firstButtonList[0], firstButtonList[1], firstButtonList[2]);
    
    var scoreElement = document.createElement("span");
    scoreElement.classList.add("score");
    var scoreElementId = name.split(" ")[0].toLowerCase() + "-score";
    scoreElement.id = scoreElementId;
    scoreElement.innerHTML = parts[2];

    var lastButtonList = ["&#9654;", [name.split(" ")[0].toLowerCase(), 1], ["arrow", "up"]];
    var lastButton = createButtonElement(lastButtonList[0], lastButtonList[1], lastButtonList[2]);

    parent.appendChild(elementName);
    parent.appendChild(firstButton);
    parent.appendChild(scoreElement);
    parent.appendChild(lastButton);
    // Tag with the currently active filter (e.g., 'vgr', 'fns', 'spr', 'mnd')
    parent.setAttribute("data-type", activeType);
    parentElement.appendChild(parent);



}

function createButtonElement(name, onClickFunction, classList) {

    var button = document.createElement("button");
    classList.forEach(e => button.classList.add(e));
    button.setAttribute("onclick", `adjustScore('${onClickFunction[0]}', ${onClickFunction[1]})`);
    button.innerHTML = name;
    return button;
}

function parseRange(rangeStr) {
    // Expected formats: "S-G", "S-F", etc.
    if (!rangeStr || typeof rangeStr !== 'string') return { min: -1, max: 6 };
    const parts = rangeStr.split('-').map(s => s.trim().toUpperCase());
    const mapChar = (ch) => ch === 'S' ? -1 : (ch.charCodeAt(0) - 65);
    const min = parts[0] ? mapChar(parts[0]) : -1;
    const max = parts[1] ? mapChar(parts[1]) : 6;
    return { min, max };
}

function saveUpdateData(user) {
    
}