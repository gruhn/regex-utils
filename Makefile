.PHONY: all

all: Makefile node_modules/.stamp docs/.stamp dist/.stamp

####################################################

docs/.stamp: dist/.stamp equiv-checker.html tsconfig.build.json
	npx typedoc --tsconfig tsconfig.build.json
	cp -r dist/ docs/dist/
	cp equiv-checker.html docs/
	touch $@

dist/.stamp: tsconfig.build.json src/*.ts
	npx tsc --project tsconfig.build.json
	npx tsc-alias
	touch $@

node_modules/.stamp: package-lock.json
	npm ci
	touch $@
