$(document).ready(function () {

    $('.add-card').on('click touchstart', function (event) {
        event.preventDefault();
        add_card.call(this);
    });
});


function add_card() {
    var cardElement = $(this).closest('.card');
    var cardName = $(this).data('card');
    var pElement = $(this).closest('.card').find('p');
    
    var cMatch = cardName.match(/_(\d+)_/);
    var pMatch = pElement.text().match(/^Verwendung (\d+) \/ (\d+)$/);
    if (cMatch) var cVerwendung = parseInt(cMatch[1]);
    if (pMatch) var pVerwendung = parseInt(pMatch[1]);
    if (!(pVerwendung < cVerwendung)) return;

    // AJAX POST-Anfrage an Flask senden
    $.ajax({
        url: '/add_card_to_deck/' + cardName,  // Die URL, die die Karte hinzufügt
        type: 'POST',
        dataType: 'json',
        success: function (response) {
            if (response.message) {
                document.getElementById("karten_title").innerHTML = response.message;
            }

            if (response.remove_card) {
                cardElement.fadeOut(500, function() {
                    $(this).remove();
                });
            }

            if (pMatch) {
                pElement.text(`Verwendung ${pVerwendung + 1} / ${cVerwendung}`);
            }
            if (pVerwendung + 1 >= cVerwendung) {
                cardElement.fadeOut(500, function() {
                    $(this).remove();
                });
            }
        },
        error: function (xhr) {
            console.error("Fehler beim Hinzufügen der Karte: ", xhr.responseText);
        }
    });
}