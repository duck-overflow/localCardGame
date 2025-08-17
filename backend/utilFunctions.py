import os
from os import listdir

from backend.database import transform_id_username
from backend.database import search_player_data, verify_player_data, get_card_amount
from backend.database import get_all_dice_roles
from backend.database import check_talent_existing, update_talent, add_talent_level, load_player_talent_data

def get_image_list(app, player):
    cards_folder = os.path.join(app.static_folder, 'assetsFolder/Cards')
    images = []
    for image in os.listdir(cards_folder):
        if image.endswith(('.png', '.jpg', '.jpeg')):
            if int(image.rsplit('_', 2)[1]) != get_card_amount(player, image)[0][0]:
                images.append((image, get_card_amount(player, image)[0][0]))
    return images

def test_name_availability(player):
    value = search_player_data(player)
    if len(value) > 0:
        return True
    else:
        return False

def check_matching(player, password):
    value = verify_player_data(player, password)
    if len(value) > 0:
        return True
    else:
        return False

# List of Shame

def prepare_list_of_shame():

    all_rows = get_all_dice_roles()
    filtered = []

    for row in all_rows:
        player, failed_checks, nat_one, nat_twenty, total = row
        player = transform_id_username(player)

        filtered.append({
            'player': player[0],
            'failed_checks': failed_checks,
            'nat_one': nat_one,
            'nat_twenty': nat_twenty,
            'total': total
        })
    
    return filtered

# Player Talent Data Handler

def update_player_talents(player, talent_name, talent_level):
    if check_talent_existing(player, talent_name) != None:
        # Talent exists
        update_talent(player, talent_name, talent_level)
    else:
        # Talent does not exists
        add_talent_level(player, talent_name, talent_level)

def prepare_talent_data(player):
    player_data = load_player_talent_data(player)
    return player_data
    
def delete_sessions():
    my_path = 'flask_session/'
    for file_name in listdir(my_path):
        os.remove(my_path + file_name)