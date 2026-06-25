import time
import math

GRID_SPACING = 50  # cm between each letter mat


class ShortestPathSpeller:
    def __init__(self, drone, target_word: str):
        self.drone = drone
        self.is_active = False

        self.full_word = target_word.upper().replace(" ", "")
        self.remaining_letters = list(self.full_word)
        self.spelled_letters = []

        self.alphabet_map = self._generate_grid_map()
        self.current_pos = [0, 0]
        self.total_distance_traveled = 0.0
        self.flight_state = "CALCULATING_PATH"
        self.current_target = ""
        self.next_move_vector = (0, 0)

    def _generate_grid_map(self):
        """Maps A-Z to physical (x, y) grid positions in centimetres (5 cols x 5 rows)."""
        grid = {}
        for i, char in enumerate("ABCDEFGHIJKLMNOPQRSTUVWXYZ"):
            x = (i % 5) * GRID_SPACING
            y = (i // 5) * GRID_SPACING
            grid[char] = (x, y)
        return grid

    def start(self):
        self.is_active = True
        self.run_fsm()

    def stop(self):
        self.is_active = False
        self.drone.send_rc_control(0, 0, 0, 0)

    def _navigate_to(self, letter: str):
        """Flies from current grid position to the target letter using vector movement."""
        target_pos = self.alphabet_map[letter]
        dx = target_pos[0] - self.current_pos[0]
        dy = target_pos[1] - self.current_pos[1]

        self.total_distance_traveled += math.sqrt(dx ** 2 + dy ** 2)
        self.next_move_vector = (int(dx), int(dy))

        print(f"Navigating to '{letter}': dx={dx} cm, dy={dy} cm")
        self.flight_state = "TRAVERSING_GRID"

        if dx > 0:
            self.drone.move_right(int(dx))
        elif dx < 0:
            self.drone.move_left(int(abs(dx)))
        time.sleep(1)

        if dy > 0:
            self.drone.move_forward(int(dy))
        elif dy < 0:
            self.drone.move_back(int(abs(dy)))
        time.sleep(1)

        self.current_pos = [target_pos[0], target_pos[1]]

        self.flight_state = "HOVERING"
        time.sleep(3)
        print(f"Claimed: '{letter}'")

    def run_fsm(self):
        print(f"Module 4 Initiated. Word: {self.full_word}")

        while self.is_active and self.remaining_letters:
            self.current_target = self.remaining_letters.pop(0)

            if self.current_target not in self.alphabet_map:
                print(f"Letter '{self.current_target}' not in grid, skipping.")
                continue

            self.flight_state = "CALCULATING_PATH"
            try:
                self._navigate_to(self.current_target)
                self.spelled_letters.append(self.current_target)
                print(f"Spelled: {''.join(self.spelled_letters)} | "
                      f"Total distance: {self.total_distance_traveled:.1f} cm")
            except Exception as e:
                print(f"Navigation error at '{self.current_target}': {e}")
                break

        if self.is_active:
            self.flight_state = "MISSION_COMPLETE"
            self.current_target = ""
            self.next_move_vector = (0, 0)
            print(f"Path complete. Total: {self.total_distance_traveled:.1f} cm. Landing...")
            self.drone.land()
            self.is_active = False
