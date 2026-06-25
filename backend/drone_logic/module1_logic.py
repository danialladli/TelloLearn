class BasicFlightController:
    def __init__(self, drone):
        self.drone = drone

    def execute(self, command: str):
        """Executes a single flight command. Supports 'cmd' and 'cmd distance' formats."""
        try:
            parts = command.strip().split()
            cmd = parts[0].lower()
            dist = int(parts[1]) if len(parts) > 1 else 0

            if cmd == "takeoff":
                self.drone.takeoff()
            elif cmd == "land":
                self.drone.land()
            elif cmd == "stop":
                self.drone.send_rc_control(0, 0, 0, 0)
            elif cmd == "up":
                self.drone.move_up(dist or 30)
            elif cmd == "down":
                self.drone.move_down(dist or 30)
            elif cmd == "forward":
                self.drone.move_forward(dist or 50)
            elif cmd == "back":
                self.drone.move_back(dist or 50)
            elif cmd == "left":
                self.drone.move_left(dist or 50)
            elif cmd == "right":
                self.drone.move_right(dist or 50)
            elif cmd == "cw":
                self.drone.rotate_clockwise(dist or 90)
            elif cmd == "ccw":
                self.drone.rotate_counter_clockwise(dist or 90)
            elif cmd == "flip_f":
                self.drone.flip_forward()
            elif cmd == "flip_b":
                self.drone.flip_back()
            elif cmd == "flip_l":
                self.drone.flip_left()
            elif cmd == "flip_r":
                self.drone.flip_right()
            else:
                return {"error": f"Unknown command: {command}"}

            return {"status": f"Executed: {command}"}

        except Exception as e:
            return {"error": str(e)}

    def send_rc(self, lr: int, fb: int, ud: int, yaw: int):
        """Sends continuous joystick data to the real Tello drone."""
        try:
            self.drone.send_rc_control(lr, fb, ud, yaw)
            return {"status": "ok"}
        except Exception as e:
            return {"error": str(e)}
