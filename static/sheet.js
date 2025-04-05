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

function openFNS() {
    const hideShwn = document.getElementById("shown");
    hideShwn.remove();
}

function openVGR() {

}

function openOP3() {

}

function openOP4() {

}