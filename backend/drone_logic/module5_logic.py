import threading


class SwarmLeaderFollower:
    def __init__(self, drones: list):
        """
        drones[0] = Leader Tello
        drones[1] = Follower Tello (maintains a fixed 50 cm X-offset from the leader)
        """
        self.drones = drones
        self.is_active = False
        self.has_swarm = len(self.drones) >= 2

        self.swarm_state = "IDLE"
        self.last_command = "NONE"

        # Dead-reckoning positions for telemetry (cm, relative to takeoff point)
        self.leader_pos = {"x": 0, "y": 0, "z": 0}
        self.follower_pos = {"x": 50, "y": 0, "z": 0}  # Follower is 50 cm to the right
        self.follower_offset = {"x": 50, "y": 0, "z": 0}

    def execute_swarm_command(self, command: str):
        if not self.has_swarm:
            return {"error": "Swarm requires at least 2 drones connected."}

        self.last_command = command
        self.is_active = True
        return self._run_hardware_command(command)

    def _run_hardware_command(self, command: str):
        """
        Broadcasts the same command to all drones simultaneously via threading,
        then updates dead-reckoning positions for the telemetry endpoint.
        """
        def send_to_drone(drone, cmd):
            try:
                if cmd == "takeoff":   drone.takeoff()
                elif cmd == "land":    drone.land()
                elif cmd == "forward": drone.move_forward(30)
                elif cmd == "back":    drone.move_back(30)
                elif cmd == "left":    drone.move_left(30)
                elif cmd == "right":   drone.move_right(30)
                elif cmd == "up":      drone.move_up(30)
                elif cmd == "down":    drone.move_down(30)
                elif cmd == "cw":      drone.rotate_clockwise(90)
                elif cmd == "ccw":     drone.rotate_counter_clockwise(90)
            except Exception as e:
                print(f"Drone error on '{cmd}': {e}")

        threads = [threading.Thread(target=send_to_drone, args=(d, command)) for d in self.drones]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        # Update dead-reckoning leader position
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
        elif command == "left":
            self.leader_pos["x"] -= 30
        elif command == "right":
            self.leader_pos["x"] += 30
        elif command == "up":
            self.leader_pos["z"] += 30
        elif command == "down":
            self.leader_pos["z"] = max(0, self.leader_pos["z"] - 30)

        # Follower mirrors the leader while maintaining its fixed offset
        self.follower_pos["x"] = self.leader_pos["x"] + self.follower_offset["x"]
        self.follower_pos["y"] = self.leader_pos["y"] + self.follower_offset["y"]
        self.follower_pos["z"] = self.leader_pos["z"] + self.follower_offset["z"]

        if self.swarm_state != "LANDED":
            self.swarm_state = "FORMATION_HOLD"

        return {"status": f"Swarm executed {command}"}

    def stop(self):
        """Emergency kill: halts all RC input on every drone immediately."""
        self.is_active = False
        self.swarm_state = "EMERGENCY_STOP"
        for drone in self.drones:
            try:
                drone.send_rc_control(0, 0, 0, 0)
            except Exception as e:
                print(f"Emergency stop error: {e}")
