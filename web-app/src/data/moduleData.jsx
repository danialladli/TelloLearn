export const MODULE_CONTENT = {
  "1": {
    title: "Basic Flight Control",
    // Tutorial: Execute Basic Flight Routines with Tello and Python
    videoUrl: "https://www.youtube.com/embed/wn3UVB9xoVk", 
    docs: `# Introduction
In this foundational module, you will learn the basics of Unmanned Aerial Vehicle (UAV) flight dynamics. You will write a Python script to establish a connection with the Tello drone and execute a pre-planned flight path involving takeoff, basic maneuvers, and landing.

# Keywords
- **Telemetry:** Real-time data sent from the drone (battery, height, temp).
- **Pitch/Roll/Yaw:** The three axes of rotation for flight control.
- **SDK (Software Development Kit):** A set of tools that allows us to control the hardware using code.

# Libraries Used
- **djitellopy:** This is the primary wrapper library. It handles the complex UDP network packets required to send commands (like "takeoff") to the drone's IP address (192.168.10.1).
- **time:** A standard Python library used here to introduce delays (sleep). This is crucial to give the drone physical time to complete a movement before receiving the next command.`,
    defaultCode: "from djitellopy import Tello\nimport time\n\n# 1. Connect\ndrone = Tello()\ndrone.connect()\nprint(f'Battery: {drone.get_battery()}%')\n\n# 2. Mission\ndrone.takeoff()\ntime.sleep(2)\n\ndrone.move_forward(30) # cm\ndrone.rotate_clockwise(90)\n\n# 3. Land\ndrone.land()"
  },
  
  "2": {
    title: "Landing Pad Accuracy",
    // Tutorial: Tello EDU Mission Pad Programming
    videoUrl: "https://www.youtube.com/embed/Uo2KovDEJTs", 
    docs: `# Introduction
Precision landing is critical for autonomous drone charging and delivery. In this module, you will utilize the Tello's downward-facing infrared camera to detect specific "Mission Pads" (ID markers) and program the drone to land exactly on top of them.

# Keywords
- **Monocular Vision:** Using a single camera to estimate depth and position.
- **Mission Pad:** A distinct QR-style marker that the Tello SDK can recognize natively.
- **Correction Loop:** A code loop that constantly adjusts the drone's position to keep the target centered.

# Libraries Used
- **djitellopy (Mission Pad Mode):** We will enable the specialized 'mission pad detection' feature which returns the X, Y, and Z coordinates of the drone relative to the pad.
- **math:** Used to calculate the Euclidean distance between the drone and the center of the pad to determine when it is safe to land.`,
    defaultCode: "from djitellopy import Tello\n\ndrone = Tello()\ndrone.connect()\n\n# Enable Downward Camera Detection\ndrone.enable_mission_pads()\ndrone.set_mission_pad_detection_direction(2) # Downward\n\ndrone.takeoff()\n\n# Mission: Hover until Pad 1 is found\npad = drone.get_mission_pad_id()\nif pad == 1:\n    drone.land()\nelse:\n    print('Searching for Landing Pad...') "
  },

  "3": {
    title: "Alphabet Recognition",
    // Tutorial: Python OpenCV Object Tracking (closest to Letter Recognition)
    videoUrl: "https://www.youtube.com/embed/vDOkUHNdmKs",
    docs: `# Introduction
This advanced module introduces Computer Vision (CV). You will capture the video feed from the drone's main camera and process it in real-time to recognize shapes or letters (specifically the letter 'A') using edge detection algorithms.

# Keywords
- **Computer Vision:** Giving computers the ability to "see" and interpret images.
- **Thresholding:** Converting a color image into strict black-and-white to simplify analysis.
- **Contours:** Lines joining all the continuous points along a boundary with the same color or intensity.

# Libraries Used
- **OpenCV (cv2):** The industry standard for real-time image processing. We use it to convert video frames to grayscale, blur noise, and detect edges (Canny Edge Detection).
- **NumPy:** A powerful math library. Images in Python are essentially giant grids of numbers (matrices); NumPy allows us to slice and manipulate these grids efficiently.`,
    defaultCode: "import cv2\nimport numpy as np\nfrom djitellopy import Tello\n\ndrone = Tello()\ndrone.connect()\ndrone.streamon()\n\nwhile True:\n    frame = drone.get_frame_read().frame\n    \n    # Convert to Grayscale for efficiency\n    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)\n    \n    cv2.imshow('Drone Vision', gray)\n    if cv2.waitKey(1) & 0xFF == ord('q'):\n        break"
  },

  "4": {
    title: "Voice Command",
    // Tutorial: Voice Activated Tello Drone with Python
    videoUrl: "https://www.youtube.com/embed/lJScltStcJY",
    docs: `# Introduction
Move beyond keyboard controls by integrating Automatic Speech Recognition (ASR). In this module, you will build a system that listens to your microphone, translates spoken words into text, and maps that text to drone flight commands.

# Keywords
- **ASR (Automatic Speech Recognition):** The technology that converts spoken language into text.
- **Latency:** The delay between speaking a command and the drone reacting.
- **Threading:** Running the "listening" code and the "flying" code at the same time so one doesn't block the other.

# Libraries Used
- **SpeechRecognition:** A Python library that acts as a wrapper for various speech APIs (like Google Speech API or CMU Sphinx) to transcribe audio.
- **PyAudio:** Used to access the microphone hardware on your laptop.
- **threading:** Standard Python library. It is essential here to keep the drone stabilizing itself in the background while the main program waits for your voice input.`,
    defaultCode: "import speech_recognition as sr\nfrom djitellopy import Tello\n\n# Initialize Recognizer\nr = sr.Recognizer()\nmic = sr.Microphone()\n\ndef listen_command():\n    with mic as source:\n        print('Listening...')\n        audio = r.listen(source)\n    try:\n        return r.recognize_google(audio).lower()\n    except: \n        return ''\n\n# Main Loop\ncmd = listen_command()\nif 'take off' in cmd:\n    drone.takeoff()"
  },

  "5": {
    title: "Swarm Programming",
    // Tutorial: Tello EDU Drone Swarming Tutorial
    videoUrl: "https://www.youtube.com/embed/cIsddY4SKgA",
    docs: `# Introduction
The pinnacle of drone programming is Swarm Intelligence. You will control multiple Tello drones simultaneously using a single computer. This requires understanding network IP management and synchronized command broadcasting.

# Keywords
- **Swarm Intelligence:** The collective behavior of decentralized, self-organized systems.
- **IP Addressing:** Assigning a unique network identity (e.g., 192.168.10.2, 192.168.10.3) to each drone so commands go to the right place.
- **Synchronization:** Ensuring all drones perform an action (like a flip) at the exact same millisecond.

# Libraries Used
- **djitellopy.TelloSwarm:** A specialized class within the library designed to manage a list of IP addresses. It iterates through the list to send commands to all connected drones almost simultaneously.
- **queue:** Used to manage data coming back from multiple drones at once without crashing the program (thread-safe data handling).`,
    defaultCode: "from djitellopy import TelloSwarm\n\n# IPs of the two drones connected to the router\nswarm_ips = ['192.168.10.2', '192.168.10.3']\n\nswarm = TelloSwarm.fromIps(swarm_ips)\nswarm.connect()\n\n# Command both to take off\nswarm.takeoff()\n\n# Perform synchronized flip\nswarm.flip('l')\n\nswarm.land()"
  },

  "default": {
    title: "Unknown Mission",
    videoUrl: "https://www.youtube.com/embed/wn3UVB9xoVk", // Fallback to basic flight
    docs: "Error: Could not find module data. Please return to the dashboard.",
    defaultCode: "# No code available"
  }
};

