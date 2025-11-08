import sys
from pathlib import Path

import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend import database as db
from backend.database import delete_player_data, transform_username_id
from main import app


@pytest.fixture
def test_client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client


def _ensure_user(username: str, password: str = 'secret'):
    try:
        return transform_username_id(username)
    except ValueError:
        with db.con:
            cur = db.con.cursor()
            cur.execute('SELECT COALESCE(MAX(id), 0) + 1 FROM player')
            new_id = cur.fetchone()[0]
            cur.execute('INSERT INTO player VALUES(?, ?, ?)', (username, password, new_id))
            cur.execute('INSERT OR IGNORE INTO rolls VALUES(?, 0, 0, 0, 0)', (new_id,))
            cur.execute('INSERT OR IGNORE INTO theme VALUES(?, ?)', (new_id, 'default'))
        return new_id


@pytest.fixture
def auth_client(test_client):
    username = 'layout_tester'
    user_id = _ensure_user(username)
    with test_client.session_transaction() as session:
        session['username'] = username
    try:
        yield test_client
    finally:
        delete_player_data(username)
        if user_id is not None:
            with db.con:
                cur = db.con.cursor()
                cur.execute('DELETE FROM rolls WHERE id = ?', (user_id,))
                cur.execute('DELETE FROM theme WHERE id = ?', (user_id,))
                cur.execute('DELETE FROM deck WHERE id = ?', (user_id,))


def test_card_positions_requires_auth(test_client):
    resp = test_client.get('/api/card-positions')
    assert resp.status_code == 401


def test_card_dragger_requires_auth(test_client):
    resp = test_client.get('/card_dragger')
    assert resp.status_code == 302
    assert '/reglog' in resp.headers.get('Location', '')


def test_card_dragger_includes_initial_layout(auth_client):
    username = 'layout_tester'
    user_id = transform_username_id(username)
    with db.con:
        cur = db.con.cursor()
        cur.execute(
            'INSERT INTO deck VALUES(?, ?, ?, ?)',
            (user_id, 'Basic_spell_Spark_5_5.png', '5', 2),
        )

    resp = auth_client.get('/card_dragger')
    assert resp.status_code == 200
    html = resp.get_data(as_text=True)
    assert 'Deck <span class="count">2</span>' in html
    assert 'window.INITIAL_CARD_LAYOUT = {' in html
    assert '/static/assetsFolder/Cards/Basic_spell_Spark_5_5.png' in html


def test_card_positions_roundtrip(auth_client):
    payload = {
        'board': [
            {
                'card_id': 'primary-card',
                'card_src': '/static/assetsFolder/Cards/Basic_spell_Mass Confusion_4_6.png',
                'pos_x': 0.25,
                'pos_y': 0.4,
                'height_ratio': 0.3,
                'z_index': 12,
            },
            {
                'card_id': 'extra-card',
                'card_src': '/static/assetsFolder/Cards/Basic_spell_Pyre_5_5.png',
                'pos_x': 0.55,
                'pos_y': 0.6,
                'height_ratio': 0.25,
                'z_index': 18,
            },
        ],
        'hand': [
            {
                'card_id': 'hand-card-1',
                'card_src': '/static/assetsFolder/Cards/Basic_spell_Spark_5_5.png',
            },
            {
                'card_id': 'hand-card-2',
                'card_src': '/static/assetsFolder/Cards/Basic_spell_Sling_5_6.png',
            },
        ],
        'deck': [
            {
                'card_id': 'deck-card-1',
                'card_src': '/static/assetsFolder/Cards/Basic_spell_Spark_5_5.png',
                'order_index': 0,
            },
            {
                'card_id': 'deck-card-2',
                'card_src': '/static/assetsFolder/Cards/Basic_spell_Pyre_5_5.png',
                'order_index': 1,
            },
        ],
    }
    resp = auth_client.post('/api/card-positions', json=payload)
    assert resp.status_code == 200

    resp = auth_client.get('/api/card-positions')
    assert resp.status_code == 200
    data = resp.get_json()

    assert isinstance(data.get('board'), list)
    assert isinstance(data.get('hand'), list)
    assert isinstance(data.get('deck'), list)
    assert {card['card_id'] for card in data['board']} == {'primary-card', 'extra-card'}
    assert len(data['hand']) == 2
    assert data['hand'][0]['card_id'] == 'hand-card-1'
    assert len(data['deck']) == 2
    assert data['deck'][0]['card_id'] == 'deck-card-1'
    assert data['deck'][1]['order_index'] == 1


def test_deck_autobuilds_from_table(auth_client):
    username = 'layout_tester'
    user_id = transform_username_id(username)
    with db.con:
        cur = db.con.cursor()
        cur.execute('INSERT INTO deck VALUES(?, ?, ?, ?)', (user_id, 'Basic_spell_Spark_5_5.png', '5', 2))
        cur.execute('INSERT INTO deck VALUES(?, ?, ?, ?)', (user_id, 'Basic_spell_Pyre_5_5.png', '5', 1))

    resp = auth_client.get('/api/card-positions')
    assert resp.status_code == 200
    data = resp.get_json()

    assert data['board'] == []
    assert data['hand'] == []
    deck = data.get('deck', [])
    assert len(deck) == 3
    assert {entry['card_src'] for entry in deck} == {
        '/static/assetsFolder/Cards/Basic_spell_Spark_5_5.png',
        '/static/assetsFolder/Cards/Basic_spell_Pyre_5_5.png',
    }
    assert sum(1 for entry in deck if entry['card_src'].endswith('Spark_5_5.png')) == 2
    assert [entry['order_index'] for entry in deck] == list(range(len(deck)))


def test_deck_merges_new_cards(auth_client):
    username = 'layout_tester'
    user_id = transform_username_id(username)
    with db.con:
        cur = db.con.cursor()
        cur.execute('INSERT INTO deck VALUES(?, ?, ?, ?)', (user_id, 'Basic_spell_Spark_5_5.png', '5', 1))

    payload = {
        'board': [],
        'hand': [],
        'deck': [
            {
                'card_id': 'deck-keep',
                'card_src': '/static/assetsFolder/Cards/Basic_spell_Spark_5_5.png',
                'order_index': 0,
            }
        ],
    }
    resp = auth_client.post('/api/card-positions', json=payload)
    assert resp.status_code == 200

    with db.con:
        cur = db.con.cursor()
        cur.execute('INSERT INTO deck VALUES(?, ?, ?, ?)', (user_id, 'Basic_spell_Sling_5_6.png', '5', 1))

    resp = auth_client.get('/api/card-positions')
    assert resp.status_code == 200
    data = resp.get_json()
    deck = data.get('deck', [])

    assert len(deck) == 2
    assert {entry['card_src'] for entry in deck} == {
        '/static/assetsFolder/Cards/Basic_spell_Spark_5_5.png',
        '/static/assetsFolder/Cards/Basic_spell_Sling_5_6.png',
    }
    assert any(entry['card_id'] == 'deck-keep' for entry in deck)
