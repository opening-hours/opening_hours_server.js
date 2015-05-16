CHECK_URL ?= http://localhost:5000/api/oh_interpreter

.PHONY: default check dev

default:
	@echo "See Makefile"

check: test.opening_hours.error.json \
		test.opening_hours.errorOnly.json \
		test.opening_hours.warnOnly.json \
		test.collection_times.error.json \
		test.collection_times.errorOnly.json \
		test.collection_times.warnOnly.json

dev:
	./ohs.js --debug 5000

test.%.json:
	wget "$(CHECK_URL)?tag=$(shell echo "$@" | cut -d . -f 2)&filter=$(shell echo "$@" | cut -d . -f 3)&s=50.6553939&w=6.9842517&n=50.8111732&e=7.2673653" --output-document "$@" --quiet
