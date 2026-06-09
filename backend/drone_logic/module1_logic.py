class BasicFlightController:
    def __init__(self, drone):
        self.drone = drone

    def execute(self, command: str):
        """Executes a single flight command on the real Tello drone."""
        try:
            if command == "takeoff":
                self.drone.takeoff()
            elif command == "land":
                self.drone.land()
            elif command == "up":
                self.drone.move_up(30)
            elif command == "down":
                self.drone.move_down(30)
            elif command == "forward":
                self.drone.move_forward(50)
            elif command == "back":
                self.drone.move_back(50)
            elif command == "left":
                self.drone.move_left(50)
            elif command == "right":
                self.drone.move_right(50)
            elif command == "cw":
                self.drone.rotate_clockwise(90)
            elif command == "ccw":
                self.drone.rotate_counter_clockwise(90)
            elif command == "flip_f":
                self.drone.flip_forward()
            elif command == "flip_b":
                self.drone.flip_back()
            elif command == "flip_l":
                self.drone.flip_left()
            elif command == "flip_r":
                self.drone.flip_right()
            else:
                return {"error": f"Unknown command: {command}"}

            return {"status": f"Executed {command}"}

        except Exception as e:
            return {"error": str(e)}

    def send_rc(self, lr: int, fb: int, ud: int, yaw: int):
        """Sends continuous joystick data to the real Tello drone."""
        try:
            self.drone.send_rc_control(lr, fb, ud, yaw)
            return {"status": "ok"}
        except Exception as e:
            return {"error": str(e)}
