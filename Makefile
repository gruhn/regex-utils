.PHONY: clean

docs: dist equiv-checker.html tsconfig.build.json
	npx typedoc --tsconfig tsconfig.build.json
	cp -r dist/ docs/dist/
	cp equiv-checker.html docs/

dist: src node_modules tsconfig.build.json
	npx tsc --project tsconfig.build.json
	npx tsc-alias

node_modules: package-lock.json
	npm ci

####################################################

clean:
	rm -rf dist/ docs/
