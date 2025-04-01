function adjustScore(attribute, change) {
    const scoreElement = document.getElementById(`${attribute}-score`);
    let currentScore = isNaN(parseInt(scoreElement.innerText))
    ? scoreElement.innerText.charCodeAt(0) - 65
    : parseInt(scoreElement.innerText);

    currentScore += change;

    if (isNaN(parseInt(scoreElement.innerText))) {
        // Handle letter grades
        if (currentScore < 0) currentScore = 0;
        if (currentScore > 25) currentScore = 25;
        scoreElement.innerText = String.fromCharCode(currentScore + 65);
    } else {
        scoreElement.innerHTML = currentScore;
    }


}