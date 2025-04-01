import sqlite3
import re
from backend.playerData import Player

# https://docs.python.org/3/library/sqlite3.html

con = sqlite3.connect("database.db", check_same_thread=False)
cur = con.cursor()
cur.execute("CREATE TABLE IF NOT EXISTS player(username, password, id)")
cur.execute("CREATE TABLE IF NOT EXISTS deck(id, card, max, amount)")

# Management Functions

def reset_data():
    cur.execute('DROP TABLE player')
    cur.execute('DROP TABLE deck')
    cur.execute("CREATE TABLE IF NOT EXISTS player(username, password, id)")
    cur.execute("CREATE TABLE IF NOT EXISTS deck(id, card, max, amount)")
    print("Databases restored succesfuly")
    create_admin_user()

def create_admin_user():
    adminPlayer = Player("admin", "Start123")
    playerInfo = adminPlayer.to_array()
    add_player_data(playerInfo[0], playerInfo[1], playerInfo[2])
    print("<-- Admin Spieler erstellt! --> \n Username: admin \n Password: Start123")

# Player Data

def get_everything_player():
    cmd = 'SELECT * FROM player'
    res = cur.execute(cmd)
    return res.fetchall()

def get_all_player_data(player):
    player_id = transform_username_id(player)
    cmd = f'SELECT * FROM player WHERE id LIKE {player_id}'
    print(cmd)
    res = cur.execute(cmd)
    return res.fetchall()

def get_player_data(data, player):
    player_id = transform_username_id(player)
    cmd = f'SELECT {data} FROM player WHERE id LIKE {player_id}'
    print(cmd)
    res = cur.execute(cmd)
    return res.fetchall()

def search_player_data(data):
    cmd = f'SELECT * FROM player WHERE username LIKE "{data}"'
    print(cmd)
    res = cur.execute(cmd)
    return res.fetchall()

def transform_username_id(username):
    cmd = f'SELECT id FROM player WHERE username LIKE "{username}"'
    res = cur.execute(cmd)
    x = res.fetchall()[0][0]
    return x

def verify_player_data(username, password):
    cmd = f'SELECT * FROM player WHERE username LIKE "{username}" AND password LIKE "{password}"'
    print(cmd)
    res = cur.execute(cmd)
    return res.fetchall()

def add_player_data(username, password, player_id):
    cmd = f'INSERT INTO player VALUES("{username}", "{password}", {player_id})'
    print(cmd)
    cur.execute(cmd)
    con.commit()

def delete_player_data(player):
    player_id = transform_username_id(player)
    cmd = f'DELETE FROM player WHERE id LIKE "{player_id}"'
    cur.execute(cmd)
    con.commit()

def get_last_id():
    cmd = f'SELECT id FROM player ORDER BY id DESC'
    res = cur.execute(cmd)
    digits = re.match(r'\((\d+),\)', str(res.fetchall()[0]))
    return int(digits.group(1))

# Deck Data

def get_everything_card():
    cmd = 'SELECT * FROM deck'
    res = cur.execute(cmd)
    return res.fetchall()

def get_deck_data(player):
    player_id = transform_username_id(player)
    cmd = f'SELECT * FROM deck WHERE id LIKE "{player_id}"'
    res = cur.execute(cmd)
    return res.fetchall()

def add_deck_data(player, card_name):
    player_id = transform_username_id(player)
    max_amount = card_name.rsplit('_', 2)[1]
    cur_amount = get_card_amount(player, card_name)[0][0]
    if cur_amount < int(max_amount):
        if cur_amount == 0:
            cmd = f'INSERT INTO deck VALUES(?, ?, ?, 1)'
            cur.execute(cmd, (player_id, card_name, max_amount))
        else:
            new_amount = cur_amount + 1
            cmd = f'UPDATE deck SET amount = ? WHERE id = ? AND card = ?'
            cur.execute(cmd, (new_amount, player_id, card_name))
        con.commit()

def delete_deck_data(player, card_name):
    player_id = transform_username_id(player)
    cur_amount = get_card_amount(player, card_name)[0][0]
    if cur_amount > 1:
       new_amount = cur_amount - 1
       cmd = f'UPDATE deck SET amount = ? WHERE id = ? AND card = ?'
       cur.execute(cmd, (new_amount, player_id, card_name))
       con.commit()
    else:
        cur.execute('DELETE FROM deck WHERE id = ? AND card = ?', (player_id, card_name))
        con.commit()

def get_card_amount(player, card_name):
    player_id = transform_username_id(player)
    cmd = 'SELECT amount FROM deck WHERE id = ? AND card = ?'
    cur.execute(cmd, (player_id, card_name))
    row = cur.fetchall()
    if row == []:
        return [[0]]
    else:
        return row

def get_deck_amount(player):
    player_id = transform_username_id(player)
    cmd = 'SELECT amount FROM deck WHERE id = ?'
    cur.execute(cmd, (player_id, ))
    row = cur.fetchall()
    i = 0
    for x in row:
        i += x[0]
    return i

def get_card_count(player):
    player_id = transform_username_id(player)
    cmd = f'SELECT card, amount FROM deck WHERE id = {player_id}'
    cur.execute(cmd)
    rows = cur.fetchall()
    con.commit()
    return rows

#everything_player = get_everything_player()
#everything_card = get_everything_card()
#print(f'Everything Player: {everything_player}')
#print(f'Everything Cards: {everything_card}')