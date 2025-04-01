from flask import Flask, request, render_template, redirect, session, url_for, jsonify
from flask_session import Session
from backend.playerData import Player
from backend.utilFunctions import get_image_list, test_name_availability, check_matching
from backend.database import get_everything_player, add_player_data, get_last_id, reset_data, get_card_count, get_deck_amount, add_deck_data, delete_deck_data, get_card_amount

app = Flask(__name__, static_folder='static')

app.config['SESSION_KEY'] = 'your_secret_key'
app.config['SESSION_TYPE'] = 'filesystem'
Session(app)

#reset_data()

@app.route('/reglog')
def open_reg_log():
    return render_template('reglog.html')

# Register ablauf
@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']

        if test_name_availability(username):
            return redirect(url_for('open_reg_log'))

        new_id = get_last_id() + 1
        new_player = Player(username, password, new_id)
        playerInfo = new_player.to_array()
        add_player_data(playerInfo[0], playerInfo[1], playerInfo[2])
        get_everything_player()

        session['username'] = username
        return redirect(url_for('home'))
    return redirect(url_for('open_reg_log'))

# Login Ablauf

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']

        if check_matching(username, password):
            session['username'] = username
            return redirect(url_for('home'))

    return redirect(url_for('open_reg_log'))

@app.route('/dashboard')
def dashboard():
    if 'username' not in session:
        return redirect(url_for('open_reg_log'))
    return f'Willkommen, {session["username"]}!'

@app.route('/')
def home():
    user = session.get('username')
    if (user == None):
        return redirect(url_for('open_reg_log'))
    else:
        return render_template('home.html', user=user)

@app.route('/cards')
def cards():
    #Zeigt alle Karten an
    user = session.get('username')
    if (user == None):
        return redirect(url_for('open_reg_log'))
    else:
        return render_template('cards.html', size_cards=get_deck_amount(user), card_usage=get_image_list(app, user))
def add_card(card_name):
    user = session.get('username')
    add_deck_data(user, card_name)

@app.route('/deck')
def deck():
    #Zeigt alle Karten an
    user = session.get('username')
    if user == None:
        return redirect(url_for('open_reg_log'))
    else:
        card_usage = get_card_count(user)
        return render_template('deck.html', size_cards=get_deck_amount(user), card_usage=card_usage)

@app.route('/add_card_to_deck/<card_name>', methods=['POST'])
def add_card_to_deck(card_name):
    user = session.get('username')
    if user == None:
        return redirect(url_for('open_reg_log'))
    else:
        # Check if card can be added
        print(user)
        max_amount = card_name.rsplit('_', 2)[1]
        cur_amount = get_card_amount(user, card_name)[0][0]
        if cur_amount >= int(max_amount):
            return jsonify({
                "error": "Maximale Nutzung erreicht!",
                "remove_card": True
            })
        add_deck_data(user, card_name)
        size_cards = get_deck_amount(user)
        return jsonify({
            "message": f"Kartenauswahl {size_cards} / 50"
        })

@app.route('/remove_card_from_deck/<card_name>', methods=['POST'])
def remove_card_from_deck(card_name):
    user = session.get('username')
    if user == None:
        return redirect(url_for('open_reg_log'))
    else:

        delete_deck_data(user, card_name)
        cur_amount = get_card_amount(user, card_name)[0][0]
        size_cards = get_deck_amount(user)
        if (cur_amount == 0):
            return jsonify({
                "error": "Maximale Nutzung erreicht!",
                "message": f"Kartenauswahl {size_cards} / 50",
                "remove_card": True
            })
        return jsonify({
            "message": f"Kartenauswahl {size_cards} / 50"
        })

@app.route('/card_dragger')
def open_carddragger():
    return render_template('card_dragger.html')

@app.route('/sheet')
def open_sheet():
    user = session.get('username')
    if (user == None):
        return redirect(url_for('open_reg_log'))
    else:
        return render_template('sheet.html')

@app.route('/logout')
def logout():
    # Löscht den Benutzernamen aus der Session und loggt den Benutzer aus
    session.pop('username', None)
    return redirect(url_for('open_reg_log'))


if __name__ == '__main__':
    # app.run(debug=True)
    app.run(host='0.0.0.0', port=8080, debug=True)