// Array of modules with correct answers for validation
export const modules = [
  {
    id: 1,
    title: "Basic Flight Control",
    correctAnswer: "from djitellopy import Tello\nimport time\n\n# 1. Connect\ndrone = Tello()\ndrone.connect()\nprint(f'Battery: {drone.get_battery()}%')\n\n# 2. Mission\ndrone.takeoff()\ntime.sleep(2)\n\ndrone.move_forward(30) # cm\ndrone.rotate_clockwise(90)\n\n# 3. Land\ndrone.land()"
  },
  {
    id: 2,
    title: "Landing Pad Accuracy",
    correctAnswer: "from djitellopy import Tello\n\ndrone = Tello()\ndrone.connect()\n\n# Enable Downward Camera Detection\ndrone.enable_mission_pads()\ndrone.set_mission_pad_detection_direction(2) # Downward\n\ndrone.takeoff()\n\n# Mission: Hover until Pad 1 is found\npad = drone.get_mission_pad_id()\nif pad == 1:\n    drone.land()\nelse:\n    print('Searching for Landing Pad...') "
  },
  {
    id: 3,
    title: "Alphabet Recognition",
    correctAnswer: "import cv2\nimport numpy as np\nfrom djitellopy import Tello\n\ndrone = Tello()\ndrone.connect()\ndrone.streamon()\n\nwhile True:\n    frame = drone.get_frame_read().frame\n    \n    # Convert to Grayscale for efficiency\n    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)\n    \n    cv2.imshow('Drone Vision', gray)\n    if cv2.waitKey(1) & 0xFF == ord('q'):\n        break"
  },
  {
    id: 4,
    title: "Voice Command",
    correctAnswer: "import speech_recognition as sr\nfrom djitellopy import Tello\n\n# Initialize Recognizer\nr = sr.Recognizer()\nmic = sr.Microphone()\n\ndef listen_command():\n    with mic as source:\n        print('Listening...')\n        audio = r.listen(source)\n    try:\n        return r.recognize_google(audio).lower()\n    except: \n        return ''\n\n# Main Loop\ncmd = listen_command()\nif 'take off' in cmd:\n    drone.takeoff()"
  },
  {
    id: 5,
    title: "Swarm Programming",
    correctAnswer: "from djitellopy import TelloSwarm\n\n# IPs of the two drones connected to the router\nswarm_ips = ['192.168.10.2', '192.168.10.3']\n\nswarm = TelloSwarm.fromIps(swarm_ips)\nswarm.connect()\n\n# Command both to take off\nswarm.takeoff()\n\n# Perform synchronized flip\nswarm.flip('l')\n\nswarm.land()"
  }
];