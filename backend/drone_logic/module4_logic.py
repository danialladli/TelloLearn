import time
import math

class ShortestPathSpeller:
    def __init__(self, drone, is_connected: bool, target_word: str):
        self.drone = drone
        self.is_connected = is_connected
        self.is_active = False
        
        # Word Queue
        self.full_word = target_word.upper().replace(" ", "")
        self.remaining_letters = list(self.full_word) 
        self.spelled_letters = []
        
        # --- THE SPATIAL GRID (X, Y) ---
        # Imagine a 5x5 grid of alphabet mats on the floor, spaced 50cm apart.
        # A=(0,0), B=(50,0), F=(0,50), etc.
        self.grid_spacing = 50 
        self.alphabet_map = self._generate_grid_map()
        
        # Telemetry & State
        self.current_pos = (0, 0) # Drone starts at origin
        self.total_distance_traveled = 0.0
        self.flight_state = "CALCULATING_PATH"
        self.current_target = ""
        self.next_move_vector = (0, 0)

    def _generate_grid_map(self):
        """Helper function to map A-Z to physical grid coordinates."""
        grid = {}
        alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        for i, char in enumerate(alphabet):
            x = (i % 5) * self.grid_spacing
            y = (i // 5) * self.grid_spacing
            grid[char] = (x, y)
        return grid

    def start(self):
        self.is_active = True
        if not self.is_connected:
            self.run_mock_fsm()
        else:
            self.run_fsm()

    def stop(self):
        self.is_active = False
        if self.is_connected:
            self.drone.send_rc_control(0, 0, 0, 0)
        else:
            print("[MOCK DRONE] Module 4 Emergency Stop Triggered!")

    def _calculate_vector(self, target_letter: str):
        """Calculates the physical X/Y distances to the next letter."""
        if target_letter not in self.alphabet_map:
            return 0, 0 # Skip unknown characters
            
        target_pos = self.alphabet_map[target_letter]
        dx = target_pos[0] - self.current_pos[0]
        dy = target_pos[1] - self.current_pos[1]
        
        # Update trackers
        distance = math.sqrt(dx**2 + dy**2)
        self.total_distance_traveled += distance
        self.current_pos = target_pos
        
        return dx, dy

    def run_mock_fsm(self):
        """Simulates calculating paths and traversing the grid."""
        print(f"[MOCK DRONE] Module 4: Spatial Navigation Initiated. Word: {self.full_word}")
        
        while self.is_active and len(self.remaining_letters) > 0:
            self.current_target = self.remaining_letters.pop(0)
            
            # Step 1: Calculate
            self.flight_state = "CALCULATING_PATH"
            dx, dy = self._calculate_vector(self.current_target)
            self.next_move_vector = (dx, dy)
            print(f"[MOCK DRONE] Target: '{self.current_target}'. Vector calculated: X:{dx}cm, Y:{dy}cm")
            time.sleep(1) 
            
            if not self.is_active: break
            
            # Step 2: Traverse
            self.flight_state = "TRAVERSING_GRID"
            print(f"[MOCK DRONE] Flying to '{self.current_target}'...")
            # Simulate flight time based on distance (longer distance = longer sleep)
            flight_time = max(1.5, abs(dx/50) + abs(dy/50))
            time.sleep(flight_time)
            
            if not self.is_active: break
            
            # Step 3: Arrive & Spell
            self.flight_state = "HOVERING"
            print(f"[MOCK DRONE] Reached '{self.current_target}'. Hovering to confirm...")
            time.sleep(2)
            
            self.spelled_letters.append(self.current_target)
            print(f"[MOCK DRONE] Total Distance Traveled: {self.total_distance_traveled:.1f}cm")

        if self.is_active:
            self.flight_state = "MISSION_COMPLETE"
            self.current_target = ""
            print(f"[MOCK DRONE] Path Complete! Total route distance: {self.total_distance_traveled:.1f}cm. Landing...")
            self.is_active = False

    def run_fsm(self):
        """The real flight loop using dead-reckoning navigation."""
        print(f"Module 4 Initiated. Word: {self.full_word}")
        
        while self.is_active and len(self.remaining_letters) > 0:
            self.current_target = self.remaining_letters.pop(0)
            
            self.flight_state = "CALCULATING_PATH"
            dx, dy = self._calculate_vector(self.current_target)
            self.next_move_vector = (dx, dy)
            
            self.flight_state = "TRAVERSING_GRID"
            # Real hardware execution using the Tello SDK's precise movement commands
            # Note: Tello move commands require values between 20 and 500 cm.
            try:
                # Move X-axis (Left/Right)
                if dx > 20: self.drone.move_right(int(dx))
                elif dx < -20: self.drone.move_left(int(abs(dx)))
                
                # Move Y-axis (Forward/Back)
                if dy > 20: self.drone.move_forward(int(dy))
                elif dy < -20: self.drone.move_back(int(abs(dy)))
                
                self.flight_state = "HOVERING"
                time.sleep(2) # Hover to indicate spelling
                self.spelled_letters.append(self.current_target)
                
            except Exception as e:
                print(f"Navigation Error: {e}")
                break

        if self.is_active:
            self.flight_state = "MISSION_COMPLETE"
            self.current_target = ""
            self.drone.land()
            self.is_active = False