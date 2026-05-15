@echo off
echo ===================================================
echo    TelloLearn: Automatic Network Setup
echo ===================================================
echo.
echo Adding Firewall Exception for FastAPI (Port 8000)...

netsh advfirewall firewall add rule name="TelloLearn Backend" dir=in action=allow protocol=TCP localport=8000

echo.
echo Setup Complete! Port 8000 now can pass through your firewall.
pause