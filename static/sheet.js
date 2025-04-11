let current = "";

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
        if (currentScore < -1) currentScore = -1;
        if (currentScore > 6) currentScore = 6;

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

function buildDisplay(type) {
    if (current != type) current = type;
    else return;
    
    let types = ["vgr", "fns", "spr", "mnd"];
    types = types.filter(e => e != type);
    for (let x = 0; x < types.length; x++) {
        deleteElements(types[x], type);
    }

    var parentElement = document.getElementsByClassName("talents")[0];

    fetch("../static/talents.json")
    .then(response => response.json())
    .then(data => {
        data.Talents.forEach(talent => {

            var name = talent.name;
            var category = talent.category;
            if (!category.includes(type)) {
                return;
            }
            var defaultSymbol = talent.default;
            formatIconName(name, category);
            var parts = [formatIconName(name, category), category, defaultSymbol];
            createElements(parts, parentElement);

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

function deleteElements(id, type) {
    document.querySelectorAll("." + id).forEach(e => e.remove());
}

function createElements(parts, parentElement) {
    var name = parts[0];
    var classes = parts[1].split(" ");
    
    // Build Element
    var parent = document.createElement("div");
    parent.classList.add("talent");
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
    parentElement.appendChild(parent);

}

function createButtonElement(name, onClickFunction, classList) {

    var button = document.createElement("button");
    classList.forEach(e => button.classList.add(e));
    button.setAttribute("onclick", `adjustScore('${onClickFunction[0]}', ${onClickFunction[1]})`);
    button.innerHTML = name;
    return button;
}