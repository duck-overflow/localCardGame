import sqlite3
import re
import random
from collections import Counter
from uuid import uuid4
from backend.playerData import Player

# https://docs.python.org/3/library/sqlite3.html

con = sqlite3.connect("database.db", check_same_thread=False)
cur = con.cursor()
cur.execute('CREATE TABLE IF NOT EXISTS player(username, password, id)')
cur.execute('CREATE TABLE IF NOT EXISTS deck(id, card, max, amount)')
cur.execute('CREATE TABLE IF NOT EXISTS rolls(id, failedCheck, natOne, natTwenty, total)')
cur.execute('CREATE TABLE IF NOT EXISTS talent_stats(id, talentName, talentLevel)')
cur.execute('CREATE TABLE IF NOT EXISTS theme(id, theme_name)')
cur.execute(
    'CREATE TABLE IF NOT EXISTS card_positions('
    'user_id INTEGER,'
    'card_id TEXT,'
    'card_src TEXT,'
    'zone TEXT,'
    'pos_x REAL,'
    'pos_y REAL,'
    'height_ratio REAL,'
    'z_index INTEGER,'
    'order_index INTEGER,'
    'PRIMARY KEY(user_id, card_id)'
    ')'
)

# Management Functions

def reset_data():
    cur.execute('DROP TABLE player')
    cur.execute('DROP TABLE deck')
    cur.execute('DROP TABLE rolls')
    cur.execute('DROP TABLE talent_stats')
    cur.execute('DROP TABLE IF EXISTS card_positions')
    cur.execute('CREATE TABLE IF NOT EXISTS player(username, password, id)')
    cur.execute('CREATE TABLE IF NOT EXISTS deck(id, card, max, amount)')
    cur.execute('CREATE TABLE IF NOT EXISTS rolls(id, failedCheck, natOne, natTwenty, total)')
    cur.execute('CREATE TABLE IF NOT EXISTS talent_stats(id, talentName, talentLevel)')
    cur.execute('CREATE TABLE IF NOT EXISTS theme(id, theme_name)')
    cur.execute(
        'CREATE TABLE IF NOT EXISTS card_positions('
        'user_id INTEGER,'
        'card_id TEXT,'
        'card_src TEXT,'
        'zone TEXT,'
        'pos_x REAL,'
        'pos_y REAL,'
        'height_ratio REAL,'
        'z_index INTEGER,'
        'order_index INTEGER,'
        'PRIMARY KEY(user_id, card_id)'
        ')'
    )
    print("Databases restored succesfuly")
    create_admin_user()

def create_admin_user():
    adminPlayer = Player("admin", "Start123")
    playerInfo = adminPlayer.to_array()
    add_player_data(playerInfo[0], playerInfo[1], playerInfo[2])
    print("<-- Created Admin Player! --> \n Username: admin \n Password: Start123")

# Player Data

def get_everything_player():
    cmd = 'SELECT * FROM player'
    res = cur.execute(cmd)
    return res.fetchall()

def get_all_player_data(player):
    player_id = transform_username_id(player)
    cmd = 'SELECT * FROM player WHERE id LIKE ?'
    print(cmd, (player_id,))
    res = cur.execute(cmd, (player_id,))
    return res.fetchall()

def get_player_data(data, player):
    player_id = transform_username_id(player)
    cmd = f'SELECT ? FROM player WHERE id LIKE ?'
    print(cmd, (data, player_id))
    res = cur.execute(cmd)
    return res.fetchall()

def search_player_data(username):
    cmd = f'SELECT * FROM player WHERE username LIKE ?'
    print(cmd)
    res = cur.execute(cmd, (username,))
    return res.fetchall()

def transform_username_id(username):
    with con:
        cur_new = con.cursor()
        cmd = 'SELECT id FROM player WHERE username LIKE ?'
        res = cur_new.execute(cmd, (username,))
        result = res.fetchone()
    if result:
        return result[0]
    raise ValueError(f'User {username} not found.')

def transform_id_username(id):
    with con:
        cur_new = con.cursor()
        cmd = 'SELECT username FROM player WHERE id LIKE ?'
        res = cur_new.execute(cmd, (id,))
        result = res.fetchall()
    if result:
        return result[0]
    raise ValueError(f'ID {id} not found.')

def verify_player_data(username, password):
    cmd = 'SELECT * FROM player WHERE username LIKE ? AND password LIKE ?'
    print(cmd)
    res = cur.execute(cmd, (username, password))
    return res.fetchall()

def add_player_data(username, password, player_id):
    cmd = 'INSERT INTO player VALUES(?, ?, ?)'
    print(cmd)
    cur.execute(cmd, (username, password, player_id))
    cmd = 'INSERT INTO rolls VALUES(?, 0, 0, 0, 0)'
    cur.execute(cmd, (player_id,))
    cmd = 'INSERT INTO theme VALUES(?, default)'
    cur.execute(cmd, (player_id,))
    con.commit()

