@echo off
setlocal EnableExtensions EnableDelayedExpansion

for %%I in ("%~dp0..") do set "PROJECT_DIR=%%~fI"
set "ENV_FILE=%PROJECT_DIR%\.env"
set "LAN_HOST="

if exist "%ENV_FILE%" (
  for /f "usebackq tokens=1,* delims==" %%A in ("%ENV_FILE%") do (
    set "KEY=%%A"
    set "VALUE=%%B"
    if /I "!KEY!"=="EXPO_PUBLIC_DEV_SERVER_HOST" set "LAN_HOST=!VALUE!"
  )
)

if not defined LAN_HOST if defined REACT_NATIVE_PACKAGER_HOSTNAME set "LAN_HOST=%REACT_NATIVE_PACKAGER_HOSTNAME%"

if not defined LAN_HOST (
  echo Missing EXPO_PUBLIC_DEV_SERVER_HOST in "%ENV_FILE%".
  echo Set your computer LAN IP first, for example:
  echo EXPO_PUBLIC_DEV_SERVER_HOST=192.168.1.204
  exit /b 1
)

set "REACT_NATIVE_PACKAGER_HOSTNAME=%LAN_HOST%"
echo Starting Expo dev client over LAN host %LAN_HOST% for Android

pushd "%PROJECT_DIR%"
call npx.cmd expo start --dev-client --lan --clear --android
set "EXIT_CODE=%ERRORLEVEL%"
popd

exit /b %EXIT_CODE%
