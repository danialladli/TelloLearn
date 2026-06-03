// /strings/moduleStrings.js

export const MODULE_CONTENT = [
  {
    id: 1,
    title: "Basic Flight Operations",
    docs: `**Overview:** Learn the fundamental commands to pilot a drone programmatically. You will initialize a connection, take off, execute a movement, and land safely.

* **Step 1: Initialization**
  * *Explanation:* Before sending any flight commands, you must establish a network connection with the drone's onboard computer.
  * *Code:*
    \`\`\`python
    from djitellopy import Tello
    drone = Tello()
    drone.connect()
    \`\`\`

* **Step 2: Takeoff**
  * *Explanation:* Ignites the motors and brings the drone to a stable hovering altitude (usually around 80-100cm).
  * *Code:*
    \`\`\`python
    drone.takeoff()
    \`\`\`

* **Step 3: Directional Movement**
  * *Explanation:* Commands the drone to move along a specific axis. Tello SDK movements require a distance measured in centimeters (between 20 and 500).
  * *Code:*
    \`\`\`python
    drone.move_forward(50) # Moves forward 50 cm
    \`\`\`

* **Step 4: Landing**
  * *Explanation:* Safely descends the drone to the ground and cuts power to the motors. Always include this to prevent crashes!
  * *Code:*
    \`\`\`python
    drone.land()
    \`\`\``
  },
  {
    id: 2,
    title: "Autonomous Target Landing",
    docs: `**Overview:** Introduce Computer Vision by processing the drone's live video feed to find a green landing pad and autonomously align the drone above it.

* **Step 1: Access Video Stream**
  * *Explanation:* Turn on the drone's camera and capture the current frame as a matrix of pixels.
  * *Code:*
    \`\`\`python
    drone.streamon()
    frame = drone.get_frame_read().frame
    \`\`\`

* **Step 2: Color Detection (Masking)**
  * *Explanation:* Convert the image to HSV color space and isolate pixels that fall within the specific color bounds of the green pad.
  * *Code:*
    \`\`\`python
    import cv2
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    mask = cv2.inRange(hsv, lower_green, upper_green)
    \`\`\`

* **Step 3: Centering Error Calculation**
  * *Explanation:* Find the center of the detected green pad and calculate how far off it is from the absolute center of the camera frame (the X and Y error).
  * *Code:*
    \`\`\`python
    error_x = pad_center_x - frame_center_x
    error_y = pad_center_y - frame_center_y
    \`\`\`

* **Step 4: Dynamic RC Adjustment**
  * *Explanation:* Feed the error values into the drone's manual joystick controls to slowly nudge the drone until the error is near zero.
  * *Code:*
    \`\`\`python
    # Left/Right, Forward/Back, Up/Down, Yaw
    drone.send_rc_control(speed_x, speed_y, 0, 0)
    \`\`\``
  },
  {
    id: 3,
    title: "Alphabet Recognition & Hovering",
    docs: `**Overview:** Combine Optical Character Recognition (OCR) with timed flight states to search for, identify, and "claim" specific letters to spell a word.

* **Step 1: The Spelling Queue**
  * *Explanation:* Break the target word down into a list of individual characters so the drone knows exactly what to look for next.
  * *Code:*
    \`\`\`python
    target_word = "FLY"
    queue = list(target_word) # ['F', 'L', 'Y']
    current_target = queue.pop(0)
    \`\`\`

* **Step 2: OCR Scanning**
  * *Explanation:* Slowly spin the drone (yaw) while running an OCR library on the video frames until the current_target text is detected on the floor.
  * *Code:*
    \`\`\`python
    if not letter_found:
        drone.send_rc_control(0, 0, 0, 15) # Spin slowly
    \`\`\`

* **Step 3: Alignment & Timed Hover**
  * *Explanation:* Once found and aligned, the drone must hold its exact position for 3 seconds to officially "spell" the letter.
  * *Code:*
    \`\`\`python
    import time
    start_time = time.time()
    while time.time() - start_time < 3.0:
        drone.send_rc_control(0, 0, 0, 0) # Hold completely still
    \`\`\``
  },
  {
    id: 4,
    title: "Spatial Navigation & Vectors",
    docs: `**Overview:** Map physical space using an X/Y coordinate grid. Calculate the shortest mathematical vector between two points to navigate efficiently.

* **Step 1: Grid Mapping**
  * *Explanation:* Define the physical location of alphabet mats in a dictionary, acting as the drone's internal GPS map.
  * *Code:*
    \`\`\`python
    alphabet_map = {
        'A': (0, 0),
        'B': (50, 0),
        'F': (0, 50)
    }
    \`\`\`

* **Step 2: Vector Calculation**
  * *Explanation:* Subtract the drone's current X/Y coordinates from the target's X/Y coordinates to find the exact distance needed to travel.
  * *Code:*
    \`\`\`python
    dx = target_pos[0] - current_pos[0]
    dy = target_pos[1] - current_pos[1]
    \`\`\`

* **Step 3: Axis Traversal**
  * *Explanation:* Convert the calculated vector into physical movement commands, handling positive/negative values for direction.
  * *Code:*
    \`\`\`python
    if dx > 0:
        drone.move_right(dx)
    elif dx < 0:
        drone.move_left(abs(dx))
    \`\`\``
  },
  {
    id: 5,
    title: "Swarm Leader-Follower",
    docs: `**Overview:** Orchestrate multiple drones simultaneously. A "Follower" drone will calculate an offset and automatically mirror the commands given to the "Leader" drone using multithreading.

* **Step 1: Swarm Initialization**
  * *Explanation:* Connect to two distinct drone objects on the network.
  * *Code:*
    \`\`\`python
    leader = Tello()
    follower = Tello()
    leader.connect()
    follower.connect()
    \`\`\`

* **Step 2: Offset Calculation**
  * *Explanation:* To prevent mid-air collisions, the follower calculates its position relative to the leader (e.g., maintaining a 50cm gap to the right).
  * *Code:*
    \`\`\`python
    follower_pos['x'] = leader_pos['x'] + 50
    \`\`\`

* **Step 3: Threaded Execution**
  * *Explanation:* Use Python's threading library to send the flight command to both drones at the exact same millisecond. If done sequentially, they would crash!
  * *Code:*
    \`\`\`python
    import threading
    t1 = threading.Thread(target=leader.takeoff)
    t2 = threading.Thread(target=follower.takeoff)
    
    t1.start()
    t2.start()
    
    t1.join()
    t2.join()
    \`\`\``
  }
];