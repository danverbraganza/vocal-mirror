install:
	npm install

build:
	npm run build
	cp dist/assets/* ../website/assets/
	cp dist/index.html ../website/vocal-mirror.html
	cp vocal-mirror.css ../website/assets/

dev:
	npm run dev

.PHONY: install build dev
