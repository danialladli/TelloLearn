class BasicFlightController:
    def __init__(self, drone):
        self.drone = drone

    def execute(self, command: str, is_connected: bool):
        """Executes a basic flight command with built-in hardware mocking."""
        
        # HARDWARE MOCKING: If testing offline, print the command and return success
        if not is_connected:
            print(f"[MOCK DRONE] Received command: {command}")
            return {"status": f"Mock executed {command}"}
        
        try:
            # Flight State
            if command == "takeoff": self.drone.takeoff()
            elif command == "land": self.drone.land()
            
            # Z-axis (Altitude)
            elif command == "up": self.drone.move_up(30)
            elif command == "down": self.drone.move_down(30)
            
            # Y-axis (Pitch)
            elif command == "forward": self.drone.move_forward(50)
            elif command == "back": self.drone.move_back(50)
            
            # X-axis (Roll)
            elif command == "left": self.drone.move_left(50)
            elif command == "right": self.drone.move_right(50)
            
            # Yaw (Rotation)
            elif command == "cw": self.drone.rotate_clockwise(90)   
            elif command == "cw": self.drone.rotate_clockwise(180)   
            elif command == "cw": self.drone.rotate_clockwise(270)   
            elif command == "cw": self.drone.rotate_clockwise(360)   
            
            else:
                return {"error": f"Unknown command: {command}"}

            return {"status": f"Executed {command}"}
            
        except Exception as e:
            return {"error": str(e)}
        
    def send_rc(self, lr: int, fb: int, ud: int, yaw: int, is_connected: bool):
        """Handles continuous joystick data with terminal flood protection."""
        
        # HARDWARE MOCKING
        if not is_connected:
            # Flood Protection: Only print if the user is actually moving the stick
            if lr != 0 or fb != 0 or ud != 0 or yaw != 0:
                print(f"\r[MOCK JOYSTICK] LR:{lr:^4} FB:{fb:^4} UD:{ud:^4} YAW:{yaw:^4}", end="")
            return {"status": "Mock RC received"}
        
        # REAL DRONE HARDWARE
        try:
            self.drone.send_rc_control(lr, fb, ud, yaw)
            return {"status": "ok"}
        except Exception as e:
            return {"error": str(e)}