def delete_player_data(player):
    player_id = transform_username_id(player)
    cmd = 'DELETE FROM player WHERE id LIKE ?'
    cur.execute(cmd, (player_id,))
    cur.execute('DELETE FROM card_positions WHERE user_id = ?', (player_id,))
    con.commit()

def update_user_name(player, new_name):
    player_id = transform_username_id(player)
    cmd = f'UPDATE player SET username = ? WHERE ID = ?'
    print(cmd)
    cur.execute(cmd, (new_name, player_id))
    con.commit()

def update_user_password(player, new_password):
    player_id = transform_username_id(player)
    cmd = f'UPDATE player SET password = ? WHERE ID = ?'
    print(cmd)
    cur.execute(cmd, (new_password, player_id))
    con.commit()

def get_last_id():
    cmd = f'SELECT id FROM player ORDER BY id DESC'
    res = cur.execute(cmd)
    digits = re.match(r'\((\d+),\)', str(res.fetchall()[0]))
    return int(digits.group(1))

def get_player_count():
    cmd = 'SELECT COUNT(*) FROM player'
    res = cur.execute(cmd)
    return res.fetchone()[0]

def get_player_names():
    cmd = 'SELECT username FROM player'
    res = cur.execute(cmd)
    result = res.fetchall()
    return result

# Deck Data

def get_everything_card():
    cmd = 'SELECT * FROM deck'
    res = cur.execute(cmd)
    return res.fetchall()

def get_deck_data(player):
    player_id = transform_username_id(player)
    cmd = f'SELECT * FROM deck WHERE id LIKE ?'
    res = cur.execute(cmd, (player_id,))
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


# Card layout persistence

def _card_src_from_name(card_name):
    if not card_name:
        return None
    return f"/static/assetsFolder/Cards/{card_name}"


def _build_deck_composition(user_id):
    """Return a Counter mapping card_src to quantity for the player's deck list."""
    rows = cur.execute('SELECT card, amount FROM deck WHERE id = ?', (user_id,)).fetchall()
    composition = Counter()
    for card_name, amount in rows:
        try:
            count = int(amount)
        except (TypeError, ValueError):
            continue
        if count <= 0:
            continue
        card_src = _card_src_from_name(card_name)
        if card_src:
            composition[card_src] += count
    return composition


def save_card_layout(player, board_cards, hand_cards, deck_cards=None):
    """Persist draggable card layout for the given player."""
    user_id = transform_username_id(player)
    with con:
        cur_new = con.cursor()
        cur_new.execute('DELETE FROM card_positions WHERE user_id = ?', (user_id,))
        insert_rows = []
        for entry in board_cards:
            insert_rows.append(
                (
                    user_id,
                    entry['card_id'],
                    entry['card_src'],
                    'board',
                    entry.get('pos_x'),
                    entry.get('pos_y'),
                    entry.get('height_ratio'),
                    entry.get('z_index'),
                    None,
                )
            )
        for order_index, entry in enumerate(hand_cards):
            insert_rows.append(
                (
                    user_id,
                    entry['card_id'],
                    entry['card_src'],
                    'hand',
                    None,
                    None,
                    None,
                    None,
                    entry.get('order_index', order_index),
                )
            )
        for order_index, entry in enumerate(deck_cards or []):
            insert_rows.append(
                (
                    user_id,
                    entry['card_id'],
                    entry['card_src'],
                    'deck',
                    None,
                    None,
                    None,
                    None,
                    entry.get('order_index', order_index),
                )
            )
        if insert_rows:
            cur_new.executemany(
                'INSERT OR REPLACE INTO card_positions('
                'user_id, card_id, card_src, zone, pos_x, pos_y, height_ratio, z_index, order_index'
                ') VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)',
                insert_rows,
            )


def _merge_missing_deck_cards(user_id, layout):
    """Ensure deck zone contains every card from the user's deck list.

    Returns a tuple of (deck_entries, modified: bool).
    """
    deck_entries = list(layout.get('deck', []))
    board_entries = layout.get('board', [])
    hand_entries = layout.get('hand', [])

    composition = _build_deck_composition(user_id)
    if not composition:
        # Nothing to sync
        return deck_entries, False

    # Filter deck entries that correspond to current composition
    filtered_deck = []
    for entry in deck_entries:
        src = entry.get('card_src')
        if src and composition.get(src, 0) > 0:
            filtered_deck.append(entry)
    deck_entries = filtered_deck

    counts = Counter()
    for entry in board_entries:
        src = entry.get('card_src')
        if src:
            counts[src] += 1
    for entry in hand_entries:
        src = entry.get('card_src')
        if src:
            counts[src] += 1
    for entry in deck_entries:
        src = entry.get('card_src')
        if src:
            counts[src] += 1

    additions = []
    for card_src, required in composition.items():
        have = counts.get(card_src, 0)
        missing = required - have
        for _ in range(max(0, missing)):
            additions.append(
                {
                    'card_id': f'deck-{uuid4()}',
                    'card_src': card_src,
                }
            )

    if additions:
        rng = random.Random(user_id)
        for entry in additions:
            idx = 0
            if deck_entries:
                idx = rng.randint(0, len(deck_entries))
            deck_entries.insert(idx, entry)

    # Ensure sequential order_index values
    for order_index, entry in enumerate(deck_entries):
        entry['order_index'] = order_index

    return deck_entries, bool(additions)


