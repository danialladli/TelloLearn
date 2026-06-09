"""
conftest.py — place this file in TelloLearn/backend/
It adds the backend directory to sys.path so all imports resolve correctly.
"""
import sys
import os

# Allow "from security import ..." etc. from any test file
sys.path.insert(0, os.path.dirname(__file__))
