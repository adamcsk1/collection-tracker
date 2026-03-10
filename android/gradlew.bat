@echo off
setlocal

if exist "gradle\wrapper\gradle-wrapper.jar" (
  if exist "%JAVA_HOME%\bin\java.exe" (
    "%JAVA_HOME%\bin\java.exe" -jar gradle\wrapper\gradle-wrapper.jar %*
    exit /b %errorlevel%
  )
)

where gradle >nul 2>nul
if %errorlevel%==0 (
  gradle %*
  exit /b %errorlevel%
)

echo Gradle is not available. Install Gradle or use Android Studio to run the project.
exit /b 1
