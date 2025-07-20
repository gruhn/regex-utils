.PHONY: all bench

build: Makefile node_modules/.stamp docs/.stamp dist/.stamp

bench: benchmark/aoc2023-day12-result.txt benchmark/parser-bench-result.txt benchmark/toStdRegex_output_length-result.txt

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


####################################################

benchmark/aoc2023-day12-result.txt: src/ benchmark/aoc2023-day12.ts
	npx tsx benchmark/aoc2023-day12.ts

benchmark/parser-bench-result.txt: src/ benchmark/parser-bench.ts
	npx tsx benchmark/parser-bench.ts

benchmark/toStdRegex_output_length-result.txt: src/ benchmark/toStdRegex_output_length.ts
	npx tsx benchmark/toStdRegex_output_length.ts
