import os

from backend.database import search_player_data, verify_player_data, transform_username_id, get_card_amount

def get_image_list(app, player):
    cards_folder = os.path.join(app.static_folder, 'assetsFolder/Cards')
    images = []
    for image in os.listdir(cards_folder):
        if image.endswith(('.png', '.jpg', '.jpeg')):
            if int(image.rsplit('_', 2)[1]) != get_card_amount(player, image)[0][0]:
                images.append((image, get_card_amount(player, image)[0][0]))
    return images

def test_name_availability(username):
    value = search_player_data(username)
    if len(value) > 0:
        return True
    else:
        return False

def check_matching(username, password):
    value = verify_player_data(username, password)
    if len(value) > 0:
        return True
    else:
        return False