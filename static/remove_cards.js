$(document).ready(function() {
    // Event-Listener für Klicks auf die Kartenbilder
    $('.remove-card').on('click touchstart', function(event) {
        event.preventDefault();
        remove_card.call(this);
    });
});

function remove_card() {
    var cardElement = $(this).closest('.card');
    var cardName = $(this).data('card');  // Den Kartennamen aus dem 'data-card' Attribut holen
    var pElement = $(this).closest('.card').find('p');

    var cMatch = cardName.match(/_(\d+)_/);
    var pMatch = pElement.text().match(/^Usage (\d+) \/ (\d+)$/);
    if (cMatch) var cVerwendung = parseInt(cMatch[1]);
    if (pMatch) var pVerwendung = parseInt(pMatch[1]);
    
    // AJAX POST-Anfrage an Flask senden
    $.ajax({
        url: '/remove_card_from_deck/' + cardName,  // Die URL, die die Karte hinzufügt
        type: 'POST',
        dataType: 'json',
        success: function(response) {
            if (response.message) {
                document.getElementById("karten_title").innerHTML = response.message;
            }
            if (pMatch) {
                pElement.text(`Usage ${pVerwendung - 1} / ${cVerwendung}`);
            }
            if (pVerwendung - 1 == 0) {
                cardElement.fadeOut(500, function() {
                    $(this).remove();
                });
            }

        },
        error: function(xhr) {
            console.error("Fehler beim Hinzufügen der Karte: ", xhr.responseText);
        }
    });
}