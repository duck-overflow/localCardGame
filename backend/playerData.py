import json

class Player:

    def __init__(self, username, password, id=0, playerDeck=[]) -> None:       
        self.username = username
        self.password = password
        if id == 0:
            self.id = 0
        else:
            self.id = id
        self.playerDeck = playerDeck
    
    def to_array(self):
        return [
            self.username,
            self.password,
            self.id
        ]
    