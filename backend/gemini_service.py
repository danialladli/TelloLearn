import os
from google import genai
from google.genai import types
from pydantic import BaseModel
from dotenv import load_dotenv
import json

# Load environment variables
load_dotenv()

# 1. Define the strict JSON structure we demand from Gemini
class ValidationResult(BaseModel):
    is_correct: bool
    feedback: str

# Initialize the client (it automatically picks up GEMINI_API_KEY from the environment)
client = genai.Client()

def analyze_student_code(module_id: str, student_code: str) -> dict:
    """Sends the student's code to Gemini and returns a guaranteed JSON dictionary."""
    
    # 2. Define the expected logic based on the module they are attempting
    # (In a full production app, you might fetch this from a database)
    module_contexts = {
        "module1": "The student needs to write Python code to make the Tello drone takeoff, move forward, and land using the tello SDK.",
        
        "module2": "The student needs to write a loop that processes video frames to find a green landing pad and execute an autonomous landing sequence.",
        
        "module3": "The student needs to implement computer vision logic to identify specific alphabet letters, calculate X/Y alignment errors, and hover over the letter for a set duration to spell a word.",
        
        "module4": "The student needs to calculate the shortest path (X and Y distance vectors) between coordinate points on a spatial grid, and write flight logic to navigate the drone to spell a target word.",
        
        "module5": "The student needs to implement a Leader-Follower swarm algorithm using threading, where a follower drone calculates a spatial offset and synchronizes its movements with the leader drone."
    }
    
    expected_logic = module_contexts.get(module_id, "Basic Python syntax check.")

    # 3. Construct the Prompt (The "System" persona)
    prompt = f"""
    You are an expert Python programming tutor evaluating a student's drone flight code for the TelloLearn app.
    
    Module Goal: {expected_logic}
    
    Student's Code:
    ```python
    {student_code}
    ```

    Analyze the syntax and the logic.
    - If the code successfully achieves the goal and has no syntax errors, set 'is_correct' to true and provide a brief encouraging success message.
    - If the code has errors or misses the core logic, set 'is_correct' to false. Generate helpful hints and explanations without giving away the exact correct code. Guide them to the answer.
    """

    # 4. Call the Gemini API with Structured Outputs enforced
    response = client.models.generate_content(
        model='gemini-2.5-flash',
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=ValidationResult, # Force it to match our Pydantic model
            temperature=0.2, # Keep the AI focused and deterministic
        ),
    )

    if not response.text:
        print("[ERROR] Gemini returned an empty response.")
        return {
            "is_correct": False,
            "feedback": "System Error: The AI validation failed to generate a response. Please check your code and try again."
        }
    
    # Parse the guaranteed JSON string back into a Python dictionary
    return json.loads(response.text)