def load_card_layout(player, sync_deck=True):
    user_id = transform_username_id(player)
    cmd = (
        'SELECT card_id, card_src, zone, pos_x, pos_y, height_ratio, z_index, order_index '
        'FROM card_positions WHERE user_id = ?'
    )
    res = cur.execute(cmd, (user_id,))
    rows = res.fetchall()
    board_cards = []
    hand_cards = []
    deck_cards = []
    for card_id, card_src, zone, pos_x, pos_y, height_ratio, z_index, order_index in rows:
        if zone == 'hand':
            hand_cards.append(
                {
                    'card_id': card_id,
                    'card_src': card_src,
                    'order_index': order_index if order_index is not None else 0,
                }
            )
        elif zone == 'deck':
            deck_cards.append(
                {
                    'card_id': card_id,
                    'card_src': card_src,
                    'order_index': order_index if order_index is not None else 0,
                }
            )
        else:
            board_cards.append(
                {
                    'card_id': card_id,
                    'card_src': card_src,
                    'pos_x': pos_x,
                    'pos_y': pos_y,
                    'height_ratio': height_ratio,
                    'z_index': z_index,
                }
            )
    hand_cards.sort(key=lambda entry: entry['order_index'])
    deck_cards.sort(key=lambda entry: entry['order_index'])

    layout = {
        'board': board_cards,
        'hand': hand_cards,
        'deck': deck_cards,
    }

    if sync_deck:
        merged_deck, modified = _merge_missing_deck_cards(user_id, layout)
        if modified or merged_deck != deck_cards:
            layout['deck'] = merged_deck
            # Persist the merged deck while keeping existing board/hand state
            save_card_layout(player, board_cards, hand_cards, merged_deck)
            return load_card_layout(player, sync_deck=False)

    return layout

# Dice Mechanic

def check_player_dice_check(player, roll):
    player_id = transform_username_id(player)
    roll = int(roll)
    if roll < 11 and roll == 1:
        cmd = f'UPDATE rolls SET failedCheck = failedCheck + 1, natOne = natOne + 1 WHERE id = ?'
        cur.execute(cmd, (player_id,))
    if roll < 11 and roll != 1:
        cmd = f'UPDATE rolls SET failedCheck = failedCheck + 1 WHERE id = ?'
        cur.execute(cmd, (player_id,))
    if roll > 10 and roll == 20:
        cmd = f'UPDATE rolls SET natTwenty = natTwenty + 1 WHERE id = ?'
        cur.execute(cmd, (player_id,))
    cmd = f'UPDATE rolls SET total = total + 1 WHERE id = ?'
    cur.execute(cmd, (player_id,))
    con.commit()

def get_all_dice_roles():
    cmd = f'SELECT * FROM rolls'
    res = cur.execute(cmd)
    return res.fetchall()

# Talent Stats Grading Cat

def check_talent_existing(player, talent_name):
    player_id = transform_username_id(player)
    cmd = f'SELECT talentLevel FROM talent_stats WHERE ID = ? AND talentName = ?'
    res = cur.execute(cmd, (player_id, talent_name))
    return res.fetchone()

def update_talent(player, talent_name, talent_level):
    player_id = transform_username_id(player)
    cmd = f'UPDATE talent_stats SET talentLevel = ? WHERE ID = ? AND talentName = ?'
    cur.execute(cmd, (talent_level, player_id, talent_name))

def add_talent_level(player, talent_name, talent_level):
    player_id = transform_username_id(player)
    cmd = f'INSERT INTO talent_stats VALUES(?, ?, ?)'
    cur.execute(cmd, (player_id, talent_name, talent_level))

def load_player_talent_data(player):
    player_id = transform_username_id(player)
    cmd = f'SELECT talentName, talentLevel FROM talent_stats WHERE id = ?'
    res = cur.execute(cmd, (player_id,))
    return res.fetchall()

# Color Theme

def save_used_theme(player, theme):
    player_id = transform_username_id(player)
    cmd = f'UPDATE theme SET theme_name = ? WHERE id = ?'
    cur.execute(cmd, (theme, player_id))
    con.commit()

def load_used_theme(player, theme):
    player_id = transform_username_id(player)
    cmd = f'SELECT theme_name FROM theme WHERE id = ?'
    cur.execute(cmd, (player_id,))

#everything_player = get_everything_player()
#everything_card = get_everything_card()
#print(f'Everything Player: {everything_player}')
#print(f'Everything Cards: {everything_card}')