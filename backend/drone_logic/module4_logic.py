import time
import math


class ShortestPathSpeller:
    def __init__(self, drone, target_word: str):
        self.drone = drone
        self.is_active = False

        self.full_word = target_word.upper().replace(" ", "")
        self.remaining_letters = list(self.full_word)
        self.spelled_letters = []

        # 5x5 grid of alphabet mats spaced 50 cm apart on the floor.
        # A=(0,0), B=(50,0), F=(0,50), …
        self.grid_spacing = 50
        self.alphabet_map = self._generate_grid_map()

        self.current_pos = (0, 0)
        self.total_distance_traveled = 0.0
        self.flight_state = "CALCULATING_PATH"
        self.current_target = ""
        self.next_move_vector = (0, 0)

    def _generate_grid_map(self):
        """Maps A-Z to physical (x, y) grid coordinates in centimetres."""
        grid = {}
        for i, char in enumerate("ABCDEFGHIJKLMNOPQRSTUVWXYZ"):
            x = (i % 5) * self.grid_spacing
            y = (i // 5) * self.grid_spacing
            grid[char] = (x, y)
        return grid

    def start(self):
        self.is_active = True
        self.run_fsm()

    def stop(self):
        self.is_active = False
        self.drone.send_rc_control(0, 0, 0, 0)

    def _calculate_vector(self, target_letter: str):
        """Returns (dx, dy) from current position to the target letter's grid position."""
        if target_letter not in self.alphabet_map:
            return 0, 0

        target_pos = self.alphabet_map[target_letter]
        dx = target_pos[0] - self.current_pos[0]
        dy = target_pos[1] - self.current_pos[1]

        self.total_distance_traveled += math.sqrt(dx ** 2 + dy ** 2)
        self.current_pos = target_pos
        return dx, dy

    def run_fsm(self):
        """
        Dead-reckoning navigation: for each letter, calculates the (dx, dy) vector
        from the current grid position and issues precise move commands to the Tello.
        The Tello SDK guarantees blocking execution for each move call, so commands
        are naturally sequential.
        """
        print(f"Module 4 Initiated. Word: {self.full_word}")

        while self.is_active and self.remaining_letters:
            self.current_target = self.remaining_letters.pop(0)

            self.flight_state = "CALCULATING_PATH"
            dx, dy = self._calculate_vector(self.current_target)
            self.next_move_vector = (dx, dy)
            print(f"Navigating to '{self.current_target}': X={dx}cm, Y={dy}cm")

            self.flight_state = "TRAVERSING_GRID"
            try:
                # Tello move commands accept 20–500 cm. Skip movements smaller than 20 cm.
                if dx > 20:
                    self.drone.move_right(int(dx))
                elif dx < -20:
                    self.drone.move_left(int(abs(dx)))

                if dy > 20:
                    self.drone.move_forward(int(dy))
                elif dy < -20:
                    self.drone.move_back(int(abs(dy)))

                self.flight_state = "HOVERING"
                time.sleep(2)  # Hover briefly so the physical mat is visually confirmed
                self.spelled_letters.append(self.current_target)
                print(f"Reached '{self.current_target}'. "
                      f"Spelled: {''.join(self.spelled_letters)} | "
                      f"Total distance: {self.total_distance_traveled:.1f} cm")

            except Exception as e:
                print(f"Navigation error at '{self.current_target}': {e}")
                break

        if self.is_active:
            self.flight_state = "MISSION_COMPLETE"
            self.current_target = ""
            print(f"Path complete. Total route: {self.total_distance_traveled:.1f} cm. Landing...")
            self.drone.land()
            self.is_active = False
