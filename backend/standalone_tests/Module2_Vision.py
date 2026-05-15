import cv2
import numpy as np
from djitellopy import tello
import time

# --- 1. INITIALIZATION ---
print("Connecting to Tello...")
drone = tello.Tello()
drone.connect()
print(f"Battery: {drone.get_battery()}%")

drone.streamon()
print("Booting camera... please wait 3 seconds...")
time.sleep(3)

print("Taking off...")
drone.takeoff()
print("Hovering to stabilize...")
time.sleep(2) 

# --- 2. CONFIGURATION ---
w, h = 360, 240       
center_x = w // 2     
dead_zone = 40        

# FSM Variables
flight_state = "SEARCHING"
stabilize_start_time = 0
patience_counter = 0  
search_direction = 15 # NEW: Start with a slow right spin, and remember the direction!

while True:
    frame = drone.get_frame_read().frame
    if frame is None or frame.size == 0:
        continue 

    img = cv2.resize(frame, (w, h))  # type: ignore

    # UI: Draw the center line
    cv2.line(img, (center_x, 0), (center_x, h), (255, 255, 0), 1)

    # --- 3. COMPUTER VISION ---
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    lower_green = np.array([40, 50, 50])
    upper_green = np.array([80, 255, 255])
    mask = cv2.inRange(hsv, lower_green, upper_green)
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    pad_found = False
    pad_area = 0

    if len(contours) > 0:
        pad_contour = max(contours, key=cv2.contourArea)
        pad_area = cv2.contourArea(pad_contour)

        if pad_area > 800: 
            pad_found = True
            x, y, bw, bh = cv2.boundingRect(pad_contour)
            cx = x + (bw // 2)
            cy = y + (bh // 2)
            bottom_edge_of_pad = y + bh

            # Draw the tracking box
            cv2.rectangle(img, (x, y), (x+bw, y+bh), (0, 255, 0), 2)
            cv2.circle(img, (cx, cy), 5, (0, 0, 255), cv2.FILLED)

    # --- 4. THE FINITE STATE MACHINE (FSM) ---
    forward_speed = 0
    yaw_speed = 0

    if pad_found:
        # THE FIX: Double the memory! Give it a full second to stop its momentum.
        patience_counter = 30 

    # --- THE DEBOUNCER SHIELD ---
    if not pad_found and flight_state != "BLIND_LEAP":
        if patience_counter > 0:
            patience_counter -= 1
            yaw_speed = 0
            forward_speed = 0
        else:
            flight_state = "SEARCHING"

    # --- EXECUTE STATE LOGIC ---
    if flight_state == "SEARCHING":
        if pad_found:
            flight_state = "STABILIZING"
            stabilize_start_time = time.time()
            yaw_speed = 0
        else:
            # THE FIX: Spin much slower, and use the memory of where the pad was!
            yaw_speed = search_direction 

    elif flight_state == "STABILIZING" and pad_found:
        yaw_speed = 0
        forward_speed = 0
        time_elapsed = time.time() - stabilize_start_time
        
        if time_elapsed >= 1.0:
            flight_state = "CENTERING" 

    elif flight_state == "CENTERING" and pad_found:
        error = cx - center_x 
        
        if abs(error) > dead_zone:
            yaw_speed = int(error / 4) 
            if yaw_speed > 30: yaw_speed = 30
            elif yaw_speed < -30: yaw_speed = -30
            
            # THE FIX: Remember which way we were adjusting so we can find it again if we overshoot!
            search_direction = 15 if yaw_speed > 0 else -15
        else:
            yaw_speed = 0   
            flight_state = "APPROACHING"

    elif flight_state == "APPROACHING" and pad_found:
        error = cx - center_x
        
        if abs(error) > dead_zone:
            flight_state = "CENTERING"
        else:
            if bottom_edge_of_pad < h - 20: 
                forward_speed = 15
            else:
                flight_state = "BLIND_LEAP"

    elif flight_state == "BLIND_LEAP":
        print("Pad entered blind spot! Executing final forward push...")
        drone.send_rc_control(0, 0, 0, 0)
        time.sleep(0.5)
        
        drone.send_rc_control(0, 20, 0, 0)
        time.sleep(1.8) 
        
        drone.send_rc_control(0, 0, 0, 0)
        print("DROP ZONE REACHED! Initiating Landing...")
        drone.land()
        break 

    # --- 5. EXECUTE MOVEMENT ---
    drone.send_rc_control(0, forward_speed, 0, yaw_speed)

    # --- 6. TELEMETRY LOG WINDOW ---
    log_window = np.zeros((300, 400, 3), dtype=np.uint8)
    cv2.putText(log_window, "--- TELLO FLIGHT LOGS ---", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
    cv2.putText(log_window, f"Battery: {drone.get_battery()}%", (10, 70), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 1)
    
    state_color = (0, 255, 0) if flight_state == "APPROACHING" else ((0, 255, 255) if flight_state in ["STABILIZING", "CENTERING"] else (0, 0, 255))
    display_state = f"HOLDING ({patience_counter})" if (not pad_found and patience_counter > 0 and flight_state != "SEARCHING") else flight_state
    
    cv2.putText(log_window, f"State: {display_state}", (10, 110), cv2.FONT_HERSHEY_SIMPLEX, 0.6, state_color, 2)
    cv2.putText(log_window, f"Yaw Speed: {yaw_speed}", (10, 150), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)
    cv2.putText(log_window, f"Fwd Speed: {forward_speed}", (10, 190), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)
    cv2.putText(log_window, f"Pad Area: {int(pad_area)} px", (10, 230), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)

    cv2.imshow("Module 2: Camera Stream", img)
    cv2.imshow("Live Telemetry", log_window)
    
    if cv2.waitKey(1) & 0xFF == ord('q'):
        drone.land()
        break

# --- 7. CLEAN SHUTDOWN ---
print("Closing video stream and disconnecting...")
drone.streamoff() 
drone.end()       
cv2.destroyAllWindows()