# Collection Tracker

## Build and run docker container

```powershell

# Build image
docker build -t collection-tracker .

# Run (foreground)
docker run --rm -p 3001:3001 -v ${PWD}/.data:/data collection-tracker

# Or detached
docker run --rm -p 3001:3001 -v ${PWD}/.data:/data -d collection-tracker
```
