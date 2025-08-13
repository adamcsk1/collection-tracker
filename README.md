# Collection tracker

### Docker
docker build -t collection-tracker .
docker run --rm -p 3001:3001 -v ${PWD}/.data:/data collection-tracker
docker run --rm -p 3001:3001 -v ${PWD}/.data:/data collection-tracker -d
