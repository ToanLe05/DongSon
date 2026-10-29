"""Bot inference entry point. Training code and model files belong elsewhere."""
import random


class BotAgent:
    def select_move(self, game):
        """Chọn và trả về một nước đi; không thay đổi ván cờ."""
        moves = game.legal_moves()
        return random.choice(moves) if moves else None
