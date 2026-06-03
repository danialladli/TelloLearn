import time
import threading

class SwarmLeaderFollower:
    def __init__(self, drones: list, is_connected: bool):
        """
        Expects a list of drones: [Leader, Follower]
        """
        self.drones = drones
        self.is_connected = is_connected
        self.is_active = False
        
        # We need at least 2 drones for a swarm
        self.has_swarm = len(self.drones) >= 2
        
        # Telemetry State
        self.swarm_state = "IDLE"
        self.leader_pos = {"x": 0, "y": 0, "z": 0}
        self.follower_pos = {"x": 0, "y": 0, "z": 0}
        
        # Follower Offset: 50cm to the right of the leader
        self.follower_offset = {"x": 50, "y": 0, "z": 0}
        self.last_command = "NONE"

    def execute_swarm_command(self, command: str):
        if not self.has_swarm and self.is_connected:
            return {"error": "Swarm requires at least 2 drones connected."}

        self.last_command = command
        self.is_active = True
        
        if not self.is_connected:
            return self._run_mock_command(command)
        else:
            return self._run_hardware_command(command)

    def _run_mock_command(self, command: str):
        """Simulates synchronized commands and updates virtual telemetry."""
        print(f"\n[MOCK SWARM] Broadcasting Command: {command}")
        
        # Simulate Leader Execution
        self.swarm_state = f"EXECUTING: {command}"
        print(f"[MOCK LEADER] Executing {command}...")
        
        # Update Virtual Position
        if command == "takeoff":
            self.leader_pos["z"] = 100
        elif command == "land":
            self.leader_pos["z"] = 0
            self.swarm_state = "LANDED"
            self.is_active = False
        elif command == "forward":
            self.leader_pos["y"] += 30
        elif command == "back":
            self.leader_pos["y"] -= 30
            
        time.sleep(0.5) # Slight delay before follower reacts
        
        # Simulate Follower Execution (Leader-Follower Logic)
        print(f"[MOCK FOLLOWER] Mirroring Leader. Maintaining 50cm offset.")
        self.follower_pos["x"] = self.leader_pos["x"] + self.follower_offset["x"]
        self.follower_pos["y"] = self.leader_pos["y"] + self.follower_offset["y"]
        self.follower_pos["z"] = self.leader_pos["z"] + self.follower_offset["z"]
        
        print(f"[MOCK SWARM] Formation Stabilized. Leader Z:{self.leader_pos['z']} | Follower Z:{self.follower_pos['z']}")
        
        if self.swarm_state != "LANDED":
            self.swarm_state = "FORMATION_HOLD"
            
        return {"status": f"Mock Swarm Executed {command}"}

    def _run_hardware_command(self, command: str):
        """Executes parallel hardware commands using Threading."""
        
        def send_to_drone(drone_idx, cmd):
            drone = self.drones[drone_idx]
            try:
                if cmd == "takeoff": drone.takeoff()
                elif cmd == "land": drone.land()
                elif cmd == "forward": drone.move_forward(30)
                elif cmd == "back": drone.move_back(30)
                elif cmd == "left": drone.move_left(30)
                elif cmd == "right": drone.move_right(30)
                elif cmd == "up": drone.move_up(30)
                elif cmd == "down": drone.move_down(30)
            except Exception as e:
                print(f"Drone {drone_idx} Error: {e}")

        # Execute on all drones simultaneously using threads
        threads = []
        for i in range(len(self.drones)):
            t = threading.Thread(target=send_to_drone, args=(i, command))
            threads.append(t)
            t.start()
            
        # Wait for all drones to finish the command
        for t in threads:
            t.join()
            
        self.swarm_state = "FORMATION_HOLD"
        return {"status": f"Swarm Executed {command}"}

    def stop(self):
        """Emergency kill switch for the swarm."""
        self.is_active = False
        self.swarm_state = "EMERGENCY_STOP"
        if self.is_connected:
            for drone in self.drones:
                drone.send_rc_control(0, 0, 0, 0)
        else:
            print("[MOCK SWARM] Emergency Stop Triggered! All drones halted.")