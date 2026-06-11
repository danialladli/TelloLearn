// /strings/moduleStrings.js

export const MODULE_CONTENT = [
  {
    id: 1,
    title: "Basic Flight Operations",
    default_code: `from djitellopy import Tello
import time

# Connect to the drone
drone = Tello()
drone.connect()
print("Battery:", drone.get_battery(), "%")

# Take off and hover
drone.takeoff()
time.sleep(2)

# Fly a square pattern (50 cm per side)
drone.move_forward(50)
time.sleep(1)

drone.move_right(50)
time.sleep(1)

drone.move_back(50)
time.sleep(1)

drone.move_left(50)
time.sleep(1)

# Rotate in place
drone.rotate_clockwise(180)
time.sleep(1)

# Land safely
drone.land()
print("Mission complete!")`,
    docs: `OVERVIEW
--------
In this module, you will learn how to control a Tello drone using Python.
You will connect to the drone, take off, fly in different directions, rotate,
and land safely. This is the foundation of all drone programming.

No prior drone experience is needed. Just follow each step carefully.


WHAT YOU WILL LEARN
--------------------
- How to establish a connection with the drone
- How to take off and land
- How to move the drone forward, back, left, and right
- How to rotate (yaw) the drone clockwise and counter-clockwise
- How to chain multiple commands into a flight routine


STEP 1 - Import and Connect
-----------------------------
The djitellopy library handles all communication with the Tello drone.
When you call connect(), the drone confirms it is ready to receive commands.

    from djitellopy import Tello
    import time

    drone = Tello()
    drone.connect()

    print("Connected! Battery:", drone.get_battery(), "%")

Always check the battery before flying. If it is below 20%, charge it first.


STEP 2 - Take Off
------------------
takeoff() spins up the motors and lifts the drone to a stable hover height
of about 80 to 100 cm above the ground. The drone will hold that height
automatically until you give another command.

    drone.takeoff()
    time.sleep(2)  # Wait 2 seconds to let the drone stabilise


STEP 3 - Move in Directions
-----------------------------
All distances are measured in centimetres. The minimum is 20 cm and the
maximum is 500 cm per command. Always add a short sleep after each move
to give the drone time to complete the movement before the next command.

    drone.move_forward(50)   # Fly forward 50 cm
    time.sleep(1)

    drone.move_back(50)      # Fly backward 50 cm
    time.sleep(1)

    drone.move_left(50)      # Strafe left 50 cm
    time.sleep(1)

    drone.move_right(50)     # Strafe right 50 cm
    time.sleep(1)


STEP 4 - Rotate the Drone
---------------------------
Rotating changes which direction the drone considers "forward".
Rotation is measured in degrees from 1 to 360.

    drone.rotate_clockwise(90)          # Turn right 90 degrees
    time.sleep(1)

    drone.rotate_counter_clockwise(90)  # Turn left 90 degrees
    time.sleep(1)


STEP 5 - Land Safely
---------------------
Always end your program with land(). This brings the drone down gently
and cuts the motors. Never kill the program without landing first.

    drone.land()


FULL MISSION CODE
-----------------
This complete example connects to the drone, flies a square pattern,
then lands. Use this as a reference when writing your own mission.

    from djitellopy import Tello
    import time

    # Connect
    drone = Tello()
    drone.connect()
    print("Battery:", drone.get_battery(), "%")

    # Take off
    drone.takeoff()
    time.sleep(2)

    # Fly a square (4 sides x 50 cm)
    drone.move_forward(50)
    time.sleep(1)

    drone.move_right(50)
    time.sleep(1)

    drone.move_back(50)
    time.sleep(1)

    drone.move_left(50)
    time.sleep(1)

    # Rotate in place
    drone.rotate_clockwise(180)
    time.sleep(1)

    # Land
    drone.land()
    print("Mission complete!")`
  },
  {
    id: 2,
    title: "Autonomous Target Landing",
    default_code: `from djitellopy import Tello
import cv2
import numpy as np
import time

# Colour range for the green landing pad (HSV)
LOWER_GREEN = np.array([40, 70, 70])
UPPER_GREEN = np.array([80, 255, 255])

# Frame centre and control settings
FRAME_CX, FRAME_CY = 180, 120
TOLERANCE = 25
GAIN = 0.3

drone = Tello()
drone.connect()
drone.streamon()
time.sleep(2)

drone.takeoff()
time.sleep(2)

landed = False

for _ in range(500):
    frame = drone.get_frame_read().frame
    frame = cv2.resize(frame, (360, 240))

    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    mask = cv2.inRange(hsv, LOWER_GREEN, UPPER_GREEN)
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    if contours:
        largest = max(contours, key=cv2.contourArea)
        if cv2.contourArea(largest) > 500:
            x, y, w, h = cv2.boundingRect(largest)
            pad_cx = x + w // 2
            pad_cy = y + h // 2

            error_x = pad_cx - FRAME_CX
            error_y = pad_cy - FRAME_CY

            if abs(error_x) < TOLERANCE and abs(error_y) < TOLERANCE:
                drone.send_rc_control(0, 0, 0, 0)
                time.sleep(0.5)
                drone.land()
                landed = True
                break

            speed_lr = int(error_x * GAIN)
            speed_fb = int(error_y * GAIN)
            drone.send_rc_control(speed_lr, speed_fb, 0, 0)
    else:
        drone.send_rc_control(0, 0, 0, 0)

    time.sleep(0.05)

if not landed:
    drone.land()

print("Mission complete!")`,
    docs: `OVERVIEW
--------
In this module, the drone uses its front camera and computer vision to find
a coloured landing pad on the ground and autonomously land on it — without
any manual control from you.

You will learn how cameras see colour, how to detect objects in video frames,
and how to translate visual errors into flight corrections.


WHAT YOU WILL LEARN
--------------------
- How to turn on the drone camera and read live video frames
- How HSV colour space works and why it is better than RGB for detection
- How to create a colour mask to isolate a specific object
- How to find the centre of a detected object using contours
- How to calculate the error between the drone and the target
- How to use RC controls to correct the drone position in real time


STEP 1 - Start the Camera
---------------------------
streamon() activates the front camera. get_frame_read().frame returns
the current video frame as a NumPy array (a grid of pixel colour values).

    from djitellopy import Tello
    import cv2
    import numpy as np
    import time

    drone = Tello()
    drone.connect()
    drone.streamon()
    time.sleep(2)  # Give camera time to warm up

    frame = drone.get_frame_read().frame
    frame = cv2.resize(frame, (360, 240))


STEP 2 - Convert Colours to HSV
---------------------------------
RGB stores colour as Red, Green, Blue values. HSV (Hue, Saturation, Value)
is much better for detecting colours under different lighting conditions
because Hue captures the actual colour independently from brightness.

    hsv_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)

    # Define the colour range for the green pad
    LOWER_GREEN = np.array([40, 70, 70])
    UPPER_GREEN = np.array([80, 255, 255])

    # Create a mask: white pixels = green detected, black = not green
    mask = cv2.inRange(hsv_frame, LOWER_GREEN, UPPER_GREEN)


STEP 3 - Find the Pad Centre
------------------------------
Contours are outlines drawn around the white blobs in the mask.
We find the largest contour (the pad) and calculate its centre point.

    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    if contours:
        largest = max(contours, key=cv2.contourArea)
        x, y, w, h = cv2.boundingRect(largest)

        pad_cx = x + w // 2   # Horizontal centre of the pad
        pad_cy = y + h // 2   # Vertical centre of the pad


STEP 4 - Calculate the Error
------------------------------
The error is how far the pad centre is from the middle of the camera frame.
If error_x is positive, the pad is to the right. If negative, it is to the left.
Same logic applies to error_y for forward and backward correction.

    FRAME_CX = 180  # Half of frame width (360 / 2)
    FRAME_CY = 120  # Half of frame height (240 / 2)

    error_x = pad_cx - FRAME_CX  # Positive = pad is right of centre
    error_y = pad_cy - FRAME_CY  # Positive = pad is below centre (forward)


STEP 5 - Correct Position with RC Control
-------------------------------------------
send_rc_control takes four values: left/right, forward/back, up/down, yaw.
We multiply the error by a small number (gain) to create smooth corrections.

    GAIN = 0.3
    TOLERANCE = 20  # Stop correcting when within 20 pixels of centre

    speed_lr = int(error_x * GAIN)  # Positive error_x = pad is right = move right
    speed_fb = int(error_y * GAIN)  # Positive error_y = pad is below = move forward

    if abs(error_x) < TOLERANCE and abs(error_y) < TOLERANCE:
        drone.send_rc_control(0, 0, 0, 0)  # Centred! Stop moving
        drone.land()
    else:
        drone.send_rc_control(speed_lr, speed_fb, 0, 0)


FULL MISSION CODE
-----------------
This complete example takes off, searches for the green pad using a live
camera loop, centres above it, then lands automatically.

    from djitellopy import Tello
    import cv2
    import numpy as np
    import time

    LOWER_GREEN = np.array([40, 70, 70])
    UPPER_GREEN = np.array([80, 255, 255])
    FRAME_CX, FRAME_CY = 180, 120
    TOLERANCE = 25
    GAIN = 0.3

    drone = Tello()
    drone.connect()
    drone.streamon()
    time.sleep(2)

    drone.takeoff()
    time.sleep(2)

    landed = False

    for _ in range(500):
        frame = drone.get_frame_read().frame
        frame = cv2.resize(frame, (360, 240))
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        mask = cv2.inRange(hsv, LOWER_GREEN, UPPER_GREEN)
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        if contours:
            largest = max(contours, key=cv2.contourArea)
            if cv2.contourArea(largest) > 500:
                x, y, w, h = cv2.boundingRect(largest)
                pad_cx = x + w // 2
                pad_cy = y + h // 2
                error_x = pad_cx - FRAME_CX
                error_y = pad_cy - FRAME_CY

                if abs(error_x) < TOLERANCE and abs(error_y) < TOLERANCE:
                    drone.send_rc_control(0, 0, 0, 0)
                    time.sleep(0.5)
                    drone.land()
                    landed = True
                    break

                speed_lr = int(error_x * GAIN)
                speed_fb = int(error_y * GAIN)
                drone.send_rc_control(speed_lr, speed_fb, 0, 0)
        else:
            drone.send_rc_control(0, 0, 0, 0)

        time.sleep(0.05)

    if not landed:
        drone.land()

    print("Mission complete!")`
  },
  {
    id: 3,
    title: "Alphabet Recognition & Hovering",
    default_code: `from djitellopy import Tello
import cv2
import pytesseract
from pytesseract import Output
import time

TARGET_WORD = "FLY"
HOVER_DURATION = 3.0
SPIN_SPEED = 15
GAIN = 0.3
TOLERANCE = 30
FRAME_CX, FRAME_CY = 180, 120

drone = Tello()
drone.connect()
drone.streamon()
time.sleep(2)

queue = list(TARGET_WORD)
current_target = queue.pop(0)
state = "SEARCHING"
hover_start = None

drone.takeoff()
time.sleep(2)

while True:
    frame = drone.get_frame_read().frame
    frame = cv2.resize(frame, (360, 240))
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

    # Get text AND bounding box position from pytesseract
    config = '--psm 10 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    data = pytesseract.image_to_data(gray, config=config, output_type=Output.DICT)

    found = False
    letter_cx, letter_cy = None, None

    for i, text in enumerate(data['text']):
        if current_target in text.strip():
            x = data['left'][i]
            y = data['top'][i]
            w = data['width'][i]
            h = data['height'][i]
            if w > 0 and h > 0:
                letter_cx = x + w // 2
                letter_cy = y + h // 2
                found = True
                break

    if state == "SEARCHING":
        if found:
            state = "ALIGNING"
            print("Found " + current_target + "! Aligning...")
        else:
            drone.send_rc_control(0, 0, 0, SPIN_SPEED)

    elif state == "ALIGNING":
        if not found:
            state = "SEARCHING"
        else:
            error_x = letter_cx - FRAME_CX
            error_y = letter_cy - FRAME_CY

            if abs(error_x) < TOLERANCE and abs(error_y) < TOLERANCE:
                drone.send_rc_control(0, 0, 0, 0)
                state = "HOVERING"
                hover_start = time.time()
                print("Aligned! Hovering over " + current_target)
            else:
                speed_lr = int(error_x * GAIN)
                speed_ud = -int(error_y * GAIN)
                drone.send_rc_control(speed_lr, 0, speed_ud, 0)

    elif state == "HOVERING":
        drone.send_rc_control(0, 0, 0, 0)
        if time.time() - hover_start >= HOVER_DURATION:
            print("Spelled: " + current_target)
            if queue:
                current_target = queue.pop(0)
                state = "SEARCHING"
                print("Now looking for: " + current_target)
            else:
                break

    time.sleep(0.05)

drone.land()
print("Word spelled: " + TARGET_WORD)`,
    docs: `OVERVIEW
--------
In this module, the drone searches for physical letter mats on the ground
using its camera and OCR (Optical Character Recognition). When it spots the
correct letter, it precisely aligns itself above it, then hovers for 3 seconds
to claim it, and moves on to the next letter to spell a target word.

Think of it like a drone spelling bee where the drone must park directly
above each letter before scoring it.


WHAT YOU WILL LEARN
--------------------
- What OCR is and how it reads text AND position from images
- How image_to_data() returns bounding box coordinates for each character
- How to calculate the alignment error from bounding box vs frame centre
- How to use RC controls to steer the drone above a detected letter
- How a Finite State Machine (FSM) organises complex drone behaviour


WHAT IS A STATE MACHINE?
-------------------------
A state machine is a way of organising behaviour into distinct stages.
The drone is always in exactly one of these four states:

    SEARCHING  - Spinning slowly, scanning for the next target letter
    ALIGNING   - Letter found, moving to centre the drone above it
    HOVERING   - Centred and holding still for 3 seconds to claim the letter
    (loop end) - All letters spelled, land

The drone transitions between states based on what the camera sees.


STEP 1 - Set Up the Letter Queue
----------------------------------
We break the target word into a list. The drone tackles one letter at a time.

    target_word = "FLY"
    queue = list(target_word)       # Creates: ['F', 'L', 'Y']
    current_target = queue.pop(0)   # Takes 'F' from the front
    print("Looking for:", current_target)


STEP 2 - Start the Camera and Take Off
----------------------------------------
    from djitellopy import Tello
    import cv2
    import pytesseract
    from pytesseract import Output
    import time

    drone = Tello()
    drone.connect()
    drone.streamon()
    time.sleep(2)

    drone.takeoff()
    time.sleep(2)


STEP 3 - Read Letter Position with image_to_data()
----------------------------------------------------
image_to_string() only tells you WHAT text it sees.
image_to_data() tells you WHAT and WHERE — it returns a dictionary
with bounding box coordinates (left, top, width, height) for every
detected character.

    config = '--psm 10 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    data = pytesseract.image_to_data(gray, config=config, output_type=Output.DICT)

    # Loop through every detected word in the data
    for i, text in enumerate(data['text']):
        if current_target in text.strip():
            x = data['left'][i]    # Left edge of the bounding box
            y = data['top'][i]     # Top edge of the bounding box
            w = data['width'][i]   # Width of the bounding box
            h = data['height'][i]  # Height of the bounding box

            if w > 0 and h > 0:
                letter_cx = x + w // 2   # Centre X of the letter
                letter_cy = y + h // 2   # Centre Y of the letter
                found = True


STEP 4 - SEARCHING State (Spin to Scan)
-----------------------------------------
If the target letter is not found in this frame, spin the drone slowly.
A yaw speed of 15 is a gentle rotation — not too fast or the camera image
will blur and OCR will fail.

    if state == "SEARCHING":
        if found:
            state = "ALIGNING"
            print("Found " + current_target + "! Aligning...")
        else:
            drone.send_rc_control(0, 0, 0, 15)  # Spin right slowly


STEP 5 - ALIGNING State (Centre Above the Letter)
---------------------------------------------------
Once found, we calculate how far the letter is from the centre of the frame
and fly toward it. FRAME_CX and FRAME_CY are the centre of the 360x240 frame.
GAIN scales the error into a speed (-100 to 100). TOLERANCE is the pixel
margin within which we consider the drone "aligned".

    FRAME_CX, FRAME_CY = 180, 120
    GAIN = 0.3
    TOLERANCE = 30

    if state == "ALIGNING":
        if not found:
            state = "SEARCHING"   # Lost the letter, go back to scanning
        else:
            error_x = letter_cx - FRAME_CX   # Positive = letter is right of centre
            error_y = letter_cy - FRAME_CY   # Positive = letter is below centre

            if abs(error_x) < TOLERANCE and abs(error_y) < TOLERANCE:
                drone.send_rc_control(0, 0, 0, 0)
                state = "HOVERING"
                hover_start = time.time()
                print("Aligned! Hovering over " + current_target)
            else:
                speed_lr = int(error_x * GAIN)    # Positive error_x = letter right = move right
                speed_ud = -int(error_y * GAIN)   # Positive error_y = letter below = move down (negate)
                drone.send_rc_control(speed_lr, 0, speed_ud, 0)


STEP 6 - HOVERING State (Hold for 3 Seconds)
----------------------------------------------
Once aligned, stop moving and stay still. After 3 seconds the letter is
"claimed" and we move to the next one in the queue.

    elif state == "HOVERING":
        drone.send_rc_control(0, 0, 0, 0)
        if time.time() - hover_start >= HOVER_DURATION:
            print("Spelled: " + current_target)
            if queue:
                current_target = queue.pop(0)
                state = "SEARCHING"
            else:
                break   # All letters spelled!


FULL MISSION CODE
-----------------
This complete example spells "FLY" by searching, aligning, and hovering
above each letter using precise bounding-box-based positioning.

    from djitellopy import Tello
    import cv2
    import pytesseract
    from pytesseract import Output
    import time

    TARGET_WORD = "FLY"
    HOVER_DURATION = 3.0
    SPIN_SPEED = 15
    GAIN = 0.3
    TOLERANCE = 30
    FRAME_CX, FRAME_CY = 180, 120

    drone = Tello()
    drone.connect()
    drone.streamon()
    time.sleep(2)

    queue = list(TARGET_WORD)
    current_target = queue.pop(0)
    state = "SEARCHING"
    hover_start = None

    drone.takeoff()
    time.sleep(2)

    while True:
        frame = drone.get_frame_read().frame
        frame = cv2.resize(frame, (360, 240))
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        config = '--psm 10 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ'
        data = pytesseract.image_to_data(gray, config=config, output_type=Output.DICT)

        found = False
        letter_cx, letter_cy = None, None

        for i, text in enumerate(data['text']):
            if current_target in text.strip():
                x = data['left'][i]
                y = data['top'][i]
                w = data['width'][i]
                h = data['height'][i]
                if w > 0 and h > 0:
                    letter_cx = x + w // 2
                    letter_cy = y + h // 2
                    found = True
                    break

        if state == "SEARCHING":
            if found:
                state = "ALIGNING"
                print("Found " + current_target + "! Aligning...")
            else:
                drone.send_rc_control(0, 0, 0, SPIN_SPEED)

        elif state == "ALIGNING":
            if not found:
                state = "SEARCHING"
            else:
                error_x = letter_cx - FRAME_CX
                error_y = letter_cy - FRAME_CY
                if abs(error_x) < TOLERANCE and abs(error_y) < TOLERANCE:
                    drone.send_rc_control(0, 0, 0, 0)
                    state = "HOVERING"
                    hover_start = time.time()
                    print("Aligned! Hovering over " + current_target)
                else:
                    speed_lr = int(error_x * GAIN)
                    speed_ud = -int(error_y * GAIN)
                    drone.send_rc_control(speed_lr, 0, speed_ud, 0)

        elif state == "HOVERING":
            drone.send_rc_control(0, 0, 0, 0)
            if time.time() - hover_start >= HOVER_DURATION:
                print("Spelled: " + current_target)
                if queue:
                    current_target = queue.pop(0)
                    state = "SEARCHING"
                    print("Now looking for: " + current_target)
                else:
                    break

        time.sleep(0.05)

    drone.land()
    print("Word spelled: " + TARGET_WORD)`
  },
  {
    id: 4,
    title: "Spatial Navigation & Vectors",
    default_code: `from djitellopy import Tello
import time

# Grid map: each letter maps to an (X, Y) position in centimetres
ALPHABET_MAP = {
    'A': (0,   0),
    'B': (50,  0),
    'C': (100, 0),
    'F': (0,   50),
    'L': (50,  50),
    'Y': (100, 50),
}

TARGET_WORD = "FLY"
current_pos = [0, 0]

drone = Tello()
drone.connect()
time.sleep(1)
print("Battery:", drone.get_battery(), "%")

def navigate_to(letter):
    global current_pos

    target_pos = ALPHABET_MAP[letter]
    dx = target_pos[0] - current_pos[0]
    dy = target_pos[1] - current_pos[1]

    print("Navigating to " + letter + " | dx=" + str(dx) + " dy=" + str(dy))

    # Move along X axis
    if dx > 0:
        drone.move_right(dx)
    elif dx < 0:
        drone.move_left(abs(dx))
    time.sleep(1)

    # Move along Y axis
    if dy > 0:
        drone.move_forward(dy)
    elif dy < 0:
        drone.move_back(abs(dy))
    time.sleep(1)

    # Update current position
    current_pos[0] = target_pos[0]
    current_pos[1] = target_pos[1]

    # Hover to claim the letter
    time.sleep(3)
    print("Claimed: " + letter)

drone.takeoff()
time.sleep(2)

for letter in TARGET_WORD:
    navigate_to(letter)

drone.land()
print("Mission complete! Spelled: " + TARGET_WORD)`,
    docs: `OVERVIEW
--------
In this module, the drone navigates a physical grid of alphabet mats placed
on the floor. Each mat has a known position in centimetres. The drone uses
vector mathematics to calculate the most direct path between letters and
fly there efficiently to spell a target word.

This simulates how real autonomous drones use coordinate systems to navigate.


WHAT YOU WILL LEARN
--------------------
- How to represent physical space as a coordinate grid (X/Y axes)
- How to store known positions in a dictionary (the map)
- How to calculate a vector between two points
- How to convert a vector into forward/back and left/right drone commands
- How to track the drone's current position in code
- How to chain multi-letter navigation into a complete spelling mission


UNDERSTANDING THE COORDINATE GRID
-----------------------------------
Imagine the room floor as a graph. The drone starts at position (0, 0).
Each letter mat is placed at a known (X, Y) coordinate in centimetres.

    X axis = left and right (positive X = right)
    Y axis = forward and backward (positive Y = forward)

Example layout on the floor:

    (0, 100)   (50, 100)   (100, 100)
       G           H           I

    (0, 50)    (50, 50)    (100, 50)
       D           E           F

    (0, 0)     (50, 0)     (100, 0)
       A           B           C

To fly from A to F, the vector is: X = 100 - 0 = 100, Y = 50 - 0 = 50.
So fly right 100 cm, then forward 50 cm.


STEP 1 - Define the Map
------------------------
Store each letter and its (X, Y) position in a Python dictionary.
This acts as the drone's internal GPS.

    ALPHABET_MAP = {
        'A': (0,   0),
        'B': (50,  0),
        'C': (100, 0),
        'D': (0,   50),
        'E': (50,  50),
        'F': (100, 50),
        'G': (0,   100),
        'H': (50,  100),
        'I': (100, 100),
    }


STEP 2 - Calculate the Vector
-------------------------------
To find out how far and in which direction to fly, subtract the current
position from the target position. The result is the dx and dy vector.

    current_pos = [0, 0]   # Drone starts at A (0, 0)
    target_letter = 'F'
    target_pos = ALPHABET_MAP[target_letter]  # (100, 50)

    dx = target_pos[0] - current_pos[0]   # 100 - 0 = 100 (fly right)
    dy = target_pos[1] - current_pos[1]   # 50  - 0 = 50  (fly forward)


STEP 3 - Convert Vector to Movement Commands
---------------------------------------------
The sign of dx and dy tells us the direction. We check whether to move
right or left, and forward or backward.

    import time

    if dx > 0:
        drone.move_right(dx)
    elif dx < 0:
        drone.move_left(abs(dx))
    time.sleep(1)

    if dy > 0:
        drone.move_forward(dy)
    elif dy < 0:
        drone.move_back(abs(dy))
    time.sleep(1)


STEP 4 - Update Position and Hover to Claim the Letter
--------------------------------------------------------
After flying to the target, update current_pos so the next calculation
starts from the correct location. Hover for 3 seconds to claim the letter.

    current_pos[0] = target_pos[0]
    current_pos[1] = target_pos[1]

    time.sleep(3)   # Hover for 3 seconds to claim the letter
    print("Claimed:", target_letter)


FULL MISSION CODE
-----------------
This complete example spells the word "FLY" by navigating the grid in order.
A helper function handles the vector calculation and movement for each letter.

    from djitellopy import Tello
    import time

    ALPHABET_MAP = {
        'A': (0,   0),
        'B': (50,  0),
        'C': (100, 0),
        'F': (0,   50),
        'L': (50,  50),
        'Y': (100, 50),
    }

    TARGET_WORD = "FLY"
    current_pos = [0, 0]

    drone = Tello()
    drone.connect()
    time.sleep(1)
    print("Battery:", drone.get_battery(), "%")

    def navigate_to(letter):
        global current_pos

        target_pos = ALPHABET_MAP[letter]
        dx = target_pos[0] - current_pos[0]
        dy = target_pos[1] - current_pos[1]

        print(f"Flying to {letter} at {target_pos}. Vector: dx={dx}, dy={dy}")

        # Move along X axis first
        if dx > 0:
            drone.move_right(dx)
        elif dx < 0:
            drone.move_left(abs(dx))
        time.sleep(1)

        # Then move along Y axis
        if dy > 0:
            drone.move_forward(dy)
        elif dy < 0:
            drone.move_back(abs(dy))
        time.sleep(1)

        # Update current position
        current_pos = [target_pos[0], target_pos[1]]

        # Hover to claim the letter
        print(f"Hovering over {letter} for 3 seconds...")
        time.sleep(3)
        print(f"Claimed: {letter}")

    drone.takeoff()
    time.sleep(2)

    for letter in TARGET_WORD:
        navigate_to(letter)

    drone.land()
    print("Mission complete! Spelled:", TARGET_WORD)`
  },
  {
    id: 5,
    title: "Swarm Leader-Follower",
    default_code: `from djitellopy import Tello
import threading
import math
import time

# Formation offset: follower maintains this gap from the leader at all times
OFFSET_X = 50   # 50 cm to the right of the leader
OFFSET_Y = 0    # same depth as the leader (not ahead or behind)

leader   = Tello("192.168.10.1")
follower = Tello("192.168.10.2")
leader.connect()
follower.connect()

print("Leader battery:   " + str(leader.get_battery()) + "%")
print("Follower battery: " + str(follower.get_battery()) + "%")

# World coordinate tracker: where each drone is on the floor (cm)
leader_x, leader_y     = 0.0, 0.0
follower_x, follower_y = float(OFFSET_X), float(OFFSET_Y)
heading = 0.0   # degrees, 0 = north, 90 = east, clockwise positive

def fly_both(cmd_leader, cmd_follower):
    t1 = threading.Thread(target=cmd_leader)
    t2 = threading.Thread(target=cmd_follower)
    t1.start()
    t2.start()
    t1.join()
    t2.join()

def follower_target():
    """Compute where follower needs to be in world coordinates.
    Target = leader position + offset vector rotated by current heading."""
    rad = math.radians(heading)
    tx = leader_x + OFFSET_X * math.cos(rad) + OFFSET_Y * math.sin(rad)
    ty = leader_y - OFFSET_X * math.sin(rad) + OFFSET_Y * math.cos(rad)
    return tx, ty

def move_follower_to_target():
    """Issue move commands to close the gap between follower and target."""
    global follower_x, follower_y

    tx, ty = follower_target()
    dx = tx - follower_x
    dy = ty - follower_y

    # Project world delta onto follower's local forward and right axes
    rad = math.radians(heading)
    fwd   = int(dx * math.sin(rad) + dy * math.cos(rad))
    right = int(dx * math.cos(rad) - dy * math.sin(rad))

    # Track only what is actually commanded (commands below 20 cm are skipped)
    actual_fwd   = 0
    actual_right = 0

    if abs(fwd) >= 20:
        if fwd > 0:
            follower.move_forward(abs(fwd))
        else:
            follower.move_back(abs(fwd))
        actual_fwd = fwd

    if abs(right) >= 20:
        if right > 0:
            follower.move_right(abs(right))
        else:
            follower.move_left(abs(right))
        actual_right = right

    # Update tracked position AFTER commands, based on what was actually moved
    follower_x += actual_fwd * math.sin(rad) + actual_right * math.cos(rad)
    follower_y += actual_fwd * math.cos(rad) - actual_right * math.sin(rad)

def formation_forward(dist):
    """Leader moves forward; follower calculates its own correction to hold offset."""
    global leader_x, leader_y
    rad = math.radians(heading)
    leader_x += dist * math.sin(rad)
    leader_y += dist * math.cos(rad)
    fly_both(
        lambda: leader.move_forward(dist),
        lambda: move_follower_to_target()
    )

def formation_rotate(deg):
    """Both drones rotate; heading changes so offset direction shifts.
    Follower repositions after rotation to restore correct alignment."""
    global heading
    fly_both(
        lambda: leader.rotate_clockwise(deg),
        lambda: follower.rotate_clockwise(deg)
    )
    heading = (heading + deg) % 360
    move_follower_to_target()

# Take off in formation
fly_both(leader.takeoff, follower.takeoff)
time.sleep(2)

# Fly a square in formation (4 sides x 60 cm)
for side in range(4):
    print("Side " + str(side + 1) + " | Heading: " + str(int(heading)) + " deg")
    formation_forward(60)
    time.sleep(1)
    formation_rotate(90)
    time.sleep(1)

# Land together
fly_both(leader.land, follower.land)
print("Formation flight complete!")`,
    docs: `OVERVIEW
--------
In this advanced module, you will control two drones at the same time
using a Leader-Follower algorithm. The Leader flies freely. The Follower
does NOT copy the leader's commands — instead it continuously calculates
what commands IT needs to maintain a fixed spatial offset (e.g., always
50 cm to the right of the Leader) no matter where the Leader goes or
how it turns.

This introduces you to swarm robotics, concurrent programming, and
coordinate geometry.


WHAT YOU WILL LEARN
--------------------
- How to connect to and manage two drones in one program
- What Python threading is and why it is essential for swarm control
- The difference between world coordinates and a drone's local frame
- How to track drone positions and heading across a flight
- How to rotate an offset vector to match the leader's heading
- How to calculate the follower's unique commands from the offset error


WHY DO WE NEED THREADING?
---------------------------
If you send commands one after another (sequentially), the second drone
always starts slightly later. Over time, they fall out of sync.

Threading lets both commands start at the same millisecond.

    Without threading (WRONG):
        leader.takeoff()      <- Leader starts
        follower.takeoff()    <- Follower starts 2-3 seconds later

    With threading (CORRECT):
        Both takeoff at the same instant


STEP 1 - Connect to Both Drones
---------------------------------
Each Tello drone has its own WiFi network and IP address.

    from djitellopy import Tello
    import threading
    import math
    import time

    leader   = Tello("192.168.10.1")
    follower = Tello("192.168.10.2")
    leader.connect()
    follower.connect()

    print("Leader battery:   " + str(leader.get_battery()) + "%")
    print("Follower battery: " + str(follower.get_battery()) + "%")


STEP 2 - Define the Formation Offset and World Tracker
-------------------------------------------------------
We define the offset in the leader's LOCAL frame (e.g., 50 cm to the right).
We also track both drones' positions in WORLD coordinates (the floor map)
and the leader's heading so we always know where everyone is.

    OFFSET_X = 50   # cm to the right of the leader
    OFFSET_Y = 0    # same depth as the leader

    leader_x, leader_y     = 0.0, 0.0
    follower_x, follower_y = float(OFFSET_X), float(OFFSET_Y)
    heading = 0.0   # 0 = north, 90 = east, clockwise positive


STEP 3 - Compute Follower's Target Position
--------------------------------------------
When the leader moves or rotates, we recalculate where the follower
NEEDS to be in world coordinates. The offset rotates with the leader's
heading so "50 cm to the right" always means right from the leader's
perspective, not right in the world.

    def follower_target():
        rad = math.radians(heading)
        tx = leader_x + OFFSET_X * math.cos(rad) + OFFSET_Y * math.sin(rad)
        ty = leader_y - OFFSET_X * math.sin(rad) + OFFSET_Y * math.cos(rad)
        return tx, ty

Example — Leader faces north (heading=0):
    Right in world = +X  →  target = (leader_x + 50, leader_y)

Example — Leader faces east (heading=90):
    Right in world = -Y  →  target = (leader_x, leader_y - 50)

The target shifts with the heading. This is what keeps the formation
meaningful even when the leader turns.


STEP 4 - Move Follower to Target (Different Commands from Leader)
------------------------------------------------------------------
Once we know the target, we compute the delta between where the
follower IS and where it NEEDS to be, then project that delta into
the follower's local frame to get forward/back and right/left commands.

    def move_follower_to_target():
        global follower_x, follower_y
        tx, ty = follower_target()
        dx = tx - follower_x
        dy = ty - follower_y

        rad = math.radians(heading)
        fwd   = int(dx * math.sin(rad) + dy * math.cos(rad))
        right = int(dx * math.cos(rad) - dy * math.sin(rad))

        actual_fwd   = 0
        actual_right = 0

        if abs(fwd) >= 20:
            if fwd > 0:
                follower.move_forward(abs(fwd))
            else:
                follower.move_back(abs(fwd))
            actual_fwd = fwd

        if abs(right) >= 20:
            if right > 0:
                follower.move_right(abs(right))
            else:
                follower.move_left(abs(right))
            actual_right = right

        # Update AFTER commands, using only what was actually commanded.
        # Updating before would make dx/dy zero in the next call even if
        # the drone has not physically moved yet.
        follower_x += actual_fwd * math.sin(rad) + actual_right * math.cos(rad)
        follower_y += actual_fwd * math.cos(rad) - actual_right * math.sin(rad)

The follower's commands are DIFFERENT from the leader's. For example,
after the leader turns 90 degrees, the follower may need to move
sideways 50 cm while the leader just hovers — because the offset
direction has shifted in world space.


STEP 5 - Formation Move and Rotate Helpers
-------------------------------------------
These wrappers update the world tracker and issue threaded commands.
formation_forward moves the leader and simultaneously corrects the
follower. formation_rotate turns both, then repositions the follower.

    def formation_forward(dist):
        global leader_x, leader_y
        rad = math.radians(heading)
        leader_x += dist * math.sin(rad)
        leader_y += dist * math.cos(rad)
        fly_both(
            lambda: leader.move_forward(dist),
            lambda: move_follower_to_target()
        )

    def formation_rotate(deg):
        global heading
        fly_both(
            lambda: leader.rotate_clockwise(deg),
            lambda: follower.rotate_clockwise(deg)
        )
        heading = (heading + deg) % 360
        move_follower_to_target()   # reposition after heading change


FULL MISSION CODE
-----------------
This complete example flies a square in formation. The follower
computes its own unique commands every step to stay 50 cm to the
right of the leader regardless of direction.

    from djitellopy import Tello
    import threading
    import math
    import time

    OFFSET_X = 50
    OFFSET_Y = 0

    leader   = Tello("192.168.10.1")
    follower = Tello("192.168.10.2")
    leader.connect()
    follower.connect()

    leader_x, leader_y     = 0.0, 0.0
    follower_x, follower_y = float(OFFSET_X), float(OFFSET_Y)
    heading = 0.0

    def fly_both(cmd_leader, cmd_follower):
        t1 = threading.Thread(target=cmd_leader)
        t2 = threading.Thread(target=cmd_follower)
        t1.start()
        t2.start()
        t1.join()
        t2.join()

    def follower_target():
        rad = math.radians(heading)
        tx = leader_x + OFFSET_X * math.cos(rad) + OFFSET_Y * math.sin(rad)
        ty = leader_y - OFFSET_X * math.sin(rad) + OFFSET_Y * math.cos(rad)
        return tx, ty

    def move_follower_to_target():
        global follower_x, follower_y
        tx, ty = follower_target()
        dx = tx - follower_x
        dy = ty - follower_y
        rad = math.radians(heading)
        fwd   = int(dx * math.sin(rad) + dy * math.cos(rad))
        right = int(dx * math.cos(rad) - dy * math.sin(rad))
        actual_fwd   = 0
        actual_right = 0
        if abs(fwd) >= 20:
            if fwd > 0:
                follower.move_forward(abs(fwd))
            else:
                follower.move_back(abs(fwd))
            actual_fwd = fwd
        if abs(right) >= 20:
            if right > 0:
                follower.move_right(abs(right))
            else:
                follower.move_left(abs(right))
            actual_right = right
        follower_x += actual_fwd * math.sin(rad) + actual_right * math.cos(rad)
        follower_y += actual_fwd * math.cos(rad) - actual_right * math.sin(rad)

    def formation_forward(dist):
        global leader_x, leader_y
        rad = math.radians(heading)
        leader_x += dist * math.sin(rad)
        leader_y += dist * math.cos(rad)
        fly_both(
            lambda: leader.move_forward(dist),
            lambda: move_follower_to_target()
        )

    def formation_rotate(deg):
        global heading
        fly_both(
            lambda: leader.rotate_clockwise(deg),
            lambda: follower.rotate_clockwise(deg)
        )
        heading = (heading + deg) % 360
        move_follower_to_target()

    fly_both(leader.takeoff, follower.takeoff)
    time.sleep(2)

    for side in range(4):
        print("Side " + str(side + 1) + " | Heading: " + str(int(heading)) + " deg")
        formation_forward(60)
        time.sleep(1)
        formation_rotate(90)
        time.sleep(1)

    fly_both(leader.land, follower.land)
    print("Formation flight complete!")`
  }
];
