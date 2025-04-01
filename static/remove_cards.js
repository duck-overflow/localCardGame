$(document).ready(function() {
    // Event-Listener für Klicks auf die Kartenbilder
    $('.remove-card').on('click touchstart', function(event) {
        event.preventDefault();
        remove_card.call(this);
    });
});

function remove_card() {
    var cardName = $(this).data('card');  // Den Kartennamen aus dem 'data-card' Attribut holen

        // AJAX POST-Anfrage an Flask senden
        $.ajax({
            url: '/remove_card_from_deck/' + cardName,  // Die URL, die die Karte hinzufügt
            type: 'POST',
            dataType: 'json',
            success: function(response) {
                if (response.message) {
                    document.getElementById("karten_title").innerHTML = response.message;
                }

                if (response.redirect_url) {
                    window.location.href = response.redirect_url;
                }
            },
            error: function(xhr) {
                console.error("Fehler beim Hinzufügen der Karte: ", xhr.responseText);
            }
        });
}